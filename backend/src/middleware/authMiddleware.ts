import { Request, Response, NextFunction } from 'express';
import jwtService from '../services/jwtService';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Access token required',
    });
    return;
  }

  try {
    const decoded = jwtService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

export const requireVerification = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // This middleware would check if user is verified
  // For now, we'll implement this later with actual user lookup
  next();
};