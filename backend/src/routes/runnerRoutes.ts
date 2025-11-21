import { Router } from 'express';
import runnerController from '../controllers/runnerController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Runner registration and profile management
router.post('/register', runnerController.registerRunner);
router.get('/profile', runnerController.getRunnerProfile);
router.put('/profile', runnerController.updateRunnerProfile);
router.get('/dashboard', runnerController.getRunnerDashboard);

// Public runner information (for customers)
router.get('/nearby', runnerController.getNearbyRunners);

export default router;