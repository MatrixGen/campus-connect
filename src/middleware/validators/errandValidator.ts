// src/middleware/validators/errandValidator.ts
import { body, param, query, ValidationChain } from 'express-validator';
import { Category, Urgency, ErrandStatus } from '../../types/errand';

// Common validation utilities
export const validateIdParam = (id: string): number | null => {
  const parsedId = parseInt(id, 10);
  return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
};

export const parseErrandStatus = (status: unknown): ErrandStatus | null => {
  if (typeof status !== 'string') return null;
  return Object.values(ErrandStatus).includes(status as ErrandStatus) 
    ? status as ErrandStatus 
    : null;
};

// Validation schemas
export const validateErrandCreation: ValidationChain[] = [
  body('title')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('category')
    .isIn(Object.values(Category))
    .withMessage('Invalid category'),
  body('location_from')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Pickup location is required and must be between 1-500 characters'),
  body('location_to')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Destination location is required and must be between 1-500 characters'),
  body('budget')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Budget must be between 0.01 and 10000'),
  body('urgency')
    .optional()
    .isIn(Object.values(Urgency))
    .withMessage('Invalid urgency level'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('estimated_duration_min')
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage('Estimated duration must be between 1 and 1440 minutes'),
  body('distance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Distance cannot be negative')
];

export const validateErrandId: ValidationChain[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid errand ID')
    .custom((value) => {
      const id = validateIdParam(value);
      if (!id) {
        throw new Error('Invalid errand ID format');
      }
      return true;
    })
];

export const validateCancelErrand: ValidationChain[] = [
  ...validateErrandId,
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
];

export const validatePreviewEarnings: ValidationChain[] = [
  body('basePrice')
    .isFloat({ min: 0.01 })
    .withMessage('Base price must be a positive number'),
  body('category')
    .isIn(Object.values(Category))
    .withMessage('Invalid category'),
  body('urgency')
    .optional()
    .isIn(Object.values(Urgency))
    .withMessage('Invalid urgency level'),
  body('distance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Distance cannot be negative')
];

export const validateQueryFilters = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('category')
    .optional()
    .isIn(Object.values(Category))
    .withMessage('Invalid category'),
  query('urgency')
    .optional()
    .isIn(Object.values(Urgency))
    .withMessage('Invalid urgency level'),
  query('max_distance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Max distance cannot be negative'),
  query('sort_by')
    .optional()
    .isIn(['urgency', 'distance', 'price', 'created_at'])
    .withMessage('Invalid sort option'),
  query('status')
    .optional()
    .custom((value) => {
      if (!parseErrandStatus(value)) {
        throw new Error('Invalid status value');
      }
      return true;
    })
];

// Middleware to handle validation results
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};