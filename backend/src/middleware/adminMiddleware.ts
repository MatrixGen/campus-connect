import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import models from '../models';

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.userId;

    const user = await models.User.findByPk(userId);
    
    if (!user || !user.is_admin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error in admin verification'
    });
  }
};

export const requireSuperAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  // For future use - more restrictive than regular admin
  await requireAdmin(req, res, next);
};