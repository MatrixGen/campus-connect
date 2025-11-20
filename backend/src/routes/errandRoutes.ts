import { Router } from 'express';
import errandController, {
  validateErrandCreation,
  validateErrandId,
  validateCancelErrand,
  validatePreviewEarnings,
  validateQueryFilters,
  handleValidationErrors
} from '../controllers/errandController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Errand management
router.post(
  '/',
  validateErrandCreation,
  handleValidationErrors,
  errandController.createErrand
);

router.get(
  '/available',
  validateQueryFilters,
  handleValidationErrors,
  errandController.getAvailableErrands
);

router.get(
  '/my-requests',
  validateQueryFilters,
  handleValidationErrors,
  errandController.getMyRequests
);

router.get(
  '/my-jobs',
  validateQueryFilters,
  handleValidationErrors,
  errandController.getMyJobs
);

router.get(
  '/stats',
  errandController.getErrandStats
);

router.post(
  '/preview-earnings',
  validatePreviewEarnings,
  handleValidationErrors,
  errandController.previewEarnings
);

// Specific errand operations
router.get(
  '/:id',
  validateErrandId,
  handleValidationErrors,
  errandController.getErrandDetails
);

router.post(
  '/:id/accept',
  validateErrandId,
  handleValidationErrors,
  errandController.acceptErrand
);

router.post(
  '/:id/start',
  validateErrandId,
  handleValidationErrors,
  errandController.startErrand
);

router.post(
  '/:id/complete',
  validateErrandId,
  handleValidationErrors,
  errandController.completeErrand
);

router.post(
  '/:id/cancel',
  validateCancelErrand,
  handleValidationErrors,
  errandController.cancelErrand
);

// Update errand (if you have this method)
router.patch(
  '/:id',
  validateErrandId,
  handleValidationErrors,
  errandController.updateErrand
);

export default router;