import { Request, Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import adminService from "../services/adminService";

class AdminController {
  // Platform Overview Dashboard
  async getPlatformOverview(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const overview = await adminService.getPlatformOverview();
      return res.json({ success: true, data: overview });
    } catch (error: any) {
      console.error("Get platform overview error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching platform overview",
      });
    }
  }

  // Advanced Analytics
  async getAnalytics(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { period = "7d" } = req.query;
      const analytics = await adminService.getAnalytics(period as string);
      return res.json({ success: true, data: analytics });
    } catch (error: any) {
      console.error("Get analytics error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching analytics",
      });
    }
  }

  // User Management
  async getUsers(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { page, limit, search, user_type, verification_status } = req.query;
      const users = await adminService.getUsers({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        search: search as string,
        user_type: user_type as string,
        verification_status: verification_status as string,
      });
      return res.json({ success: true, data: users });
    } catch (error: any) {
      console.error("Get users error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching users",
      });
    }
  }

  async updateUser(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = parseInt(req.params.id);
      const { verification_status, is_active, user_type, is_admin } = req.body;
      
      const updatedUser = await adminService.updateUser(userId, {
        verification_status,
        is_active,
        user_type,
        is_admin,
      });
      
      return res.json({
        success: true,
        message: "User updated successfully",
        data: updatedUser,
      });
    } catch (error: any) {
      console.error("Update user error:", error);
      if (error.message === "User not found") {
        return res.status(404).json({ success: false, message: error.message });
      }
      return res.status(500).json({
        success: false,
        message: "Internal server error while updating user",
      });
    }
  }

  // Errand Management
  async getErrands(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { page, limit, status, category, date_from, date_to } = req.query;
      const errands = await adminService.getErrands({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        status: status as string,
        category: category as string,
        date_from: date_from as string,
        date_to: date_to as string,
      });
      return res.json({ success: true, data: errands });
    } catch (error: any) {
      console.error("Get errands error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching errands",
      });
    }
  }

  async updateErrand(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const errandId = parseInt(req.params.id);
      const { status, final_price, runner_id } = req.body;
      
      const updatedErrand = await adminService.updateErrand(errandId, {
        status,
        final_price,
        runner_id,
      });
      
      return res.json({
        success: true,
        message: "Errand updated successfully",
        data: updatedErrand,
      });
    } catch (error: any) {
      console.error("Update errand error:", error);
      if (error.message === "Errand not found") {
        return res.status(404).json({ success: false, message: error.message });
      }
      return res.status(500).json({
        success: false,
        message: "Internal server error while updating errand",
      });
    }
  }

  // Financial Management
  async getTransactions(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { page, limit, payment_status, date_from, date_to } = req.query;
      const transactions = await adminService.getTransactions({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        payment_status: payment_status as string,
        date_from: date_from as string,
        date_to: date_to as string,
      });
      return res.json({ success: true, data: transactions });
    } catch (error: any) {
      console.error("Get transactions error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching transactions",
      });
    }
  }

  // Review Management
  async getReviews(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { page, limit, rating } = req.query;
      const reviews = await adminService.getReviews({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        rating: rating as string,
      });
      return res.json({ success: true, data: reviews });
    } catch (error: any) {
      console.error("Get reviews error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching reviews",
      });
    }
  }

  // Runner Management
  async getRunners(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { page, limit, is_approved, search } = req.query;
      const runners = await adminService.getRunners({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        is_approved: is_approved as string,
        search: search as string,
      });
      return res.json({ success: true, data: runners });
    } catch (error: any) {
      console.error("Get runners error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching runners",
      });
    }
  }

  async updateRunner(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const runnerId = parseInt(req.params.id);
      const { is_approved, rejection_reason, is_available } = req.body;
      
      const updatedRunner = await adminService.updateRunner(runnerId, {
        is_approved,
        rejection_reason,
        is_available,
      });
      
      return res.json({
        success: true,
        message: "Runner updated successfully",
        data: updatedRunner,
      });
    } catch (error: any) {
      console.error("Update runner error:", error);
      if (error.message === "Runner not found") {
        return res.status(404).json({ success: false, message: error.message });
      }
      return res.status(500).json({
        success: false,
        message: "Internal server error while updating runner",
      });
    }
  }

  // Report Management
  async getReports(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { page, limit, status, report_type } = req.query;
      const reports = await adminService.getReports({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        status: status as string,
        report_type: report_type as string,
      });
      return res.json({ success: true, data: reports });
    } catch (error: any) {
      console.error("Get reports error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching reports",
      });
    }
  }

  async updateReport(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const reportId = parseInt(req.params.id);
      const { status, admin_notes } = req.body;
      
      const updatedReport = await adminService.updateReport(reportId, {
        status,
        admin_notes,
      });
      
      return res.json({
        success: true,
        message: "Report updated successfully",
        data: updatedReport,
      });
    } catch (error: any) {
      console.error("Update report error:", error);
      if (error.message === "Report not found") {
        return res.status(404).json({ success: false, message: error.message });
      }
      return res.status(500).json({
        success: false,
        message: "Internal server error while updating report",
      });
    }
  }

  // System Health
  async getSystemHealth(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const health = await adminService.getSystemHealth();
      return res.status(200).json({ success: true, data: health });
    } catch (error: any) {
      console.error("Get system health error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while checking system health",
      });
    }
  }
}

export default new AdminController();