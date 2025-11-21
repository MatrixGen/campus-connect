import { Op, Transaction } from 'sequelize';
import models from '../models';
import { 
  RunnerRegistrationData, 
  RunnerUpdateData, 
  RunnerStats,
  EarningsBreakdown,
  RunnerWithUser
} from '../types/runner.types';
import { RunnerCreationAttributes } from '../types/models.types';

// Simple fallbacks for missing dependencies
const logger = {
  error: (message: string, meta?: any) => console.error('ERROR:', message, meta),
  warn: (message: string, meta?: any) => console.warn('WARN:', message, meta),
  info: (message: string, meta?: any) => console.log('INFO:', message, meta),
};

// Use the fixed metrics that accepts a name parameter
const metrics = {
  startTimer: (name: string) => {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      console.log(`Timer ${name}: ${duration}ms`);
    };
  },
  incrementCounter: (name: string, value: number = 1) => {
    console.log(`Counter ${name} incremented by ${value}`);
  },
};;

// Simple in-memory cache fallback
class MemoryCache {
  private store = new Map();
  
  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }
  
  async setex(key: string, seconds: number, value: string): Promise<void> {
    this.store.set(key, value);
    // Simple TTL simulation
    setTimeout(() => this.store.delete(key), seconds * 1000);
  }
  
  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
  
  isReady(): boolean {
    return true;
  }
}

const redisClient = new MemoryCache();

// Constants for configuration
const CONFIG = {
  CACHE_TTL: {
    RUNNER_PROFILE: 300, // 5 minutes
    NEARBY_RUNNERS: 60,  // 1 minute
  },
  MAX_AREAS_COVERED: 10,
  RECENT_ERRANDS_LIMIT: 10,
} as const;

export class RunnerService {
  private readonly cacheEnabled: boolean;

  constructor() {
    this.cacheEnabled = process.env.REDIS_ENABLED === 'true';
  }

  // Check if user already has a runner profile
  async checkExistingRunner(userId: number): Promise<boolean> {
    const endTimer = metrics.startTimer('check_existing_runner');
    try {
      const existingRunner = await models.Runner.findOne({
        where: { user_id: userId }
      });
      
      metrics.incrementCounter('runner.checks', 1);
      return !!existingRunner;
    } catch (error) {
      metrics.incrementCounter('runner.checks.error', 1);
      logger.error('Error checking existing runner', { userId, error });
      throw new Error('Failed to check runner existence');
    } finally {
      endTimer();
    }
  }

  // Update user type to include runner capability
  async updateUserType(userId: number): Promise<void> {
    const endTimer = metrics.startTimer('update_user_type');
    try {
      const user = await models.User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const newUserType = user.user_type === 'customer' ? 'both' : 'runner';
      await user.update({ user_type: newUserType });
      
      logger.info('User type updated successfully', { userId, newUserType });
      metrics.incrementCounter('user.type_updates', 1);
    } catch (error) {
      metrics.incrementCounter('user.type_updates.error', 1);
      if (error instanceof Error && error.message === 'User not found') throw error;
      logger.error('Error updating user type', { userId, error });
      throw new Error('Failed to update user type');
    } finally {
      endTimer();
    }
  }

  // Create runner profile - Enhanced with validation and transactions
  async createRunnerProfile(userId: number, data: RunnerRegistrationData): Promise<RunnerWithUser> {
    const endTimer = metrics.startTimer('create_runner_profile');
    let transaction: Transaction | undefined;

    try {
      // Validate input data
      this.validateRunnerRegistrationData(data);

      // Start transaction for atomic operations
      transaction = await models.sequelize.transaction();

      // Use type assertion to handle nullable fields
      const runnerData = {
        user_id: userId,
        areas_covered: data.areas_covered,
        transportation_mode: data.transportation_mode,
        is_available: true,
        is_approved: false,
        rating: 5.0,
        completed_errands: 0,
        earnings: 0.0,
        total_distance_covered: 0.0,
        average_response_time: 0,
        cancellation_rate: 0.0,
        documents_verified: false,
        id_card_url: data.id_card_url || null,
        student_card_url: data.student_card_url || null
      } as any; // Use type assertion to bypass strict type checking

      const runner = await models.Runner.create(runnerData, { transaction });
      const runnerWithDetails = await this.getRunnerWithDetails(runner.id, transaction);

      // Commit transaction
      await transaction.commit();

      // Invalidate any cached runner data
      await this.invalidateRunnerCache(userId);

      logger.info('Runner profile created successfully', { userId, runnerId: runner.id });
      metrics.incrementCounter('runner.registrations', 1);

      return runnerWithDetails;
    } catch (error) {
      // Rollback transaction if it was started
      if (transaction) await transaction.rollback();
      
      metrics.incrementCounter('runner.registrations.error', 1);
      logger.error('Error creating runner profile', { userId, error });
      
      if (error instanceof Error && error.message.includes('ValidationError')) throw error;
      throw new Error('Failed to create runner profile');
    } finally {
      endTimer();
    }
  }

  // Get runner with user details - Enhanced with caching
  async getRunnerWithDetails(runnerId: number, transaction?: Transaction): Promise<RunnerWithUser> {
    const endTimer = metrics.startTimer('get_runner_with_details');
    const cacheKey = `runner:details:${runnerId}`;

    try {
      // Try cache first if enabled
      if (this.cacheEnabled) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          metrics.incrementCounter('runner.cache.hits', 1);
          return JSON.parse(cached);
        }
      }

      const runner = await models.Runner.findByPk(runnerId, {
        include: [{
          model: models.User,
          as: 'user',
          attributes: ['id', 'full_name', 'phone_number', 'user_type', 'verification_status']
        }],
        transaction
      });

      if (!runner) {
        throw new Error('Runner not found');
      }

      const runnerData = runner.toJSON() as RunnerWithUser;

      // Cache the result
      if (this.cacheEnabled) {
        await redisClient.setex(cacheKey, CONFIG.CACHE_TTL.RUNNER_PROFILE, JSON.stringify(runnerData));
      }

      metrics.incrementCounter('runner.details.requests', 1);
      return runnerData;
    } catch (error) {
      metrics.incrementCounter('runner.details.requests.error', 1);
      if (error instanceof Error && error.message === 'Runner not found') throw error;
      logger.error('Error getting runner details', { runnerId, error });
      throw new Error('Failed to get runner details');
    } finally {
      endTimer();
    }
  }

  // Get runner by user ID - Enhanced with caching
  async getRunnerByUserId(userId: number): Promise<RunnerWithUser | null> {
    const endTimer = metrics.startTimer('get_runner_by_user_id');
    const cacheKey = `runner:user:${userId}`;

    try {
      // Try cache first if enabled
      if (this.cacheEnabled) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          metrics.incrementCounter('runner.cache.hits', 1);
          return JSON.parse(cached);
        }
      }

      const runner = await models.Runner.findOne({
        where: { user_id: userId },
        include: [{
          model: models.User,
          as: 'user',
          attributes: ['id', 'full_name', 'phone_number', 'email', 'student_id', 'verification_status']
        }]
      });

      const result = runner ? (runner.toJSON() as RunnerWithUser) : null;

      // Cache the result (even null to prevent cache penetration)
      if (this.cacheEnabled) {
        await redisClient.setex(cacheKey, CONFIG.CACHE_TTL.RUNNER_PROFILE, JSON.stringify(result));
      }

      metrics.incrementCounter('runner.by_user.requests', 1);
      return result;
    } catch (error) {
      metrics.incrementCounter('runner.by_user.requests.error', 1);
      logger.error('Error getting runner by user ID', { userId, error });
      throw new Error('Failed to get runner profile');
    } finally {
      endTimer();
    }
  }

  // Update runner profile - Enhanced with validation and cache invalidation
  async updateRunnerProfile(userId: number, updateData: RunnerUpdateData): Promise<RunnerWithUser> {
    const endTimer = metrics.startTimer('update_runner_profile');
    let transaction: Transaction | undefined;

    try {
      // Validate update data
      if (updateData.areas_covered) {
        this.validateAreasCovered(updateData.areas_covered);
      }

      transaction = await models.sequelize.transaction();

      const runner = await models.Runner.findOne({
        where: { user_id: userId },
        transaction
      });

      if (!runner) {
        throw new Error('Runner profile not found');
      }

      const updatePayload: any = {
        transportation_mode: updateData.transportation_mode || runner.transportation_mode,
        is_available: updateData.is_available !== undefined ? updateData.is_available : runner.is_available,
        last_active_at: new Date()
      };

      if (updateData.areas_covered) updatePayload.areas_covered = updateData.areas_covered;
      
      // Handle nullable fields properly
      if (updateData.id_card_url !== undefined) {
        updatePayload.id_card_url = updateData.id_card_url;
      }
      
      if (updateData.student_card_url !== undefined) {
        updatePayload.student_card_url = updateData.student_card_url;
      }

      await runner.update(updatePayload, { transaction });
      const updatedRunner = await this.getRunnerWithDetails(runner.id, transaction);

      await transaction.commit();

      // Invalidate cache
      await this.invalidateRunnerCache(userId);
      await this.invalidateRunnerCache(updatedRunner.id);

      logger.info('Runner profile updated successfully', { userId, runnerId: runner.id });
      metrics.incrementCounter('runner.profile_updates', 1);

      return updatedRunner;
    } catch (error) {
      if (transaction) await transaction.rollback();
      metrics.incrementCounter('runner.profile_updates.error', 1);
      if (error instanceof Error && (
        error.message === 'Runner profile not found' || 
        error.message.includes('ValidationError')
      )) throw error;
      logger.error('Error updating runner profile', { userId, error });
      throw new Error('Failed to update runner profile');
    } finally {
      endTimer();
    }
  }

  // Get runner statistics - Enhanced with error handling
  async getRunnerStatistics(userId: number): Promise<RunnerStats> {
    const endTimer = metrics.startTimer('get_runner_statistics');
    try {
      const [completedErrands, activeErrands, transactions] = await Promise.all([
        models.Errand.count({
          where: { 
            runner_id: userId,
            status: 'completed'
          }
        }),
        models.Errand.count({
          where: { 
            runner_id: userId,
            status: { [Op.in]: ['accepted', 'in_progress'] }
          }
        }),
        models.Transaction.findAll({
          where: { 
            runner_id: userId,
            payment_status: 'completed'
          },
          attributes: ['runner_earnings']
        })
      ]);

      const totalEarnings = transactions.reduce((sum, transaction) => {
        return sum + parseFloat(transaction.runner_earnings?.toString() || '0');
      }, 0);

      metrics.incrementCounter('runner.statistics.requests', 1);
      return {
        completed_errands: completedErrands as number,
        active_errands: activeErrands as number,
        total_earnings: totalEarnings
      };
    } catch (error) {
      metrics.incrementCounter('runner.statistics.requests.error', 1);
      logger.error('Error getting runner statistics', { userId, error });
      throw new Error('Failed to get runner statistics');
    } finally {
      endTimer();
    }
  }

  // Get nearby runners - Enhanced with caching and pagination
  async getNearbyRunners(area?: string, page: number = 1, limit: number = 20): Promise<{ runners: RunnerWithUser[], total: number }> {
    const endTimer = metrics.startTimer('get_nearby_runners');
    const cacheKey = `nearby_runners:${area || 'all'}:${page}:${limit}`;

    try {
      // Try cache first if enabled
      if (this.cacheEnabled && !area) { // Only cache non-area-specific queries
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          metrics.incrementCounter('runner.cache.hits', 1);
          return JSON.parse(cached);
        }
      }

      const whereClause: any = {
        is_available: true,
        is_approved: true
      };

      if (area && typeof area === 'string') {
        whereClause.areas_covered = {
          [Op.overlap]: [area]
        };
      }

      const offset = (page - 1) * limit;

      const [runners, total] = await Promise.all([
        models.Runner.findAll({
          where: whereClause,
          include: [{
            model: models.User,
            as: 'user',
            attributes: ['id', 'full_name', 'phone_number', 'student_id', 'avatar_url']
          }],
          order: [
            ['rating', 'DESC'],
            ['completed_errands', 'DESC']
          ],
          limit,
          offset
        }),
        models.Runner.count({
          where: whereClause
        })
      ]);

      const result = {
        runners: runners.map(runner => runner.toJSON() as RunnerWithUser),
        total: total as number
      };

      // Cache the result
      if (this.cacheEnabled && !area) {
        await redisClient.setex(cacheKey, CONFIG.CACHE_TTL.NEARBY_RUNNERS, JSON.stringify(result));
      }

      metrics.incrementCounter('runner.nearby.requests', 1);
      return result;
    } catch (error) {
      metrics.incrementCounter('runner.nearby.requests.error', 1);
      logger.error('Error getting nearby runners', { area, error });
      throw new Error('Failed to get nearby runners');
    } finally {
      endTimer();
    }
  }

  // Get runner dashboard data - Enhanced with parallel execution
  async getRunnerDashboard(userId: number) {
    const endTimer = metrics.startTimer('get_runner_dashboard');
    try {
      const runner = await this.getRunnerByUserId(userId);
      if (!runner) {
        throw new Error('Runner profile not found');
      }

      const [recentErrands, weeklyEarnings, completionRate, totalEarnings] = await Promise.all([
        this.getRecentErrands(userId),
        this.getWeeklyEarnings(userId),
        this.getCompletionRate(userId),
        this.getTotalEarnings(userId)
      ]);

      const dashboardData = {
        profile: runner,
        statistics: {
          total_earnings: totalEarnings,
          weekly_earnings: weeklyEarnings,
          completed_errands: runner.completed_errands,
          completion_rate: Math.round(completionRate),
          current_rating: parseFloat(runner.rating.toString()),
          total_distance_covered: parseFloat(runner.total_distance_covered.toString()),
          average_response_time: runner.average_response_time,
          cancellation_rate: parseFloat(runner.cancellation_rate.toString())
        },
        recent_errands: recentErrands,
        approval_status: {
          is_approved: runner.is_approved,
          documents_verified: runner.documents_verified,
          approved_at: runner.approved_at,
          rejection_reason: runner.rejection_reason
        }
      };

      metrics.incrementCounter('runner.dashboard.requests', 1);
      return dashboardData;
    } catch (error) {
      metrics.incrementCounter('runner.dashboard.requests.error', 1);
      if (error instanceof Error && error.message === 'Runner profile not found') throw error;
      logger.error('Error getting runner dashboard', { userId, error });
      throw new Error('Failed to get dashboard data');
    } finally {
      endTimer();
    }
  }

  // Get recent errands
  private async getRecentErrands(userId: number, limit: number = CONFIG.RECENT_ERRANDS_LIMIT) {
    return await models.Errand.findAll({
      where: { runner_id: userId },
      include: [{
        model: models.User,
        as: 'customer',
        attributes: ['id', 'full_name', 'phone_number', 'avatar_url']
      }],
      order: [['created_at', 'DESC']],
      limit
    });
  }

  // Get weekly earnings
  private async getWeeklyEarnings(userId: number): Promise<number> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const weeklyTransactions = await models.Transaction.findAll({
      where: {
        runner_id: userId,
        payment_status: 'completed',
        created_at: {
          [Op.gte]: oneWeekAgo
        }
      },
      attributes: ['runner_earnings']
    });

    return weeklyTransactions.reduce((sum, transaction) => {
      return sum + parseFloat(transaction.runner_earnings?.toString() || '0');
    }, 0);
  }

  // Get completion rate
  private async getCompletionRate(userId: number): Promise<number> {
    const [totalAccepted, totalCompleted] = await Promise.all([
      models.Errand.count({
        where: { 
          runner_id: userId,
          status: { [Op.in]: ['accepted', 'in_progress', 'completed'] }
        }
      }),
      models.Errand.count({
        where: { 
          runner_id: userId,
          status: 'completed'
        }
      })
    ]);

    return totalAccepted > 0 ? (totalCompleted / totalAccepted) * 100 : 0;
  }

  // Get total earnings
  private async getTotalEarnings(userId: number): Promise<number> {
    const allTransactions = await models.Transaction.findAll({
      where: {
        runner_id: userId,
        payment_status: 'completed'
      },
      attributes: ['runner_earnings']
    });

    return allTransactions.reduce((sum, transaction) => {
      return sum + parseFloat(transaction.runner_earnings?.toString() || '0');
    }, 0);
  }

  // Get earnings breakdown - Enhanced with date validation
  async getEarningsBreakdown(userId: number, period: string = 'month'): Promise<EarningsBreakdown> {
    const endTimer = metrics.startTimer('get_earnings_breakdown');
    try {
      const periods: Record<string, Date> = {
        day: new Date(Date.now() - 24 * 60 * 60 * 1000),
        week: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        month: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        year: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      };

      const startDate = periods[period] || periods.month;

      const transactions = await models.Transaction.findAll({
        where: {
          runner_id: userId,
          payment_status: 'completed',
          created_at: {
            [Op.gte]: startDate
          }
        },
        include: [{
          model: models.Errand,
          as: 'errand',
          attributes: ['id', 'title', 'category', 'status'],
          required: false
        }],
        order: [['created_at', 'DESC']]
      });

      const result = {
        period: period,
        total_earnings: transactions.reduce((sum, t) => sum + parseFloat(t.runner_earnings?.toString() || '0'), 0),
        total_errands: transactions.length,
        platform_fees: transactions.reduce((sum, t) => sum + parseFloat(t.platform_fee?.toString() || '0'), 0),
        transactions: transactions.map(t => {
          const errand = (t as any).errand;
          
          return {
            id: t.id,
            errand_title: errand?.title || 'N/A',
            category: errand?.category || 'N/A',
            amount: parseFloat(t.amount?.toString() || '0'),
            runner_earnings: parseFloat(t.runner_earnings?.toString() || '0'),
            platform_fee: parseFloat(t.platform_fee?.toString() || '0'),
            payment_method: t.payment_method,
            completed_at: t.completed_at,
            created_at: t.created_at
          };
        })
      };

      metrics.incrementCounter('runner.earnings_breakdown.requests', 1);
      return result;
    } catch (error) {
      metrics.incrementCounter('runner.earnings_breakdown.requests.error', 1);
      logger.error('Error getting earnings breakdown', { userId, period, error });
      throw new Error('Failed to get earnings breakdown');
    } finally {
      endTimer();
    }
  }

  // Private helper methods
  private validateRunnerRegistrationData(data: RunnerRegistrationData): void {
    if (!data.areas_covered || !Array.isArray(data.areas_covered)) {
      throw new Error('Areas covered must be a non-empty array');
    }

    this.validateAreasCovered(data.areas_covered);

    if (!data.transportation_mode || data.transportation_mode.trim().length === 0) {
      throw new Error('Transportation mode is required');
    }
  }

  private validateAreasCovered(areas: string[]): void {
    if (areas.length === 0) {
      throw new Error('At least one area must be covered');
    }

    if (areas.length > CONFIG.MAX_AREAS_COVERED) {
      throw new Error(`Maximum ${CONFIG.MAX_AREAS_COVERED} areas allowed`);
    }

    // Validate each area is a non-empty string
    for (const area of areas) {
      if (typeof area !== 'string' || area.trim().length === 0) {
        throw new Error('All areas must be non-empty strings');
      }
    }
  }

  private async invalidateRunnerCache(identifier: number): Promise<void> {
    if (!this.cacheEnabled) return;

    const cacheKeys = [
      `runner:details:${identifier}`,
      `runner:user:${identifier}`,
    ];

    try {
      await Promise.all(cacheKeys.map(key => redisClient.del(key)));
    } catch (error) {
      logger.warn('Failed to invalidate runner cache', { identifier, error });
    }
  }
}

export default new RunnerService();