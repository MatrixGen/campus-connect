import { Router } from 'express';
import errandController from '../controllers/errandController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Errand management
router.post('/', errandController.createErrand);
router.get('/available', errandController.getAvailableErrands);
router.get('/my-requests', errandController.getMyRequests);
router.get('/my-jobs', errandController.getMyJobs);
router.get('/stats', errandController.getErrandStats);
router.post('/preview-earnings', errandController.previewEarnings);

// Specific errand operations
router.get('/:id', errandController.getErrandDetails);
router.post('/:id/accept', errandController.acceptErrand);
router.post('/:id/start', errandController.startErrand);
router.post('/:id/complete', errandController.completeErrand);
router.post('/:id/cancel', errandController.cancelErrand);

export default router;