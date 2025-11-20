/*/ middleware/validateErrand.ts
import { Request, Response, NextFunction } from 'express';
import { Category, ErrandStatus, Urgency } from '../types/errand';
import { VALID_CATEGORIES, VALID_STATUSES, VALID_URGENCY } from '../constants/errand';

// Define typed request bodies
interface CreateErrandBody {
  title?: string;
  category?: string;
  location_from?: string;
  location_to?: string;
  budget?: number;
  urgency?: string;
  description?: string;
}

interface UpdateStatusBody {
  status?: string;
}

// Middleware to validate errand creation
export function validateCreateErrand(
  req: Request<{}, {}, CreateErrandBody>,
  res: Response,
  next: NextFunction
) {
  const { title, category, location_from, location_to, budget, urgency } = req.body;

  // Required fields check
  if (!title || !category || !location_from || !location_to || !budget) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: title, category, location_from, location_to, budget'
    });
  }

  // Validate category
  if (!VALID_CATEGORIES.includes(category as Category)) {
    return res.status(400).json({
      success: false,
      message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
    });
  }

  // Validate urgency
  const finalUrgency = urgency || 'standard';
  if (!VALID_URGENCY.includes(finalUrgency as Urgency)) {
    return res.status(400).json({
      success: false,
      message: `Invalid urgency. Must be one of: ${VALID_URGENCY.join(', ')}`
    });
  }

  // Cast validated values back to req.body so downstream code sees correct types
  req.body.category = category as Category;
  req.body.urgency = finalUrgency as Urgency;

  next();
}

// Middleware to validate status updates
export function validateUpdateStatus(
  req: Request<{}, {}, UpdateStatusBody>,
  res: Response,
  next: NextFunction
) {
  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status as ErrandStatus)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
    });
  }

  // Cast to StatusType
  req.body.status = status as ErrandStatus;

  next();
}*/
