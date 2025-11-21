import { Request, Response } from "express";
import { Op } from "sequelize"; // Import Op directly
import models from "../models";
import { AuthRequest } from "../middleware/authMiddleware";
import trustScoreService from "../services/trustScoreService";

class ReportController {
  // Submit a report
  async submitReport(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const reporterId = req.user.userId;
      const {
        reported_user_id,
        errand_id,
        report_type,
        title,
        description,
        evidence_urls,
      } = req.body;

      // Validate required fields
      if (!reported_user_id || !report_type || !title || !description) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: reported_user_id, report_type, title, description",
        });
      }

      // Check if user is reporting themselves
      if (reporterId === reported_user_id) {
        return res.status(400).json({
          success: false,
          message: "You cannot report yourself",
        });
      }

      // Check if reported user exists
      const reportedUser = await models.User.findByPk(reported_user_id);
      if (!reportedUser) {
        return res.status(404).json({
          success: false,
          message: "Reported user not found",
        });
      }

      // Check if errand exists (if provided)
      if (errand_id) {
        const errand = await models.Errand.findByPk(errand_id);
        if (!errand) {
          return res.status(404).json({
            success: false,
            message: "Errand not found",
          });
        }

        // Check if reporter is involved in the errand
        if (
          errand.customer_id !== reporterId &&
          errand.runner_id !== reporterId
        ) {
          return res.status(403).json({
            success: false,
            message:
              "You can only report users you have interacted with in an errand",
          });
        }
      }

      // Check for duplicate recent reports
      const recentReport = await models.Report.findOne({
        where: {
          reporter_id: reporterId,
          reported_user_id: reported_user_id,
          report_type,
          created_at: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours
          },
        },
      });

      if (recentReport) {
        return res.status(400).json({
          success: false,
          message:
            "You have already submitted a similar report for this user recently",
        });
      }

      // Create report
      const report = await models.Report.create({
        reporter_id: reporterId,
        reported_user_id,
        errand_id,
        report_type,
        title,
        description,
        evidence_urls: evidence_urls || [],
        status: "pending",
      });

      // Update trust score for reported user
      try {
        await trustScoreService.calculateTrustScore(reported_user_id);
      } catch (error) {
        console.error("Trust score calculation failed:", error);
        // Continue with the response since report was created successfully
      }

      // Fetch report with details
      const reportWithDetails = await models.Report.findByPk(report.id, {
        include: [
          {
            model: models.User,
            as: "reporter",
            attributes: ["id", "full_name"],
          },
          {
            model: models.User,
            as: "reported_user",
            attributes: ["id", "full_name", "student_id"],
          },
          {
            model: models.Errand,
            as: "errand",
            attributes: ["id", "title", "category"],
          },
        ],
      });

      return res.status(201).json({
        success: true,
        message:
          "Report submitted successfully. Our team will review it shortly.",
        data: reportWithDetails,
      });
    } catch (error) {
      console.error("Submit report error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while submitting report",
      });
    }
  }

  // Get user's reports (made by them)
  async getMyReports(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user.userId;
      const { page = 1, limit = 10 } = req.query;

      const reports = await models.Report.findAll({
        where: { reporter_id: userId },
        include: [
          {
            model: models.User,
            as: "reported_user",
            attributes: ["id", "full_name", "student_id"],
          },
          {
            model: models.Errand,
            as: "errand",
            attributes: ["id", "title", "category"],
          },
        ],
        order: [["created_at", "DESC"]],
        limit: parseInt(limit as string),
        offset: (parseInt(page as string) - 1) * parseInt(limit as string),
      });

      const totalCount = await models.Report.count({
        where: { reporter_id: userId },
      });

      return res.json({
        success: true,
        data: {
          reports,
          totalCount,
          currentPage: parseInt(page as string),
          totalPages: Math.ceil(totalCount / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error("Get my reports error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching reports",
      });
    }
  }

  // Get reports against a user
  async getReportsAgainstMe(
    req: AuthRequest,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.user.userId;
      const { page = 1, limit = 10 } = req.query;

      const reports = await models.Report.findAll({
        where: { reported_user_id: userId },
        include: [
          {
            model: models.User,
            as: "reporter",
            attributes: ["id", "full_name", "student_id"],
          },
          {
            model: models.Errand,
            as: "errand",
            attributes: ["id", "title", "category"],
          },
        ],
        order: [["created_at", "DESC"]],
        limit: parseInt(limit as string),
        offset: (parseInt(page as string) - 1) * parseInt(limit as string),
      });

      const totalCount = await models.Report.count({
        where: { reported_user_id: userId },
      });

      return res.json({
        success: true,
        data: {
          reports,
          totalCount,
          currentPage: parseInt(page as string),
          totalPages: Math.ceil(totalCount / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error("Get reports against me error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching reports",
      });
    }
  }

  // Fraud detection - check if user shows suspicious patterns
  async checkFraudPatterns(userId: number): Promise<string[]> {
    const warnings: string[] = [];

    try {
      // Check for multiple recent cancellations
      const recentCancellations = await models.Errand.count({
        where: {
          runner_id: userId,
          status: "cancelled",
          created_at: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        },
      });

      if (recentCancellations >= 3) {
        warnings.push("High cancellation rate detected");
      }

      // Check for multiple reports in short time
      const recentReports = await models.Report.count({
        where: {
          reported_user_id: userId,
          status: "resolved",
          created_at: {
            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        },
      });

      if (recentReports >= 2) {
        warnings.push("Multiple reports received recently");
      }

      // Check trust score
      const trustScore = await trustScoreService.calculateTrustScore(userId);
      if (trustScore < 30) {
        warnings.push("Low trust score detected");
      }

      return warnings;
    } catch (error) {
      console.error("Fraud pattern check error:", error);
      return warnings;
    }
  }
}

export default new ReportController();
