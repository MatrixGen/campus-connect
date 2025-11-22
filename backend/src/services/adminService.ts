import { Op, Sequelize } from "sequelize";
import models from "../models";
import sequelize from "../config/database";

export class AdminService {
  // Platform Overview
  async getPlatformOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [
      totalUsers,
      totalRunners,
      totalCustomers,
      totalErrands,
      completedErrands,
      pendingErrands,
      totalTransactions,
      totalRevenue,
      todayUsers,
      todayErrands,
      todayRevenue,
      lastWeekUsers,
      platformEarnings
    ] = await Promise.all([
      models.User.count(),
      models.Runner.count({ where: { is_approved: true } }),
      models.User.count({ where: { user_type: "customer" } }),
      models.Errand.count(),
      models.Errand.count({ where: { status: "completed" } }),
      models.Errand.count({ where: { status: "pending" } }),
      models.Transaction.count({ where: { payment_status: "completed" } }),
      models.Transaction.sum("amount", { where: { payment_status: "completed" } }) || 0,
      models.User.count({ where: { created_at: { [Op.gte]: today } } }),
      models.Errand.count({ where: { created_at: { [Op.gte]: today } } }),
      models.Transaction.sum("amount", {
        where: { payment_status: "completed", created_at: { [Op.gte]: today } }
      }) || 0,
      models.User.count({ where: { created_at: { [Op.gte]: oneWeekAgo, [Op.lt]: today } } }),
      models.Transaction.sum("platform_fee", { where: { payment_status: "completed" } }) || 0
    ]);

    const userGrowth = lastWeekUsers > 0
      ? (((todayUsers - lastWeekUsers) / lastWeekUsers) * 100).toFixed(1)
      : "0.0";

    const topRunners = await models.Runner.findAll({
      where: { is_approved: true },
      order: [["earnings", "DESC"]],
      limit: 5,
      include: [{
        model: models.User,
        as: "user",
        attributes: ["id", "full_name", "phone_number"],
      }],
    });

    const recentErrands = await models.Errand.findAll({
      order: [["created_at", "DESC"]],
      limit: 10,
      include: [
        {
          model: models.User,
          as: "customer",
          attributes: ["id", "full_name", "phone_number"],
        },
        {
          model: models.User,
          as: "runner",
          attributes: ["id", "full_name", "phone_number"],
          required: false,
        },
      ],
    });

    return {
      platform_stats: {
        total_users: totalUsers,
        total_runners: totalRunners,
        total_customers: totalCustomers,
        total_errands: totalErrands,
        completed_errands: completedErrands,
        pending_errands: pendingErrands,
        completion_rate: totalErrands > 0 ? ((completedErrands / totalErrands) * 100).toFixed(1) : 0,
        total_transactions: totalTransactions,
        total_revenue: totalRevenue,
        platform_earnings: platformEarnings,
      },
      today_stats: {
        new_users: todayUsers,
        new_errands: todayErrands,
        today_revenue: todayRevenue,
        user_growth: userGrowth,
      },
      top_performers: topRunners,
      recent_activities: recentErrands,
    };
  }

  // Analytics
  async getAnalytics(period: string = "7d") {
    let days: number;
    switch (period) {
      case "30d": days = 30; break;
      case "90d": days = 90; break;
      default: days = 7;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [errandsByDate, revenueByDate, errandsByCategory, usersByDate] = await Promise.all([
      this.getErrandsByDate(startDate),
      this.getRevenueByDate(startDate),
      this.getErrandsByCategory(startDate),
      this.getUsersByDate(startDate),
    ]);

    return {
      period,
      errands_trend: errandsByDate,
      revenue_trend: revenueByDate,
      category_distribution: errandsByCategory,
      user_growth: usersByDate,
      summary: {
        total_days: days,
        start_date: startDate.toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
      },
    };
  }

  private async getErrandsByDate(startDate: Date) {
    return models.Errand.findAll({
      attributes: [
        [Sequelize.fn("DATE", Sequelize.col("created_at")), "date"],
        [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
        [Sequelize.fn("SUM", Sequelize.literal(`CASE WHEN status = 'completed' THEN 1 ELSE 0 END`)), "completed"],
      ],
      where: { created_at: { [Op.gte]: startDate } },
      group: [Sequelize.fn("DATE", Sequelize.col("created_at"))],
      order: [[Sequelize.fn("DATE", Sequelize.col("created_at")), "ASC"]],
      raw: true,
    });
  }

  private async getRevenueByDate(startDate: Date) {
    return models.Transaction.findAll({
      attributes: [
        [Sequelize.fn("DATE", Sequelize.col("created_at")), "date"],
        [Sequelize.fn("SUM", Sequelize.col("amount")), "revenue"],
        [Sequelize.fn("SUM", Sequelize.col("platform_fee")), "platform_earnings"],
      ],
      where: { payment_status: "completed", created_at: { [Op.gte]: startDate } },
      group: [Sequelize.fn("DATE", Sequelize.col("created_at"))],
      order: [[Sequelize.fn("DATE", Sequelize.col("created_at")), "ASC"]],
      raw: true,
    });
  }

  private async getErrandsByCategory(startDate: Date) {
    return models.Errand.findAll({
      attributes: [
        "category",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
        [Sequelize.fn("AVG", Sequelize.col("final_price")), "avg_price"],
      ],
      where: { created_at: { [Op.gte]: startDate } },
      group: ["category"],
      raw: true,
    });
  }

  private async getUsersByDate(startDate: Date) {
    return models.User.findAll({
      attributes: [
        [Sequelize.fn("DATE", Sequelize.col("created_at")), "date"],
        [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
      ],
      where: { created_at: { [Op.gte]: startDate } },
      group: [Sequelize.fn("DATE", Sequelize.col("created_at"))],
      order: [[Sequelize.fn("DATE", Sequelize.col("created_at")), "ASC"]],
      raw: true,
    });
  }

  // User Management
  async getUsers(filters: {
    page?: number;
    limit?: number;
    search?: string;
    user_type?: string;
    verification_status?: string;
  }) {
    const { page = 1, limit = 20, search, user_type, verification_status } = filters;
    const offset = (page - 1) * limit;

    const whereClause: any = {};
    
    if (search) {
      whereClause[Op.or] = [
        { full_name: { [Op.iLike]: `%${search}%` } },
        { phone_number: { [Op.iLike]: `%${search}%` } },
        { student_id: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (user_type) whereClause.user_type = user_type;
    if (verification_status) whereClause.verification_status = verification_status;

    const { count, rows: users } = await models.User.findAndCountAll({
      where: whereClause,
      include: [{
        model: models.Runner,
        as: "runner_profile",
        required: false,
      }],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    return {
      users,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(count / limit),
        total_users: count,
        has_next: offset + users.length < count,
        has_prev: page > 1,
      },
    };
  }

  async updateUser(userId: number, updateData: {
    verification_status?: string;
    is_active?: boolean;
    user_type?: string;
    is_admin?: boolean;
  }) {
    const user = await models.User.findByPk(userId);
    if (!user) throw new Error("User not found");

    const updatePayload: any = { ...updateData };

    if (updateData.is_admin && user.user_type !== "admin") {
      updatePayload.user_type = "admin";
    }

    await user.update(updatePayload);

    return models.User.findByPk(userId, {
      include: [{
        model: models.Runner,
        as: "runner_profile",
        required: false,
      }],
    });
  }

  // Errand Management
  async getErrands(filters: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    date_from?: string;
    date_to?: string;
  }) {
    const { page = 1, limit = 20, status, category, date_from, date_to } = filters;
    const offset = (page - 1) * limit;

    const whereClause: any = {};
    if (status) whereClause.status = status;
    if (category) whereClause.category = category;

    if (date_from || date_to) {
      whereClause.created_at = {};
      if (date_from) whereClause.created_at[Op.gte] = new Date(date_from);
      if (date_to) whereClause.created_at[Op.lte] = new Date(date_to);
    }

    const { count, rows: errands } = await models.Errand.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: "customer",
          attributes: ["id", "full_name", "phone_number"],
        },
        {
          model: models.User,
          as: "runner",
          attributes: ["id", "full_name", "phone_number"],
          required: false,
        },
        {
          model: models.Transaction,
          as: "transaction",
          required: false,
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    return {
      errands,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(count / limit),
        total_errands: count,
        has_next: offset + errands.length < count,
        has_prev: page > 1,
      },
    };
  }

  async updateErrand(errandId: number, updateData: {
    status?: string;
    final_price?: number;
    runner_id?: number;
  }) {
    const errand = await models.Errand.findByPk(errandId);
    if (!errand) throw new Error("Errand not found");

    const updatePayload: any = { ...updateData };

    if (updateData.runner_id && errand.status === "pending") {
      updatePayload.status = "accepted";
      updatePayload.accepted_at = new Date();
    }

    await errand.update(updatePayload);

    return models.Errand.findByPk(errandId, {
      include: [
        {
          model: models.User,
          as: "customer",
          attributes: ["id", "full_name", "phone_number"],
        },
        {
          model: models.User,
          as: "runner",
          attributes: ["id", "full_name", "phone_number"],
          required: false,
        },
        {
          model: models.Transaction,
          as: "transaction",
          required: false,
        },
      ],
    });
  }

  // Financial Management
  async getTransactions(filters: {
    page?: number;
    limit?: number;
    payment_status?: string;
    date_from?: string;
    date_to?: string;
  }) {
    const { page = 1, limit = 20, payment_status, date_from, date_to } = filters;
    const offset = (page - 1) * limit;

    const whereClause: any = {};
    if (payment_status) whereClause.payment_status = payment_status;

    if (date_from || date_to) {
      whereClause.created_at = {};
      if (date_from) whereClause.created_at[Op.gte] = new Date(date_from);
      if (date_to) whereClause.created_at[Op.lte] = new Date(date_to);
    }

    const { count, rows: transactions } = await models.Transaction.findAndCountAll({
      where: whereClause,
      include: [{
        model: models.Errand,
        as: "errand",
        include: [
          {
            model: models.User,
            as: "customer",
            attributes: ["id", "full_name", "phone_number"],
          },
          {
            model: models.User,
            as: "runner",
            attributes: ["id", "full_name", "phone_number"],
            required: false,
          },
        ],
      }],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    const [totalRevenue, platformEarnings, pendingRevenue] = await Promise.all([
      models.Transaction.sum("amount", { where: { payment_status: "completed" } }) || 0,
      models.Transaction.sum("platform_fee", { where: { payment_status: "completed" } }) || 0,
      models.Transaction.sum("amount", { where: { payment_status: "pending" } }) || 0,
    ]);

    return {
      transactions,
      financial_summary: {
        total_revenue: totalRevenue,
        platform_earnings: platformEarnings,
        pending_revenue: pendingRevenue,
        payout_to_runners: totalRevenue - platformEarnings,
      },
      pagination: {
        current_page: page,
        total_pages: Math.ceil(count / limit),
        total_transactions: count,
        has_next: offset + transactions.length < count,
        has_prev: page > 1,
      },
    };
  }

  // Review Management
  async getReviews(filters: { page?: number; limit?: number; rating?: string }) {
    const { page = 1, limit = 20, rating } = filters;
    const offset = (page - 1) * limit;

    const whereClause: any = {};
    if (rating) whereClause.rating = rating;

    const { count, rows: reviews } = await models.Review.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.Errand,
          as: "errand",
          attributes: ["id", "title", "category"],
        },
        {
          model: models.User,
          as: "reviewer",
          attributes: ["id", "full_name", "phone_number"],
        },
        {
          model: models.User,
          as: "reviewee",
          attributes: ["id", "full_name", "phone_number"],
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    const [reviewStats, averageRatingResult] = await Promise.all([
      models.Review.findAll({
        attributes: ["rating", [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]],
        group: ["rating"],
        order: [["rating", "DESC"]],
        raw: true,
      }),
      models.Review.findOne({
        attributes: [[Sequelize.fn("AVG", Sequelize.col("rating")), "avg_rating"]],
        raw: true,
      }) as Promise<{ avg_rating: string | null } | null>,
    ]);

    const averageRating = averageRatingResult?.avg_rating || "0";

    return {
      reviews,
      statistics: {
        total_reviews: count,
        average_rating: parseFloat(averageRating).toFixed(1),
        rating_distribution: reviewStats,
      },
      pagination: {
        current_page: page,
        total_pages: Math.ceil(count / limit),
        total_reviews: count,
        has_next: offset + reviews.length < count,
        has_prev: page > 1,
      },
    };
  }

  // Runner Management
  async getRunners(filters: { page?: number; limit?: number; is_approved?: string; search?: string }) {
    const { page = 1, limit = 20, is_approved, search } = filters;
    const offset = (page - 1) * limit;

    const whereClause: any = {};
    if (is_approved !== undefined) {
      whereClause.is_approved = is_approved === "true";
    }

    const includeClause: any = [{
      model: models.User,
      as: "user",
      attributes: ["id", "full_name", "phone_number", "email", "verification_status"],
    }];

    if (search) {
      includeClause[0].where = {
        [Op.or]: [
          { full_name: { [Op.iLike]: `%${search}%` } },
          { phone_number: { [Op.iLike]: `%${search}%` } },
        ],
      };
    }

    const { count, rows: runners } = await models.Runner.findAndCountAll({
      where: whereClause,
      include: includeClause,
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    return {
      runners,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(count / limit),
        total_runners: count,
        has_next: offset + runners.length < count,
        has_prev: page > 1,
      },
    };
  }

  async updateRunner(runnerId: number, updateData: {
    is_approved?: boolean;
    rejection_reason?: string;
    is_available?: boolean;
  }) {
    const runner = await models.Runner.findByPk(runnerId, {
      include: [{ model: models.User, as: "user" }],
    });
    if (!runner) throw new Error("Runner not found");

    const updatePayload: any = { ...updateData };

    if (updateData.is_approved !== undefined) {
      updatePayload.is_approved = updateData.is_approved;
      if (updateData.is_approved) {
        updatePayload.approved_at = new Date();
        updatePayload.rejection_reason = null;
      } else {
        updatePayload.rejection_reason = updateData.rejection_reason;
      }
    }

    await runner.update(updatePayload);

    return models.Runner.findByPk(runnerId, {
      include: [{
        model: models.User,
        as: "user",
        attributes: ["id", "full_name", "phone_number", "email", "verification_status"],
      }],
    });
  }

  // Report Management
  async getReports(filters: { page?: number; limit?: number; status?: string; report_type?: string }) {
    const { page = 1, limit = 20, status, report_type } = filters;
    const offset = (page - 1) * limit;

    const whereClause: any = {};
    if (status) whereClause.status = status;
    if (report_type) whereClause.report_type = report_type;

    const { count, rows: reports } = await models.Report.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: "reporter",
          attributes: ["id", "full_name", "phone_number"],
        },
        {
          model: models.User,
          as: "reported_user",
          attributes: ["id", "full_name", "phone_number"],
        },
        {
          model: models.Errand,
          as: "errand",
          attributes: ["id", "title", "category"],
          required: false,
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    return {
      reports,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(count / limit),
        total_reports: count,
        has_next: offset + reports.length < count,
        has_prev: page > 1,
      },
    };
  }

  async updateReport(reportId: number, updateData: { status?: string; admin_notes?: string }) {
    const report = await models.Report.findByPk(reportId);
    if (!report) throw new Error("Report not found");

    const updatePayload: any = { ...updateData };

    if (updateData.status === "resolved" || updateData.status === "dismissed") {
      updatePayload.resolved_at = new Date();
    }

    await report.update(updatePayload);

    return models.Report.findByPk(reportId, {
      include: [
        {
          model: models.User,
          as: "reporter",
          attributes: ["id", "full_name", "phone_number"],
        },
        {
          model: models.User,
          as: "reported_user",
          attributes: ["id", "full_name", "phone_number"],
        },
        {
          model: models.Errand,
          as: "errand",
          attributes: ["id", "title", "category"],
          required: false,
        },
      ],
    });
  }

  // System Health
  async getSystemHealth() {
    await sequelize.authenticate();

    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    const [activeUsers, pendingReports, pendingRunners, pendingErrands] = await Promise.all([
      models.User.count({
        where: { updated_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      models.Report.count({ where: { status: "pending" } }),
      models.Runner.count({ where: { is_approved: false } }),
      models.Errand.count({ where: { status: "pending" } }),
    ]);

    return {
      database: {
        status: "healthy",
        connection: "connected",
      },
      server: {
        uptime: Math.floor(uptime / 60) + " minutes",
        memory_usage: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + " MB",
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + " MB",
        },
        node_version: process.version,
      },
      platform: {
        active_users_24h: activeUsers,
        pending_reports: pendingReports,
        pending_runner_approvals: pendingRunners,
        pending_errands: pendingErrands,
        current_time: new Date().toISOString(),
      },
    };
  }
}

export default new AdminService();