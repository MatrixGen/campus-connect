import { Router } from 'express';
import reviewController from '../controllers/reviewController';
import reportController from '../controllers/reportController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Review routes
router.post('/reviews/submit', reviewController.submitReview);
router.get('/reviews/user/:userId', reviewController.getUserReviews);
router.get('/reviews/user/:userId/stats', reviewController.getReviewStats);

// Report routes
router.post('/reports/submit', reportController.submitReport);
router.get('/reports/my-reports', reportController.getMyReports);
router.get('/reports/against-me', reportController.getReportsAgainstMe);

export default router;