import models from '../models';
import { Transaction as SequelizeTransaction } from 'sequelize';
import { Category, UrgencyType } from '../types/errand';
import { getFullPricing, PricingBreakdown } from '../utils/errandPricing';

// Import the actual Errand model type
import Errand from '../models/Errand';

export class ErrandService {
  /**
   * Create a new errand.
   */
  async createErrand(data: {
    customerId: number;
    title: string;
    description?: string;
    category: Category;
    location_from: string;
    location_to: string;
    budget: number;
    urgency: UrgencyType;
    distance?: number;
    estimated_duration_min?: number;
  }): Promise<Errand | null> {
    const distance = data.distance || 0;
    const pricing: PricingBreakdown = getFullPricing(
      data.budget, 
      data.category, 
      data.urgency, 
      distance
    );

    const errand = await models.Errand.create({
      customer_id: data.customerId,
      title: data.title,
      description: data.description,
      category: data.category,
      location_from: data.location_from,
      location_to: data.location_to,
      base_price: data.budget,
      final_price: pricing.finalPrice,
      urgency: data.urgency,
      distance_km: distance,
      estimated_duration_min: data.estimated_duration_min,
      status: 'pending'
    });

    return models.Errand.findByPk(errand.id, {
      include: [{ 
        model: models.User, 
        as: 'customer', 
        attributes: ['id', 'full_name', 'phone_number'] 
      }]
    });
  }

  /**
   * Accept an errand as a runner.
   */
  async acceptErrand(errandId: number, runnerId: number): Promise<Errand | null> {
    return models.sequelize!.transaction(async (t: SequelizeTransaction) => {
      const runner = await models.Runner.findOne({
        where: { user_id: runnerId, is_available: true },
        transaction: t
      });
      if (!runner) throw new Error('Runner not available or not found');

      const errand = await models.Errand.findByPk(errandId, { 
        transaction: t, 
        lock: t.LOCK.UPDATE 
      });
      
      if (!errand) throw new Error('Errand not found');
      if (errand.status !== 'pending') throw new Error('Errand no longer available');
      if (errand.runner_id) throw new Error('Errand already assigned to another runner');

      // Update errand as accepted
      await errand.update(
        { 
          runner_id: runnerId, 
          status: 'accepted', 
          accepted_at: new Date() 
        },
        { transaction: t }
      );

      // Make runner unavailable
      await runner.update({ is_available: false }, { transaction: t });

      return models.Errand.findByPk(errandId, {
        include: [
          { 
            model: models.User, 
            as: 'customer', 
            attributes: ['id', 'full_name', 'phone_number'] 
          },
          { 
            model: models.User, 
            as: 'runner', 
            attributes: ['id', 'full_name', 'phone_number'] 
          }
        ]
      });
    });
  }

  /**
   * Start an errand (move from accepted to in_progress)
   */
  async startErrand(errandId: number, runnerId: number): Promise<Errand | null> {
    return models.sequelize!.transaction(async (t: SequelizeTransaction) => {
      const errand = await models.Errand.findByPk(errandId, { 
        transaction: t, 
        lock: t.LOCK.UPDATE 
      });
      
      if (!errand) throw new Error('Errand not found');
      if (errand.runner_id !== runnerId) throw new Error('Not assigned runner');
      if (errand.status !== 'accepted') throw new Error('Errand must be accepted before starting');

      await errand.update(
        { 
          status: 'in_progress', 
          started_at: new Date() 
        }, 
        { transaction: t }
      );

      return this.getErrandWithDetails(errandId);
    });
  }

  /**
   * Complete an errand and create transaction.
   */
  async completeErrand(errandId: number, runnerId: number): Promise<Errand | null> {
    return models.sequelize!.transaction(async (t: SequelizeTransaction) => {
      const errand = await models.Errand.findByPk(errandId, { 
        transaction: t, 
        lock: t.LOCK.UPDATE 
      });
      
      if (!errand) throw new Error('Errand not found');
      if (errand.runner_id !== runnerId) throw new Error('Not assigned runner');
      if (errand.status !== 'in_progress') throw new Error('Errand must be in progress');

      // Calculate pricing breakdown using original base price
      const pricing: PricingBreakdown = getFullPricing(
        errand.base_price,
        errand.category as Category,
        errand.urgency as UrgencyType,
        errand.distance_km
      );

      // Update errand as completed
      await errand.update(
        { 
          status: 'completed', 
          completed_at: new Date() 
        }, 
        { transaction: t }
      );

      const runner = await models.Runner.findOne({ 
        where: { user_id: runnerId }, 
        transaction: t 
      });
      if (!runner) throw new Error('Runner not found');

      // Update runner stats
      await runner.update(
        {
          is_available: true,
          completed_errands: (runner.completed_errands || 0) + 1,
          earnings: Number(runner.earnings || 0) + pricing.runnerEarnings
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
          payment_status: 'pending',
          payment_method: 'mobile_money'
        },
        { transaction: t }
      );

      return this.getErrandWithDetails(errandId);
    });
  }

  /**
   * Cancel an errand
   */
  async cancelErrand(errandId: number, userId: number, reason?: string): Promise<Errand | null> {
    return models.sequelize!.transaction(async (t: SequelizeTransaction) => {
      const errand = await models.Errand.findByPk(errandId, { 
        transaction: t, 
        lock: t.LOCK.UPDATE 
      });
      
      if (!errand) throw new Error('Errand not found');
      
      // Only customer or assigned runner can cancel
      if (errand.customer_id !== userId && errand.runner_id !== userId) {
        throw new Error('Not authorized to cancel this errand');
      }

      if (!['pending', 'accepted'].includes(errand.status)) {
        throw new Error('Cannot cancel errand in current status');
      }

      await errand.update(
        { 
          status: 'cancelled' 
        }, 
        { transaction: t }
      );

      // If there was a runner, make them available again
      if (errand.runner_id) {
        await models.Runner.update(
          { is_available: true },
          { 
            where: { user_id: errand.runner_id },
            transaction: t
          }
        );
      }

      return this.getErrandWithDetails(errandId);
    });
  }

  /**
   * Helper method to get errand with all details
   */
  private async getErrandWithDetails(errandId: number): Promise<Errand | null> {
    return models.Errand.findByPk(errandId, {
      include: [
        { 
          model: models.User, 
          as: 'customer', 
          attributes: ['id', 'full_name', 'phone_number'] 
        },
        { 
          model: models.User, 
          as: 'runner', 
          attributes: ['id', 'full_name', 'phone_number'] 
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
  }

  /**
   * Preview estimated runner earnings without updating DB.
   */
  previewEarnings(basePrice: number, category: Category, urgency: UrgencyType, distance?: number): PricingBreakdown {
    return getFullPricing(basePrice, category, urgency, distance || 0);
  }
}

export const errandService = new ErrandService();