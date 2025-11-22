import { Router } from 'express';
import adminController from '../controllers/adminController';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';

const router = Router();

// All admin routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard & Analytics
router.get('/overview', adminController.getPlatformOverview);
router.get('/analytics', adminController.getAnalytics);
router.get('/system-health', adminController.getSystemHealth);

// User Management
router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);

// Runner Management
router.get('/runners', adminController.getRunners);
router.put('/runners/:id', adminController.updateRunner);

// Errand Management
router.get('/errands', adminController.getErrands);
router.put('/errands/:id', adminController.updateErrand);

// Financial Management
router.get('/transactions', adminController.getTransactions);

// Review Management
router.get('/reviews', adminController.getReviews);

// Report & Dispute Management
router.get('/reports', adminController.getReports);
router.put('/reports/:id', adminController.updateReport);

export default router;