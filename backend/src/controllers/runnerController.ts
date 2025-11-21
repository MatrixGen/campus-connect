import { Request, Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import runnerService from "../services/runnerService";
import validationService from "../services/validationService";

class RunnerController {
  // Register as a runner
  async registerRunner(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user.userId;
      const {
        areas_covered,
        transportation_mode,
        id_card_url,
        student_card_url,
      } = req.body;

      // Validate input
      const validation = validationService.validateRunnerRegistration(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.message,
        });
      }

      // Check if user already has a runner profile
      const hasExistingRunner = await runnerService.checkExistingRunner(userId);
      if (hasExistingRunner) {
        return res.status(400).json({
          success: false,
          message: "You are already registered as a runner",
        });
      }

      // Update user type
      await runnerService.updateUserType(userId);

      // Create runner profile
      const runner = await runnerService.createRunnerProfile(userId, {
        areas_covered,
        transportation_mode,
        id_card_url,
        student_card_url,
      });

      return res.status(201).json({
        success: true,
        message: "Runner registration submitted for approval",
        data: runner,
      });
    } catch (error: any) {
      console.error("Runner registration error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during runner registration",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Get runner profile
  async getRunnerProfile(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user.userId;

      const runner = await runnerService.getRunnerByUserId(userId);
      if (!runner) {
        return res.status(404).json({
          success: false,
          message: "Runner profile not found",
        });
      }

      const statistics = await runnerService.getRunnerStatistics(userId);

      return res.json({
        success: true,
        data: {
          profile: runner,
          statistics: {
            ...statistics,
            average_rating: parseFloat(runner.rating.toString()),
            total_distance_covered: parseFloat(
              runner.total_distance_covered.toString()
            ),
            cancellation_rate: parseFloat(runner.cancellation_rate.toString()),
          },
        },
      });
    } catch (error: any) {
      console.error("Get runner profile error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching runner profile",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Update runner profile
  async updateRunnerProfile(
    req: AuthRequest,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.user.userId;

      // Validate input
      const validation = validationService.validateRunnerUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.message,
        });
      }

      const updatedRunner = await runnerService.updateRunnerProfile(
        userId,
        req.body
      );

      return res.json({
        success: true,
        message: "Runner profile updated successfully",
        data: updatedRunner,
      });
    } catch (error: any) {
      console.error("Update runner profile error:", error);
      if (error.message === "Runner profile not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error while updating runner profile",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Get nearby runners
  // Get nearby runners - FIXED
  async getNearbyRunners(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { area, page, limit } = req.query;
      const areaString = typeof area === "string" ? area : undefined;
      const pageNumber = typeof page === "string" ? parseInt(page) : 1;
      const limitNumber = typeof limit === "string" ? parseInt(limit) : 20;

      const result = await runnerService.getNearbyRunners(
        areaString,
        pageNumber,
        limitNumber
      );

      return res.json({
        success: true,
        data: result.runners,
        count: result.runners.length,
        total: result.total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(result.total / limitNumber),
      });
    } catch (error: any) {
      console.error("Get nearby runners error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching nearby runners",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Get runner dashboard
  async getRunnerDashboard(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user.userId;

      const dashboardData = await runnerService.getRunnerDashboard(userId);

      return res.json({
        success: true,
        data: dashboardData,
      });
    } catch (error: any) {
      console.error("Get runner dashboard error:", error);
      if (error.message === "Runner profile not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching dashboard data",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Get approval status
  async getApprovalStatus(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user.userId;

      const runner = await runnerService.getRunnerByUserId(userId);
      if (!runner) {
        return res.status(404).json({
          success: false,
          message: "Runner profile not found",
        });
      }

      return res.json({
        success: true,
        data: {
          is_approved: runner.is_approved,
          documents_verified: runner.documents_verified,
          approved_at: runner.approved_at,
          rejection_reason: runner.rejection_reason,
          documents: {
            id_card_url: runner.id_card_url,
            student_card_url: runner.student_card_url,
          },
        },
      });
    } catch (error: any) {
      console.error("Get approval status error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching approval status",
      });
    }
  }

  // Get earnings breakdown
  async getEarningsBreakdown(
    req: AuthRequest,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.user.userId;
      const { period = "month" } = req.query;

      const earningsBreakdown = await runnerService.getEarningsBreakdown(
        userId,
        period as string
      );

      return res.json({
        success: true,
        data: earningsBreakdown,
      });
    } catch (error: any) {
      console.error("Get earnings breakdown error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching earnings breakdown",
      });
    }
  }
}

export default new RunnerController();
