import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { errandService } from '../services/errandService';
import models from '../models';
import { Op } from 'sequelize';
import { Category, UrgencyType } from '../types/errand';

class ErrandController {
  // Create a new errand
  async createErrand(req: AuthRequest, res: Response) {
    try {
      const data = {
        ...req.body,
        customerId: req.user.userId,
        category: req.body.category as Category,
        urgency: (req.body.urgency || 'standard') as UrgencyType
      };
      
      const errand = await errandService.createErrand(data);
      return res.status(201).json({ 
        success: true, 
        message: 'Errand created successfully', 
        data: errand 
      });
    } catch (error: any) {
      console.error('Create errand error:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Internal server error' 
      });
    }
  }

  // Get available errands for runners
  async getAvailableErrands(req: AuthRequest, res: Response) {
    try {
      const runner = await models.Runner.findOne({ 
        where: { user_id: req.user.userId, is_available: true } 
      });
      
      if (!runner) {
        return res.status(403).json({ 
          success: false, 
          message: 'You are not available as a runner' 
        });
      }

      const { category, urgency, max_distance } = req.query;
      
      // Build filter conditions
      const whereConditions: any = { status: 'pending' };
      
      if (category) {
        whereConditions.category = category;
      }
      
      if (urgency) {
        whereConditions.urgency = urgency;
      }
      
      if (max_distance) {
        whereConditions.distance_km = {
          [Op.lte]: parseFloat(max_distance as string)
        };
      }

      const errands = await models.Errand.findAll({
        where: whereConditions,
        include: [{ 
          model: models.User, 
          as: 'customer', 
          attributes: ['id', 'full_name', 'phone_number'] 
        }],
        order: [['urgency', 'DESC'], ['created_at', 'DESC']]
      });

      return res.json({ 
        success: true, 
        data: errands, 
        count: errands.length 
      });
    } catch (error: any) {
      console.error('Get available errands error:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Internal server error' 
      });
    }
  }

  // Get customer's errands
  async getMyRequests(req: AuthRequest, res: Response) {
    try {
      const customerId = req.user.userId;
      const { status } = req.query;

      const whereConditions: any = { customer_id: customerId };
      
      if (status) {
        whereConditions.status = status;
      }

      const errands = await models.Errand.findAll({
        where: whereConditions,
        include: [
          {
            model: models.User,
            as: 'runner',
            attributes: ['id', 'full_name', 'phone_number'],
            include: [{ 
              model: models.Runner, 
              as: 'runner_profile', 
              attributes: ['rating', 'completed_errands'] 
            }]
          },
          {
            model: models.Transaction,
            as: 'transaction',
            attributes: ['amount', 'payment_status', 'runner_earnings']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return res.json({ 
        success: true, 
        data: errands, 
        count: errands.length 
      });
    } catch (error: any) {
      console.error('Get my requests error:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Internal server error' 
      });
    }
  }

  // Get runner's jobs
  async getMyJobs(req: AuthRequest, res: Response) {
    try {
      const runnerId = req.user.userId;
      const { status } = req.query;

      // If specific status is provided, return only that status
      if (status) {
        const jobs = await models.Errand.findAll({
          where: { runner_id: runnerId, status },
          include: [
            { 
              model: models.User, 
              as: 'customer', 
              attributes: ['id', 'full_name', 'phone_number'] 
            },
            { 
              model: models.Transaction, 
              as: 'transaction', 
              attributes: ['amount', 'payment_status', 'runner_earnings'] 
            }
          ],
          order: [['accepted_at', 'DESC']]
        });

        return res.json({
          success: true,
          data: jobs,
          count: jobs.length
        });
      }

      // Otherwise return categorized jobs
      const activeJobs = await models.Errand.findAll({
        where: { 
          runner_id: runnerId, 
          status: { [Op.in]: ['accepted', 'in_progress'] } 
        },
        include: [
          { 
            model: models.User, 
            as: 'customer', 
            attributes: ['id', 'full_name', 'phone_number'] 
          },
          { 
            model: models.Transaction, 
            as: 'transaction', 
            attributes: ['amount', 'payment_status', 'runner_earnings'] 
          }
        ],
        order: [['accepted_at', 'DESC']]
      });

      const completedJobs = await models.Errand.findAll({
        where: { runner_id: runnerId, status: 'completed' },
        include: [
          { 
            model: models.User, 
            as: 'customer', 
            attributes: ['id', 'full_name', 'phone_number'] 
          },
          { 
            model: models.Transaction, 
            as: 'transaction' 
          }
        ],
        order: [['completed_at', 'DESC']],
        limit: 20
      });

      return res.json({
        success: true,
        data: { active: activeJobs, completed: completedJobs },
        counts: { active: activeJobs.length, completed: completedJobs.length }
      });
    } catch (error: any) {
      console.error('Get my jobs error:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Internal server error' 
      });
    }
  }

  // Accept an errand
  async acceptErrand(req: AuthRequest, res: Response) {
    try {
      const errandId = parseInt(req.params.id);
      const errand = await errandService.acceptErrand(errandId, req.user.userId);
      
      return res.json({ 
        success: true, 
        message: 'Errand accepted successfully', 
        data: errand 
      });
    } catch (error: any) {
      console.error('Accept errand error:', error);
      const statusCode = error.message.includes('not available') ? 403 : 400;
      return res.status(statusCode).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  // Start an errand (move from accepted to in_progress)
  async startErrand(req: AuthRequest, res: Response) {
    try {
      const errandId = parseInt(req.params.id);
      const errand = await errandService.startErrand(errandId, req.user.userId);
      
      return res.json({ 
        success: true, 
        message: 'Errand started successfully', 
        data: errand 
      });
    } catch (error: any) {
      console.error('Start errand error:', error);
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  // Complete an errand
  async completeErrand(req: AuthRequest, res: Response) {
    try {
      const errandId = parseInt(req.params.id);
      const errand = await errandService.completeErrand(errandId, req.user.userId);
      
      return res.json({ 
        success: true, 
        message: 'Errand completed successfully', 
        data: errand 
      });
    } catch (error: any) {
      console.error('Complete errand error:', error);
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  // Cancel an errand
  async cancelErrand(req: AuthRequest, res: Response) {
    try {
      const errandId = parseInt(req.params.id);
      const { reason } = req.body;
      
      const errand = await errandService.cancelErrand(errandId, req.user.userId, reason);
      
      return res.json({ 
        success: true, 
        message: 'Errand cancelled successfully', 
        data: errand 
      });
    } catch (error: any) {
      console.error('Cancel errand error:', error);
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  // Get errand details
  async getErrandDetails(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.userId;
      const errandId = parseInt(req.params.id);

      const errand = await models.Errand.findByPk(errandId, {
        include: [
          { 
            model: models.User, 
            as: 'customer', 
            attributes: ['id', 'full_name', 'phone_number', 'student_id'] 
          },
          {
            model: models.User,
            as: 'runner',
            attributes: ['id', 'full_name', 'phone_number'],
            include: [{ 
              model: models.Runner, 
              as: 'runner_profile', 
              attributes: ['rating', 'completed_errands', 'transportation_mode'] 
            }]
          },
          { 
            model: models.Transaction, 
            as: 'transaction' 
          },
          { 
            model: models.Review, 
            as: 'review' 
          }
        ]
      });

      if (!errand) {
        return res.status(404).json({ 
          success: false, 
          message: 'Errand not found' 
        });
      }

      const isCustomer = errand.customer_id === userId;
      const isRunner = errand.runner_id === userId;

      if (!isCustomer && !isRunner) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not authorized to view this errand' 
        });
      }

      return res.json({ 
        success: true, 
        data: errand 
      });
    } catch (error: any) {
      console.error('Get errand details error:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Internal server error' 
      });
    }
  }

  // Preview earnings for an errand (for runners)
  async previewEarnings(req: AuthRequest, res: Response) {
    try {
      const { basePrice, category, urgency, distance } = req.body;
      
      const pricing = errandService.previewEarnings(
        basePrice,
        category as Category,
        urgency as UrgencyType,
        distance
      );

      return res.json({
        success: true,
        data: pricing
      });
    } catch (error: any) {
      console.error('Preview earnings error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Invalid pricing parameters'
      });
    }
  }

  // Get errand statistics for dashboard
  async getErrandStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.userId;
      
      // Check if user is a runner
      const runner = await models.Runner.findOne({ where: { user_id: userId } });
      
      let stats: any = {};

      if (runner) {
        // Runner stats
        const completedCount = await models.Errand.count({
          where: { runner_id: userId, status: 'completed' }
        });

        const inProgressCount = await models.Errand.count({
          where: { runner_id: userId, status: 'in_progress' }
        });

        const totalEarnings = await models.Transaction.sum('runner_earnings', {
          where: { runner_id: userId, payment_status: 'completed' }
        }) || 0;

        stats = {
          completed_errands: completedCount,
          in_progress_errands: inProgressCount,
          total_earnings: totalEarnings,
          rating: runner.rating
        };
      } else {
        // Customer stats
        const requestedCount = await models.Errand.count({
          where: { customer_id: userId }
        });

        const completedCount = await models.Errand.count({
          where: { customer_id: userId, status: 'completed' }
        });

        const pendingCount = await models.Errand.count({
          where: { customer_id: userId, status: 'pending' }
        });

        stats = {
          total_requested: requestedCount,
          completed_errands: completedCount,
          pending_errands: pendingCount
        };
      }

      return res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('Get errand stats error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error'
      });
    }
  }
}

export default new ErrandController();