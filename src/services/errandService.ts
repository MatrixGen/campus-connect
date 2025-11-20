import models from "../models";
import { Op, Transaction as SequelizeTransaction } from "sequelize";
import {
  Category,
  Urgency,
  ErrandStatus,
  PricingBreakdown,
  CreateErrandData,
} from "../types/errand";
import { getFullPricing } from "../utils/errandPricing";
import logger from "../utils/logger";

// Custom error classes for better error handling
export class ErrandError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "ErrandError";
  }
}

export class ErrandService {
  /**
   * Create a new errand with comprehensive validation
   */
  async createErrand(data: CreateErrandData): Promise<any> {
    // Validate customer exists and is active
    const customer = await models.User.findByPk(data.customerId);
    if (!customer) {
      throw new ErrandError("Customer not found", "CUSTOMER_NOT_FOUND", 404);
    }

    // Check if customer account is active
    if (customer.is_active === false) {
      throw new ErrandError(
        "Customer account is inactive",
        "ACCOUNT_INACTIVE",
        403
      );
    }

    // Check if customer has too many pending errands (prevent spam)
    const pendingErrandsCount = await models.Errand.count({
      where: {
        customer_id: data.customerId,
        status: ErrandStatus.PENDING,
      },
    });

    if (pendingErrandsCount >= 10) {
      throw new ErrandError(
        "You have too many pending errands. Please complete or cancel some before creating new ones.",
        "TOO_MANY_PENDING_ERRANDS",
        429
      );
    }

    const distance = data.distance || 0;

    // Validate pricing
    if (data.budget <= 0) {
      throw new ErrandError("Budget must be positive", "INVALID_BUDGET", 400);
    }

    if (data.budget < 1) {
      throw new ErrandError(
        "Budget must be at least 1 unit",
        "BUDGET_TOO_LOW",
        400
      );
    }

    const pricing: PricingBreakdown = getFullPricing(
      data.budget,
      data.category,
      data.urgency,
      distance
    );

    if (pricing.finalPrice <= 0) {
      throw new ErrandError(
        "Invalid pricing calculation",
        "INVALID_PRICING",
        400
      );
    }

    // Create errand with string values for enums (compatible with DB)
    const errand = await models.Errand.create({
      customer_id: data.customerId,
      title: data.title,
      description: data.description,
      category: data.category, // Enum value is string
      location_from: data.location_from,
      location_to: data.location_to,
      base_price: data.budget,
      final_price: pricing.finalPrice,
      urgency: data.urgency, // Enum value is string
      distance_km: distance,
      estimated_duration_min: data.estimated_duration_min,
      status: ErrandStatus.PENDING, // Enum value is string
      pricing_breakdown: pricing,
    } as any); // Use type assertion to avoid TypeScript errors

    const result = await models.Errand.findByPk(errand.id, {
      include: [
        {
          model: models.User,
          as: "customer",
          attributes: ["id", "full_name", "phone_number", "avatar_url"],
        },
      ],
    });

    if (!result) {
      throw new ErrandError("Failed to create errand", "CREATE_FAILED", 500);
    }

    logger.info("Errand created successfully", {
      errandId: result.id,
      customerId: data.customerId,
      category: data.category,
      finalPrice: pricing.finalPrice,
      urgency: data.urgency,
    });

    return result;
  }

  /**
   * Accept an errand as a runner with comprehensive checks
   */
  async acceptErrand(errandId: number, runnerId: number): Promise<any> {
    if (!models.sequelize) {
      throw new ErrandError(
        "Database connection not available",
        "DATABASE_ERROR",
        500
      );
    }

    return await models.sequelize.transaction(
      async (t: SequelizeTransaction) => {
        // 1. Check if runner exists and is available
        const runner = await models.Runner.findOne({
          where: {
            user_id: runnerId,
            is_available: true,
            is_approved: true,
          },
          transaction: t,
        });

        if (!runner) {
          throw new ErrandError(
            "Runner not available or account not approved",
            "RUNNER_UNAVAILABLE",
            403
          );
        }

        // 2. Check if runner has reached daily acceptance limit
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayAcceptedCount = await models.Errand.count({
          where: {
            runner_id: runnerId,
            accepted_at: {
              [Op.gte]: today, // ✅ Cleaner
            },
          },
          transaction: t,
        });
        if (todayAcceptedCount >= 15) {
          throw new ErrandError(
            "Daily errand acceptance limit reached (15 errands per day)",
            "DAILY_LIMIT_REACHED",
            429
          );
        }

        // 3. Check if errand exists and is pending
        const errand = await models.Errand.findByPk(errandId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!errand) {
          throw new ErrandError("Errand not found", "ERRAND_NOT_FOUND", 404);
        }

        if (errand.status !== ErrandStatus.PENDING) {
          throw new ErrandError(
            `Errand is no longer available. Current status: ${errand.status}`,
            "ERRAND_UNAVAILABLE",
            409
          );
        }

        if (errand.runner_id) {
          throw new ErrandError(
            "Errand already assigned to another runner",
            "ERRAND_ALREADY_ASSIGNED",
            409
          );
        }

        // 4. Prevent runner from accepting their own errand
        if (errand.customer_id === runnerId) {
          throw new ErrandError(
            "Cannot accept your own errand",
            "SELF_ACCEPTANCE_NOT_ALLOWED",
            403
          );
        }

        // 5. Update errand as accepted - use string values for enums
        await errand.update(
          {
            runner_id: runnerId,
            status: ErrandStatus.ACCEPTED, // This is a string value
            accepted_at: new Date(),
          } as any,
          { transaction: t }
        );

        // 6. Make runner unavailable
        await runner.update({ is_available: false }, { transaction: t });

        // 7. Return the updated errand with details
        const updatedErrand = await models.Errand.findByPk(errandId, {
          include: [
            {
              model: models.User,
              as: "customer",
              attributes: ["id", "full_name", "phone_number", "avatar_url"],
            },
            {
              model: models.User,
              as: "runner",
              attributes: ["id", "full_name", "phone_number", "avatar_url"],
            },
          ],
          transaction: t,
        });

        if (!updatedErrand) {
          throw new ErrandError(
            "Failed to retrieve updated errand",
            "RETRIEVE_FAILED",
            500
          );
        }

        logger.info("Errand accepted", {
          errandId,
          runnerId,
          customerId: errand.customer_id,
          category: errand.category,
        });

        return updatedErrand;
      }
    );
  }

  /**
   * Start an errand (move from accepted to in_progress)
   */
  async startErrand(errandId: number, runnerId: number): Promise<any> {
    if (!models.sequelize) {
      throw new ErrandError(
        "Database connection not available",
        "DATABASE_ERROR",
        500
      );
    }

    return await models.sequelize.transaction(
      async (t: SequelizeTransaction) => {
        const errand = await models.Errand.findByPk(errandId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!errand) {
          throw new ErrandError("Errand not found", "ERRAND_NOT_FOUND", 404);
        }

        if (errand.runner_id !== runnerId) {
          throw new ErrandError(
            "Not assigned to this errand",
            "NOT_ASSIGNED_RUNNER",
            403
          );
        }

        if (errand.status !== ErrandStatus.ACCEPTED) {
          throw new ErrandError(
            `Errand must be accepted before starting. Current status: ${errand.status}`,
            "INVALID_STATUS_TRANSITION",
            409
          );
        }

        await errand.update(
          {
            status: ErrandStatus.IN_PROGRESS, // This is a string value
            started_at: new Date(),
          } as any,
          { transaction: t }
        );

        const result = await this.getErrandWithDetails(errandId, t);
        if (!result) {
          throw new ErrandError(
            "Failed to retrieve updated errand",
            "RETRIEVE_FAILED",
            500
          );
        }

        logger.info("Errand started", {
          errandId,
          runnerId,
          startedAt: new Date().toISOString(),
        });

        return result;
      }
    );
  }

  /**
   * Complete an errand and create transaction
   */
  async completeErrand(errandId: number, runnerId: number): Promise<any> {
    if (!models.sequelize) {
      throw new ErrandError(
        "Database connection not available",
        "DATABASE_ERROR",
        500
      );
    }

    return await models.sequelize.transaction(
      async (t: SequelizeTransaction) => {
        const errand = await models.Errand.findByPk(errandId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!errand) {
          throw new ErrandError("Errand not found", "ERRAND_NOT_FOUND", 404);
        }

        if (errand.runner_id !== runnerId) {
          throw new ErrandError(
            "Not assigned to this errand",
            "NOT_ASSIGNED_RUNNER",
            403
          );
        }

        if (errand.status !== ErrandStatus.IN_PROGRESS) {
          throw new ErrandError(
            `Errand must be in progress before completing. Current status: ${errand.status}`,
            "INVALID_STATUS_TRANSITION",
            409
          );
        }

        // Calculate pricing breakdown using original base price
        const pricing: PricingBreakdown = getFullPricing(
          errand.base_price,
          errand.category as Category,
          errand.urgency as Urgency,
          errand.distance_km
        );

        // Update errand as completed - use string value for enum
        await errand.update(
          {
            status: ErrandStatus.COMPLETED, // This is a string value
            completed_at: new Date(),
          } as any,
          { transaction: t }
        );

        const runner = await models.Runner.findOne({
          where: { user_id: runnerId },
          transaction: t,
        });

        if (!runner) {
          throw new ErrandError("Runner not found", "RUNNER_NOT_FOUND", 404);
        }

        // Update runner stats
        const newCompletedCount = (runner.completed_errands || 0) + 1;
        const newEarnings =
          Number(runner.earnings || 0) + pricing.runnerEarnings;

        // Calculate new rating (weighted average)
        const completedErrands = runner.completed_errands || 0;
        const currentRating = runner.rating || 0;
        const newRating =
          completedErrands > 0
            ? (currentRating * completedErrands + 4.5) / (completedErrands + 1)
            : 4.5;

        await runner.update(
          {
            is_available: true,
            completed_errands: newCompletedCount,
            earnings: newEarnings,
            rating: Math.min(5, parseFloat(newRating.toFixed(2))),
          },
          { transaction: t }
        );

        // Create transaction record
        await models.Transaction.create(
          {
            errand_id: errandId,
            customer_id: errand.customer_id,
            runner_id: runnerId,
            amount: errand.final_price,
            base_amount: errand.base_price,
            platform_fee: pricing.platformFee,
            runner_earnings: pricing.runnerEarnings,
            payment_status: "pending",
            payment_method: "wallet",
            completed_at: new Date(),
          } as any,
          { transaction: t }
        );

        const result = await this.getErrandWithDetails(errandId, t);
        if (!result) {
          throw new ErrandError(
            "Failed to retrieve completed errand",
            "RETRIEVE_FAILED",
            500
          );
        }

        logger.info("Errand completed", {
          errandId,
          runnerId,
          runnerEarnings: pricing.runnerEarnings,
          platformFee: pricing.platformFee,
          finalPrice: errand.final_price,
        });

        return result;
      }
    );
  }

  /**
   * Cancel an errand with comprehensive authorization checks
   */
  async cancelErrand(
    errandId: number,
    userId: number,
    reason?: string
  ): Promise<any> {
    if (!models.sequelize) {
      throw new ErrandError(
        "Database connection not available",
        "DATABASE_ERROR",
        500
      );
    }

    return await models.sequelize.transaction(
      async (t: SequelizeTransaction) => {
        const errand = await models.Errand.findByPk(errandId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!errand) {
          throw new ErrandError("Errand not found", "ERRAND_NOT_FOUND", 404);
        }

        // Check authorization and cancellation rules
        const isCustomer = errand.customer_id === userId;
        const isRunner = errand.runner_id === userId;
        const canCancel = this.canCancelErrand(
          errand.status as ErrandStatus,
          isCustomer,
          isRunner
        );

        if (!canCancel.allowed) {
          throw new ErrandError(
            canCancel.reason,
            "CANCELLATION_NOT_ALLOWED",
            403
          );
        }

        // Additional check: Prevent frequent cancellations
        if (isCustomer) {
          const recentCancellations = await models.Errand.count({
            where: {
              customer_id: userId,
              status: ErrandStatus.CANCELLED,
              updated_at: {
                [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000), // ✅ Cleaner
              },
            },
            transaction: t,
          });

          if (recentCancellations >= 3) {
            throw new ErrandError(
              "Too many cancellations in the last 24 hours. Please contact support.",
              "TOO_MANY_CANCELLATIONS",
              429
            );
          }
        }

        if (isRunner) {
          const recentRunnerCancellations = await models.Errand.count({
            where: {
              runner_id: userId,
              status: ErrandStatus.CANCELLED,
              updated_at: {
                [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
            transaction: t,
          });

          if (recentRunnerCancellations >= 2) {
            throw new ErrandError(
              "Too many cancellations as runner in the last 24 hours.",
              "RUNNER_TOO_MANY_CANCELLATIONS",
              429
            );
          }
        }

        // Update with proper field names that match your model
        await errand.update(
          {
            status: ErrandStatus.CANCELLED, // This is a string value
            cancellation_reason: reason,
            cancelled_by: userId,
            cancelled_at: new Date(),
          } as any,
          { transaction: t }
        );

        // If there was a runner, make them available again
        if (errand.runner_id) {
          await models.Runner.update(
            { is_available: true },
            {
              where: { user_id: errand.runner_id },
              transaction: t,
            }
          );
        }

        const result = await this.getErrandWithDetails(errandId, t);
        if (!result) {
          throw new ErrandError(
            "Failed to retrieve cancelled errand",
            "RETRIEVE_FAILED",
            500
          );
        }

        logger.info("Errand cancelled", {
          errandId,
          userId,
          previousStatus: errand.status,
          reason: reason || "No reason provided",
        });

        return result;
      }
    );
  }

  /**
   * Helper to determine if errand can be cancelled
   */
  private canCancelErrand(
    status: ErrandStatus,
    isCustomer: boolean,
    isRunner: boolean
  ): { allowed: boolean; reason: string } {
    const allowedStatuses = [
      ErrandStatus.PENDING,
      ErrandStatus.ACCEPTED,
      ErrandStatus.IN_PROGRESS,
    ];

    if (!allowedStatuses.includes(status)) {
      return {
        allowed: false,
        reason: `Cannot cancel errand in ${status} status`,
      };
    }

    if (!isCustomer && !isRunner) {
      return {
        allowed: false,
        reason: "Not authorized to cancel this errand",
      };
    }

    // Specific rules for different statuses
    if (status === ErrandStatus.IN_PROGRESS) {
      if (isCustomer) {
        return {
          allowed: false,
          reason:
            "Cannot cancel errand that is in progress. Please contact support.",
        };
      }
      // Runner can cancel in-progress errands with valid reason
    }

    if (status === ErrandStatus.ACCEPTED && isCustomer) {
      return {
        allowed: true,
        reason: "",
      };
    }

    return { allowed: true, reason: "" };
  }

  /**
   * Helper method to get errand with all details
   */
  private async getErrandWithDetails(
    errandId: number,
    transaction?: SequelizeTransaction
  ): Promise<any> {
    return models.Errand.findByPk(errandId, {
      include: [
        {
          model: models.User,
          as: "customer",
          attributes: [
            "id",
            "full_name",
            "phone_number",
            "avatar_url",
            "student_id",
          ],
        },
        {
          model: models.User,
          as: "runner",
          attributes: ["id", "full_name", "phone_number", "avatar_url"],
        },
        {
          model: models.Transaction,
          as: "transaction",
        },
        {
          model: models.Review,
          as: "review",
        },
      ],
      ...(transaction && { transaction }),
    });
  }

  /**
   * Preview estimated runner earnings without updating DB
   */
  previewEarnings(
    basePrice: number,
    category: Category,
    urgency: Urgency,
    distance?: number
  ): PricingBreakdown {
    if (basePrice <= 0) {
      throw new ErrandError(
        "Base price must be positive",
        "INVALID_BASE_PRICE",
        400
      );
    }

    if (basePrice < 1) {
      throw new ErrandError(
        "Base price must be at least 1 unit",
        "BASE_PRICE_TOO_LOW",
        400
      );
    }

    if (distance && distance < 0) {
      throw new ErrandError(
        "Distance cannot be negative",
        "INVALID_DISTANCE",
        400
      );
    }

    // Validate category against the enum values
    if (!Object.values(Category).includes(category)) {
      throw new ErrandError("Invalid category", "INVALID_CATEGORY", 400);
    }

    // Validate urgency against the enum values
    if (!Object.values(Urgency).includes(urgency)) {
      throw new ErrandError("Invalid urgency level", "INVALID_URGENCY", 400);
    }

    return getFullPricing(basePrice, category, urgency, distance || 0);
  }

  /**
   * Get errand by ID with authorization check
   */
  async getErrandById(errandId: number, userId: number): Promise<any> {
    const errand = await this.getErrandWithDetails(errandId);

    if (!errand) {
      throw new ErrandError("Errand not found", "ERRAND_NOT_FOUND", 404);
    }

    const isCustomer = errand.customer_id === userId;
    const isRunner = errand.runner_id === userId;

    if (!isCustomer && !isRunner) {
      throw new ErrandError(
        "Not authorized to view this errand",
        "NOT_AUTHORIZED",
        403
      );
    }

    return errand;
  }

  /**
   * Check if user can perform action on errand
   */
  async authorizeErrandAction(
    errandId: number,
    userId: number,
    action: "update" | "cancel" | "view"
  ): Promise<boolean> {
    const errand = await models.Errand.findByPk(errandId);

    if (!errand) {
      throw new ErrandError("Errand not found", "ERRAND_NOT_FOUND", 404);
    }

    const isCustomer = errand.customer_id === userId;
    const isRunner = errand.runner_id === userId;

    switch (action) {
      case "update":
        return isCustomer && errand.status === ErrandStatus.PENDING;
      case "cancel":
        return isCustomer || isRunner;
      case "view":
        return isCustomer || isRunner;
      default:
        return false;
    }
  }
}

export const errandService = new ErrandService();
