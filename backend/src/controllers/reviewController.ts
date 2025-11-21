import { Request, Response } from "express";
import models from "../models";
import { AuthRequest } from "../middleware/authMiddleware";
import trustScoreService from "../services/trustScoreService";
import logger from "../utils/logger";
import { validationResult, body } from "express-validator";
import redisClient from "../config/redis";
import sanitizeHtml from "sanitize-html";

// Constants
const CONSTANTS = {
  MIN_RATING: 1,
  MAX_RATING: 5,
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_COMMENT_LENGTH: 500,
  CACHE_TTL: 300, // 5 minutes
  TRUST_SCORE_DEFAULT: 50,
} as const;

// Interfaces
interface ReviewSubmission {
  errand_id: number;
  rating: number;
  comment?: string;
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  trustScore: number;
  trustBadge: string;
}

interface PaginatedReviewsResponse {
  reviews: any[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  averageRating?: number;
}

interface AverageRatingResult {
  avgRating?: string | number | null;
}

class ReviewController {
  // Validation rules
  private static submitReviewValidation = [
    body("errand_id")
      .isInt({ min: 1 })
      .withMessage("Valid errand ID is required"),
    body("rating")
      .isInt({ min: CONSTANTS.MIN_RATING, max: CONSTANTS.MAX_RATING })
      .withMessage(
        `Rating must be between ${CONSTANTS.MIN_RATING} and ${CONSTANTS.MAX_RATING}`
      ),
    body("comment")
      .optional()
      .isLength({ max: CONSTANTS.MAX_COMMENT_LENGTH })
      .withMessage(
        `Comment must not exceed ${CONSTANTS.MAX_COMMENT_LENGTH} characters`
      ),
  ];

  // Submit a review for completed errand
  async submitReview(req: AuthRequest, res: Response): Promise<Response> {
    const transaction = await models.sequelize.transaction();

    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const userId = req.user.userId;
      const { errand_id, rating, comment }: ReviewSubmission = req.body;

      // Sanitize comment
      const sanitizedComment = comment
        ? this.sanitizeComment(comment)
        : undefined;

      // Find errand with transaction lock to prevent duplicate reviews
      const errand = await models.Errand.findByPk(errand_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!errand) {
        await transaction.rollback();
        logger.warn("Errand not found", { errand_id, userId });
        return res.status(404).json({
          success: false,
          message: "Errand not found",
        });
      }

      // Check if errand is completed
      if (errand.status !== "completed") {
        await transaction.rollback();
        logger.warn("Attempt to review incomplete errand", {
          errand_id,
          userId,
          status: errand.status,
        });
        return res.status(400).json({
          success: false,
          message: "Can only review completed errands",
        });
      }

      // Check if user is involved in this errand
      const isCustomer = errand.customer_id === userId;
      const isRunner = errand.runner_id === userId;

      if (!isCustomer && !isRunner) {
        await transaction.rollback();
        logger.warn("Unauthorized review attempt", { errand_id, userId });
        return res.status(403).json({
          success: false,
          message: "You can only review errands you are involved in",
        });
      }

      const reviewer_id = userId;
      const reviewee_id = isCustomer ? errand.runner_id : errand.customer_id;

      // Handle the case where reviewee_id might be undefined
      if (reviewee_id === undefined || reviewee_id === null) {
        await transaction.rollback();
        logger.error("Reviewee ID not found", {
          errand_id,
          isCustomer,
          isRunner,
        });
        return res.status(400).json({
          success: false,
          message: "Cannot determine the user to review",
        });
      }

      // Check for existing review within transaction
      const existingReview = await models.Review.findOne({
        where: { errand_id, reviewer_id },
        transaction,
      });

      if (existingReview) {
        await transaction.rollback();
        logger.warn("Duplicate review attempt", { errand_id, reviewer_id });
        return res.status(409).json({
          success: false,
          message: "You have already reviewed this errand",
        });
      }

      // Create review
      const type = isCustomer ? "customer_to_runner" : "runner_to_customer";

      const review = await models.Review.create(
        {
          errand_id,
          reviewer_id,
          reviewee_id,
          rating,
          comment: sanitizedComment,
          type,
        },
        { transaction }
      );

      await transaction.commit();

      // Invalidate cache for both users
      await this.invalidateUserCache(reviewer_id);
      await this.invalidateUserCache(reviewee_id);

      // Background tasks
      this.handleBackgroundTasks(
        reviewer_id,
        reviewee_id,
        isCustomer ? errand.runner_id ?? null : null,
        isCustomer
      );

      // Fetch review with details
      const reviewWithDetails = await this.getReviewWithDetails(review.id);

      logger.info("Review submitted successfully", {
        reviewId: review.id,
        errand_id,
        reviewer_id,
        reviewee_id,
      });

      return res.status(201).json({
        success: true,
        message: "Review submitted successfully",
        data: reviewWithDetails,
      });
    } catch (error) {
      await transaction.rollback();
      logger.error("Submit review error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.userId,
        errand_id: req.body.errand_id,
      });

      return res.status(500).json({
        success: false,
        message: "Internal server error while submitting review",
      });
    }
  }

  // Get reviews for a user
  async getUserReviews(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = parseInt(req.params.userId);
      const {
        type = "received",
        page = CONSTANTS.DEFAULT_PAGE,
        limit = CONSTANTS.DEFAULT_LIMIT,
      } = req.query;

      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      const pageNum = Math.max(
        1,
        parseInt(page as string) || CONSTANTS.DEFAULT_PAGE
      );
      const limitNum = Math.min(
        50,
        Math.max(1, parseInt(limit as string) || CONSTANTS.DEFAULT_LIMIT)
      );
      const offset = (pageNum - 1) * limitNum;

      // Generate cache key
      const cacheKey = `reviews:${userId}:${type}:${pageNum}:${limitNum}`;

      // Try cache first
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      const whereClause =
        type === "received" ? { reviewee_id: userId } : { reviewer_id: userId };

      const [reviews, totalCount] = await Promise.all([
        this.fetchReviewsWithFallback(whereClause, limitNum, offset),
        models.Review.count({ where: whereClause }),
      ]);

      // Calculate average rating for received reviews
      let averageRating = 0;
      if (type === "received") {
        averageRating = await this.calculateAverageRating(userId);
      }

      const response: PaginatedReviewsResponse = {
        reviews,
        averageRating: Math.round(averageRating * 100) / 100,
        totalCount,
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
      };

      // Cache the response
      await redisClient.setex(
        cacheKey,
        CONSTANTS.CACHE_TTL,
        JSON.stringify(response)
      );

      return res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error("Get user reviews error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.params.userId,
      });

      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching reviews",
      });
    }
  }

  // Get review statistics for a user
  async getReviewStats(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      // Cache key for stats
      const cacheKey = `review_stats:${userId}`;

      // Try cache first
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      const stats = await this.calculateReviewStats(userId);

      // Cache stats
      await redisClient.setex(
        cacheKey,
        CONSTANTS.CACHE_TTL,
        JSON.stringify(stats)
      );

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error("Get review stats error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.params.userId,
      });

      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching review statistics",
      });
    }
  }

  // Private helper methods
  private sanitizeComment(comment: string): string {
    return sanitizeHtml(comment, {
      allowedTags: [], // No HTML tags allowed
      allowedAttributes: {},
    }).trim();
  }

  private async invalidateUserCache(userId: number): Promise<void> {
    try {
      // Since we don't have SCAN, we'll track cache keys in a separate set
      // For now, we'll delete the known patterns directly
      const cachePatterns = [
        `reviews:${userId}:received:*`,
        `reviews:${userId}:given:*`,
        `review_stats:${userId}`,
      ];

      // In a production environment, you might want to implement a more sophisticated
      // cache key tracking system, but for now we'll delete what we know
      const keysToDelete: string[] = [];

      // Add the main cache keys we know about
      for (let page = 1; page <= 5; page++) {
        // Assume max 5 pages
        for (let limit of [10, 20, 50]) {
          keysToDelete.push(`reviews:${userId}:received:${page}:${limit}`);
          keysToDelete.push(`reviews:${userId}:given:${page}:${limit}`);
        }
      }
      keysToDelete.push(`review_stats:${userId}`);

      // Delete all known keys
      for (const key of keysToDelete) {
        try {
          await redisClient.del(key);
        } catch (error) {
          // Log but don't fail the entire operation
          logger.warn("Failed to delete cache key", { key, error });
        }
      }

      logger.info("User cache invalidated", {
        userId,
        keysDeleted: keysToDelete.length,
      });
    } catch (error) {
      logger.error("Cache invalidation error", { userId, error });
    }
  }

  private async handleBackgroundTasks(
    reviewer_id: number,
    reviewee_id: number,
    runner_id: number | null,
    isCustomer: boolean
  ): Promise<void> {
    try {
      const tasks: Promise<unknown>[] = [];

      // Update runner rating if applicable
      if (isCustomer && runner_id) {
        tasks.push(this.updateRunnerRating(runner_id));
      }

      // Update trust scores
      tasks.push(
        trustScoreService.calculateTrustScore(reviewer_id),
        trustScoreService.calculateTrustScore(reviewee_id)
      );

      // Execute all background tasks
      const results = await Promise.allSettled(tasks);

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          logger.error("Background task failed", {
            taskIndex: index,
            error: result.reason,
          });
        }
      });
    } catch (error) {
      logger.error("Background tasks error", { error });
    }
  }

  private async getReviewWithDetails(reviewId: number): Promise<any> {
    try {
      return await models.Review.findByPk(reviewId, {
        include: [
          {
            model: models.User,
            as: "reviewer",
            attributes: ["id", "full_name", "avatar_url"],
          },
          {
            model: models.User,
            as: "reviewee",
            attributes: ["id", "full_name", "avatar_url"],
          },
        ],
      });
    } catch (error) {
      logger.error("Error fetching review details", { reviewId, error });
      // Fallback to basic review
      return await models.Review.findByPk(reviewId);
    }
  }

  private async fetchReviewsWithFallback(
    whereClause: any,
    limit: number,
    offset: number
  ): Promise<any[]> {
    try {
      return await models.Review.findAll({
        where: whereClause,
        include: [
          {
            model: models.User,
            as: "reviewer",
            attributes: ["id", "full_name", "avatar_url", "student_id"],
          },
          {
            model: models.User,
            as: "reviewee",
            attributes: ["id", "full_name", "avatar_url", "student_id"],
          },
        ],
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });
    } catch (error) {
      logger.error("Error fetching reviews with includes", { error });
      // Fallback without includes
      return await models.Review.findAll({
        where: whereClause,
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });
    }
  }

  private async calculateAverageRating(userId: number): Promise<number> {
    try {
      const result = await models.Review.findOne({
        where: { reviewee_id: userId },
        attributes: [
          [
            models.sequelize.fn("AVG", models.sequelize.col("rating")),
            "avgRating",
          ],
        ],
        raw: true,
      });

      // Properly type the result and handle the avgRating
      const typedResult = result as unknown as AverageRatingResult;
      const avgRating = typedResult?.avgRating;

      if (avgRating === null || avgRating === undefined) {
        return 0;
      }

      return parseFloat(avgRating as string) || 0;
    } catch (error) {
      logger.error("Error calculating average rating", { userId, error });
      return 0;
    }
  }

  private async calculateReviewStats(userId: number): Promise<ReviewStats> {
    const reviews = await models.Review.findAll({
      where: { reviewee_id: userId },
      attributes: ["rating"],
    });

    const ratingDistribution: Record<number, number> = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };
    let totalRating = 0;

    reviews.forEach((review) => {
      const rating = review.rating;
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating]++;
        totalRating += review.rating;
      }
    });

    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    // Calculate trust score with fallback
    let trustScore: number = CONSTANTS.TRUST_SCORE_DEFAULT;
    let trustBadge = "New";

    try {
      trustScore = await trustScoreService.calculateTrustScore(userId);
      trustBadge = trustScoreService.getTrustBadge(trustScore);
    } catch (error) {
      logger.error("Trust score calculation failed", { userId, error });
    }

    return {
      totalReviews: reviews.length,
      averageRating: Math.round(averageRating * 100) / 100,
      ratingDistribution,
      trustScore,
      trustBadge,
    };
  }

  private async updateRunnerRating(runnerUserId: number): Promise<void> {
    try {
      const avgResult = await models.Review.findOne({
        where: { reviewee_id: runnerUserId },
        attributes: [
          [
            models.sequelize.fn("AVG", models.sequelize.col("rating")),
            "avgRating",
          ],
        ],
        raw: true,
      });

      // Properly type the result and handle the avgRating
      const typedResult = avgResult as unknown as AverageRatingResult;
      const avgRating = typedResult?.avgRating;

      const averageRating = avgRating ? parseFloat(avgRating as string) : 0;

      await models.Runner.update(
        {
          rating: Math.round(averageRating * 100) / 100,
          updated_at: new Date(),
        },
        { where: { user_id: runnerUserId } }
      );
    } catch (error) {
      logger.error("Update runner rating error", { runnerUserId, error });
    }
  }

  // Get validation rules
  static getValidationRules() {
    return this.submitReviewValidation;
  }
}

export default new ReviewController();
