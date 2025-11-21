// src/controllers/errandController.ts
import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { errandService } from "../services/errandService";
import socketService from "../services/socketService"; // Added WebSocket import
import models from "../models";
import { Op } from "sequelize";
import {
  Category,
  Urgency,
  ErrandStatus,
  CreateErrandData,
} from "../types/errand";
import logger from "../utils/logger";

// Import validation utilities and middleware
import {
  validateIdParam,
  parseErrandStatus,
  handleValidationErrors,
  validateErrandCreation,
  validateErrandId,
  validateCancelErrand,
  validatePreviewEarnings,
  validateQueryFilters,
} from "../middleware/validators/errandValidator";

// Re-export validation schemas for routes
export {
  validateErrandCreation,
  validateErrandId,
  validateCancelErrand,
  validatePreviewEarnings,
  validateQueryFilters,
  handleValidationErrors,
};

const handleServiceError = (error: any, res: Response) => {
  logger.error("Service error:", {
    message: error.message,
    code: error.code,
    stack: error.stack,
  });

  // Known business logic errors
  if (
    error.message.includes("not available") ||
    error.message.includes("Not authorized") ||
    error.message.includes("not approved")
  ) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }

  if (
    error.message.includes("not found") ||
    error.message.includes("no longer available")
  ) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  if (
    error.message.includes("already assigned") ||
    error.message.includes("cannot be modified") ||
    error.message.includes("INVALID_STATUS_TRANSITION")
  ) {
    return res.status(409).json({
      success: false,
      message: error.message,
    });
  }

  if (
    error.message.includes("Too many") ||
    error.message.includes("limit reached")
  ) {
    return res.status(429).json({
      success: false,
      message: error.message,
    });
  }

  // Validation errors
  if (
    error.message.includes("Invalid") ||
    error.message.includes("required") ||
    error.message.includes("must be") ||
    error.name === "ValidationError"
  ) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  // Default server error
  logger.error("Unhandled error in controller:", error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};

class ErrandController {
  /**
   * Create a new errand
   */
  async createErrand(req: AuthRequest, res: Response) {
    try {
      const {
        title,
        category,
        location_from,
        location_to,
        budget,
        urgency = Urgency.STANDARD,
        description,
        estimated_duration_min,
        distance,
      } = req.body;

      const errandData: CreateErrandData = {
        customerId: req.user.userId,
        title: title.trim(),
        description: description?.trim(),
        category: category as Category,
        location_from: location_from.trim(),
        location_to: location_to.trim(),
        budget: parseFloat(budget),
        urgency: urgency as Urgency,
        estimated_duration_min: estimated_duration_min
          ? parseInt(estimated_duration_min)
          : undefined,
        distance: distance ? parseFloat(distance) : undefined,
      };

      const errand = await errandService.createErrand(errandData);

      // WebSocket: Emit errand created event
      socketService.emitErrandCreated(errand);

      logger.info("Errand created successfully", {
        errandId: errand.id,
        customerId: req.user.userId,
        category: errandData.category,
        urgency: errandData.urgency,
      });

      return res.status(201).json({
        success: true,
        message: "Errand created successfully",
        data: errand,
      });
    } catch (error: any) {
      return handleServiceError(error, res);
    }
  }

  /**
   * Get available errands for runners with filtering and pagination
   */
  async getAvailableErrands(req: AuthRequest, res: Response) {
    try {
      // Check if user is an available runner
      const runner = await models.Runner.findOne({
        where: {
          user_id: req.user.userId,
          is_available: true,
          is_approved: true,
        },
      });

      if (!runner) {
        return res.status(403).json({
          success: false,
          message:
            "You are not available as a runner or your account is not approved",
        });
      }

      const {
        category,
        urgency,
        max_distance,
        page = 1,
        limit = 20,
        sort_by = "urgency",
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string, 10));
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit as string, 10))
      );
      const offset = (pageNum - 1) * limitNum;

      const whereConditions: any = {
        status: ErrandStatus.PENDING,
        customer_id: { [Op.ne]: req.user.userId },
      };

      // Apply filters
      if (category && typeof category === "string") {
        whereConditions.category = category;
      }

      if (urgency && typeof urgency === "string") {
        whereConditions.urgency = urgency;
      }

      if (max_distance) {
        const distance = parseFloat(max_distance as string);
        if (!isNaN(distance) && distance > 0) {
          whereConditions.distance_km = {
            [Op.lte]: distance,
          };
        }
      }

      // Build order clause
      let order: any[] = [["created_at", "DESC"]];
      if (sort_by === "urgency") {
        order = [
          ["urgency", "DESC"],
          ["created_at", "DESC"],
        ];
      } else if (sort_by === "distance") {
        order = [
          ["distance_km", "ASC"],
          ["created_at", "DESC"],
        ];
      } else if (sort_by === "price") {
        order = [
          ["final_price", "DESC"],
          ["created_at", "DESC"],
        ];
      }

      const { count, rows: errands } = await models.Errand.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: models.User,
            as: "customer",
            attributes: ["id", "full_name", "phone_number", "avatar_url"],
          },
        ],
        order,
        limit: limitNum,
        offset: offset,
      });

      logger.info("Fetched available errands", {
        runnerId: req.user.userId,
        count: errands.length,
        filters: { category, urgency, max_distance },
      });

      return res.json({
        success: true,
        data: errands,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          pages: Math.ceil(count / limitNum),
        },
      });
    } catch (error: any) {
      return handleServiceError(error, res);
    }
  }

  /**
   * Get customer's errands with advanced filtering
   */
  async getMyRequests(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user.userId;
      const { status, page = 1, limit = 20 } = req.query;

      const pageNum = Math.max(1, parseInt(page as string, 10));
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit as string, 10))
      );
      const offset = (pageNum - 1) * limitNum;

      const whereConditions: any = { customer_id: customerId };

      if (status) {
        const parsedStatus = parseErrandStatus(status);
        if (parsedStatus) {
          whereConditions.status = parsedStatus;
        }
      }

      const { count, rows: errands } = await models.Errand.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: models.User,
            as: "runner",
            attributes: ["id", "full_name", "phone_number", "avatar_url"],
            include: [
              {
                model: models.Runner,
                as: "runner_profile",
                attributes: [
                  "rating",
                  "completed_errands",
                  "transportation_mode",
                ],
              },
            ],
          },
          {
            model: models.Transaction,
            as: "transaction",
            attributes: ["amount", "payment_status", "runner_earnings"],
          },
        ],
        order: [["created_at", "DESC"]],
        limit: limitNum,
        offset: offset,
      });

      return res.json({
        success: true,
        data: errands,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          pages: Math.ceil(count / limitNum),
        },
      });
    } catch (error: any) {
      return handleServiceError(error, res);
    }
  }

  /**
   * Get runner's jobs with proper status handling
   */
  async getMyJobs(req: AuthRequest, res: Response) {
    try {
      const runnerId = req.user.userId;
      const { status, page = 1, limit = 20 } = req.query;

      const pageNum = Math.max(1, parseInt(page as string, 10));
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit as string, 10))
      );
      const offset = (pageNum - 1) * limitNum;

      // Validate runner exists
      const runner = await models.Runner.findOne({
        where: { user_id: runnerId },
      });

      if (!runner) {
        return res.status(403).json({
          success: false,
          message: "Runner profile not found",
        });
      }

      if (status) {
        const parsedStatus = parseErrandStatus(status);

        if (!parsedStatus) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid status value. Allowed values: pending, accepted, in_progress, completed, cancelled",
          });
        }

        const { count, rows: jobs } = await models.Errand.findAndCountAll({
          where: {
            runner_id: runnerId,
            status: parsedStatus,
          },
          include: [
            {
              model: models.User,
              as: "customer",
              attributes: ["id", "full_name", "phone_number", "avatar_url"],
            },
            {
              model: models.Transaction,
              as: "transaction",
              attributes: ["amount", "payment_status", "runner_earnings"],
            },
          ],
          order: [["accepted_at", "DESC"]],
          limit: limitNum,
          offset: offset,
        });

        return res.json({
          success: true,
          data: jobs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count,
            pages: Math.ceil(count / limitNum),
          },
        });
      }

      // Get all active and completed jobs
      const statusValues = [
        ErrandStatus.ACCEPTED,
        ErrandStatus.IN_PROGRESS,
        ErrandStatus.COMPLETED,
      ];

      const { count, rows: allJobs } = await models.Errand.findAndCountAll({
        where: {
          runner_id: runnerId,
          status: { [Op.in]: statusValues },
        },
        include: [
          {
            model: models.User,
            as: "customer",
            attributes: ["id", "full_name", "phone_number", "avatar_url"],
          },
          {
            model: models.Transaction,
            as: "transaction",
            attributes: ["amount", "payment_status", "runner_earnings"],
          },
        ],
        order: [
          ["status", "ASC"],
          ["accepted_at", "DESC"],
        ],
        limit: limitNum,
        offset: offset,
      });

      const activeJobs = allJobs.filter(
        (job) =>
          job.status === ErrandStatus.ACCEPTED ||
          job.status === ErrandStatus.IN_PROGRESS
      );

      const completedJobs = allJobs.filter(
        (job) => job.status === ErrandStatus.COMPLETED
      );

      return res.json({
        success: true,
        data: { active: activeJobs, completed: completedJobs },
        counts: {
          active: activeJobs.length,
          completed: completedJobs.length,
          total: count,
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          pages: Math.ceil(count / limitNum),
        },
      });
    } catch (error: any) {
      return handleServiceError(error, res);
    }
  }

  /**
   * Accept an errand as a runner
   */
  async acceptErrand(req: AuthRequest, res: Response) {
    try {
      const errandId = validateIdParam(req.params.id)!; // Already validated by middleware
      const errand = await errandService.acceptErrand(
        errandId,
        req.user.userId
      );

      // WebSocket: Emit errand accepted event and join rooms
      socketService.emitErrandAccepted(errand);
      socketService.joinErrandRoom(errand.customer_id, errandId); // Customer
      socketService.joinErrandRoom(req.user.userId, errandId); // Runner

      logger.info("Errand accepted", {
        errandId,
        runnerId: req.user.userId,
      });

      return res.json({
        success: true,
        message: "Errand accepted successfully",
        data: errand,
      });
    } catch (error: any) {
      return handleServiceError(error, res);
    }
  }

  /**
   * Start an errand
   */
  async startErrand(req: AuthRequest, res: Response) {
    try {
      const errandId = validateIdParam(req.params.id)!;
      const errand = await errandService.startErrand(errandId, req.user.userId);

      // WebSocket: Emit errand status update
      socketService.emitErrandStatusUpdate({
        errandId: errand.id, // Use the actual errand object's ID
        status: errand.status, // Use the actual status from the updated errand
        message: `Errand has been started`,
        updatedBy: req.user.userId,
      });

      logger.info("Errand started", {
        errandId,
        runnerId: req.user.userId,
      });

      return res.json({
        success: true,
        message: "Errand started successfully",
        data: errand,
      });
    } catch (error: any) {
      return handleServiceError(error, res);
    }
  }

  /**
   * Complete an errand
   */
  async completeErrand(req: AuthRequest, res: Response) {
    try {
      const errandId = validateIdParam(req.params.id)!;
      const errand = await errandService.completeErrand(
        errandId,
        req.user.userId
      );

      // WebSocket: Emit errand completed event
      socketService.emitErrandCompleted(errand);

      logger.info("Errand completed", {
        errandId,
        runnerId: req.user.userId,
      });

      return res.json({
        success: true,
        message: "Errand completed successfully",
        data: errand,
      });
    } catch (error: any) {
      return handleServiceError(error, res);
    }
  }

  /**
   * Cancel an errand with reason
   */
  async cancelErrand(req: AuthRequest, res: Response) {
    try {
      const errandId = validateIdParam(req.params.id)!;
      const { reason } = req.body;

      const errand = await errandService.cancelErrand(
        errandId,
        req.user.userId,
        reason
      );

      // WebSocket: Emit errand status update for cancellation
      socketService.emitErrandStatusUpdate({
        errandId: errand.id,
        status: errand.status,
        message: `Errand cancelled: ${reason || "No reason provided"}`,
        updatedBy: req.user.userId,
      });

      logger.info("Errand cancelled", {
        errandId,
        userId: req.user.userId,
        reason: reason || "No reason provided",
      });

      return res.json({
        success: true,
        message: "Errand cancelled successfully",
        data: errand,
      });
    } catch (error: any) {
      return handleServiceError(error, res);
    }
  }

  /**
   * Get detailed errand information
   */
  async getErrandDetails(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.userId;
      const errandId = validateIdParam(req.params.id)!;

      const errand = await models.Errand.findByPk(errandId, {
        include: [
          {
            model: models.User,
            as: "customer",
            attributes: [
              "id",
              "full_name",
              "phone_number",
              "student_id",
              "avatar_url",
            ],
          },
          {
            model: models.User,
            as: "runner",
            attributes: ["id", "full_name", "phone_number", "avatar_url"],
            include: [
              {
                model: models.Runner,
                as: "runner_profile",
                attributes: [
                  "rating",
                  "completed_errands",
                  "transportation_mode",
                ],
              },
            ],
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
      });

      if (!errand) {
        return res.status(404).json({
          success: false,
          message: "Errand not found",
        });
      }

      // Authorization check
      const isCustomer = errand.customer_id === userId;
      const isRunner = errand.runner_id === userId;
      const isAdmin = req.user.role === "admin";

      if (!isCustomer && !isRunner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this errand",
        });
      }

      return res.json({
        success: true,
        data: errand,
      });
    } catch (error: any) {
      return handleServiceError(error, res);
    }
  }

  /**
   * Preview earnings calculation
   */
  async previewEarnings(req: AuthRequest, res: Response) {
    try {
      const { basePrice, category, urgency, distance } = req.body;

      const pricing = errandService.previewEarnings(
        parseFloat(basePrice),
        category as Category,
        (urgency || Urgency.STANDARD) as Urgency,
        distance ? parseFloat(distance) : 0
      );

      return res.json({
        success: true,
        data: pricing,
      });
    } catch (error: any) {
      return handleServiceError(error, res);
    }
  }

  /**
   * Get comprehensive errand statistics
   */
  async getErrandStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.userId;

      const runner = await models.Runner.findOne({
        where: { user_id: userId },
      });

      let stats: any = {};

      if (runner) {
        // Runner statistics
        const [
          completedCount,
          inProgressCount,
          acceptedCount,
          totalEarnings,
          weeklyEarnings,
          monthlyEarnings,
          totalJobs,
        ] = await Promise.all([
          models.Errand.count({
            where: { runner_id: userId, status: ErrandStatus.COMPLETED },
          }),
          models.Errand.count({
            where: { runner_id: userId, status: ErrandStatus.IN_PROGRESS },
          }),
          models.Errand.count({
            where: { runner_id: userId, status: ErrandStatus.ACCEPTED },
          }),
          models.Transaction.sum("runner_earnings", {
            where: { runner_id: userId, payment_status: "completed" },
          }),
          models.Transaction.sum("runner_earnings", {
            where: {
              runner_id: userId,
              payment_status: "completed",
              created_at: {
                [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          }),
          models.Transaction.sum("runner_earnings", {
            where: {
              runner_id: userId,
              payment_status: "completed",
              created_at: {
                [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          }),
          models.Errand.count({
            where: { runner_id: userId },
          }),
        ]);

        stats = {
          completed_errands: completedCount || 0,
          in_progress_errands: inProgressCount || 0,
          accepted_errands: acceptedCount || 0,
          total_earnings: totalEarnings || 0,
          weekly_earnings: weeklyEarnings || 0,
          monthly_earnings: monthlyEarnings || 0,
          total_jobs: totalJobs || 0,
          rating: runner.rating || 0,
          is_available: runner.is_available,
          completed_errands_count: runner.completed_errands || 0,
          success_rate:
            totalJobs > 0 ? Math.round((completedCount / totalJobs) * 100) : 0,
        };
      } else {
        // Customer statistics
        const [
          totalRequested,
          completedCount,
          pendingCount,
          inProgressCount,
          cancelledCount,
          totalSpent,
        ] = await Promise.all([
          models.Errand.count({ where: { customer_id: userId } }),
          models.Errand.count({
            where: { customer_id: userId, status: ErrandStatus.COMPLETED },
          }),
          models.Errand.count({
            where: { customer_id: userId, status: ErrandStatus.PENDING },
          }),
          models.Errand.count({
            where: { customer_id: userId, status: ErrandStatus.IN_PROGRESS },
          }),
          models.Errand.count({
            where: { customer_id: userId, status: ErrandStatus.CANCELLED },
          }),
          models.Transaction.sum("amount", {
            where: {
              customer_id: userId,
              payment_status: "completed",
            },
          }),
        ]);

        stats = {
          total_requested: totalRequested,
          completed_errands: completedCount,
          pending_errands: pendingCount,
          in_progress_errands: inProgressCount,
          cancelled_errands: cancelledCount,
          total_spent: totalSpent || 0,
          success_rate:
            totalRequested > 0
              ? Math.round((completedCount / totalRequested) * 100)
              : 0,
        };
      }

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      return handleServiceError(error, res);
    }
  }

  /**
   * Update errand details (customer only)
   */
  async updateErrand(req: AuthRequest, res: Response) {
    try {
      const errandId = validateIdParam(req.params.id)!;
      const { title, description, location_from, location_to } = req.body;

      const errand = await models.Errand.findByPk(errandId);
      if (!errand) {
        return res.status(404).json({
          success: false,
          message: "Errand not found",
        });
      }

      // Only customer can update their errand
      if (errand.customer_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this errand",
        });
      }

      // Only allow updates for pending errands
      if (errand.status !== ErrandStatus.PENDING) {
        return res.status(400).json({
          success: false,
          message: "Can only update pending errands",
        });
      }

      const updateData: any = {};
      if (title) updateData.title = title.trim();
      if (description) updateData.description = description.trim();
      if (location_from) updateData.location_from = location_from.trim();
      if (location_to) updateData.location_to = location_to.trim();

      await errand.update(updateData);

      // WebSocket: Emit errand updated event
      socketService.emitErrandStatusUpdate({
        errandId: errand.id,
        status: errand.status,
        message: "Errand details updated successfully",
        updatedBy: req.user.userId,
      });
      logger.info("Errand updated", {
        errandId,
        customerId: req.user.userId,
        updates: Object.keys(updateData),
      });

      const updatedErrand = await models.Errand.findByPk(errandId, {
        include: [
          {
            model: models.User,
            as: "customer",
            attributes: ["id", "full_name", "phone_number", "avatar_url"],
          },
        ],
      });

      return res.json({
        success: true,
        message: "Errand updated successfully",
        data: updatedErrand,
      });
    } catch (error: any) {
      return handleServiceError(error, res);
    }
  }
}

export default new ErrandController();
