// tests/integration/adminController.test.ts
import request from 'supertest';
import express from 'express';
import AdminController from '../../src/controllers/adminController';
import adminService from '../../src/services/adminService';

// Mock dependencies
jest.mock('../../src/services/adminService');
jest.mock('../../src/middleware/authMiddleware');

const mockedAdminService = adminService as jest.Mocked<typeof adminService>;

// Mock console.error to avoid test noise
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

const app = express();
app.use(express.json());

// Mock admin auth middleware
app.use((req: any, res: any, next: any) => {
  req.user = { userId: 1, role: 'admin', is_admin: true };
  next();
});

// Admin routes
app.get('/admin/overview', AdminController.getPlatformOverview);
app.get('/admin/analytics', AdminController.getAnalytics);
app.get('/admin/users', AdminController.getUsers);
app.patch('/admin/users/:id', AdminController.updateUser);
app.get('/admin/errands', AdminController.getErrands);
app.patch('/admin/errands/:id', AdminController.updateErrand);
app.get('/admin/transactions', AdminController.getTransactions);
app.get('/admin/reviews', AdminController.getReviews);
app.get('/admin/runners', AdminController.getRunners);
app.patch('/admin/runners/:id', AdminController.updateRunner);
app.get('/admin/reports', AdminController.getReports);
app.patch('/admin/reports/:id', AdminController.updateReport);
app.get('/admin/system-health', AdminController.getSystemHealth);

describe('AdminController Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (console.error as jest.Mock).mockClear();
  });

  describe('GET /admin/overview', () => {
    it('should return platform overview successfully', async () => {
      const mockOverview = {
        totalUsers: 150,
        totalErrands: 500,
        totalTransactions: 450,
        totalRevenue: 12500.50,
        activeRunners: 45,
        pendingVerifications: 12,
        recentGrowth: {
          users: 15,
          errands: 50,
          revenue: 1200.75
        }
      };

      mockedAdminService.getPlatformOverview.mockResolvedValue(mockOverview as any);

      const response = await request(app)
        .get('/admin/overview')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockOverview
      });
      expect(mockedAdminService.getPlatformOverview).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors for platform overview', async () => {
      const error = new Error('Database error');
      mockedAdminService.getPlatformOverview.mockRejectedValue(error);

      const response = await request(app)
        .get('/admin/overview')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error while fetching platform overview');
      expect(console.error).toHaveBeenCalledWith('Get platform overview error:', error);
    });
  });

  describe('GET /admin/analytics', () => {
    it('should return analytics for specified period', async () => {
      const mockAnalytics = {
        period: '7d',
        userGrowth: 25,
        errandGrowth: 80,
        revenueGrowth: 1500.25,
        topCategories: ['Food Delivery', 'Grocery Shopping'],
        activeHours: [10, 14, 18],
        completionRate: 0.85
      };

      mockedAdminService.getAnalytics.mockResolvedValue(mockAnalytics as any);

      const response = await request(app)
        .get('/admin/analytics')
        .query({ period: '7d' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalytics);
      expect(mockedAdminService.getAnalytics).toHaveBeenCalledWith('7d');
    });

    it('should use default period when not specified', async () => {
      const mockAnalytics = { period: '7d' };
      mockedAdminService.getAnalytics.mockResolvedValue(mockAnalytics as any);

      await request(app)
        .get('/admin/analytics')
        .expect(200);

      expect(mockedAdminService.getAnalytics).toHaveBeenCalledWith('7d');
    });

    it('should handle analytics service errors', async () => {
      const error = new Error('Analytics error');
      mockedAdminService.getAnalytics.mockRejectedValue(error);

      const response = await request(app)
        .get('/admin/analytics')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Get analytics error:', error);
    });
  });

  describe('GET /admin/users', () => {
    it('should return users with pagination and filters', async () => {
      const mockUsers = {
        users: [
          {
            id: 1,
            full_name: 'Test User',
            email: 'test@example.com',
            user_type: 'customer',
            verification_status: 'verified',
            is_active: true,
            created_at: new Date()
          }
        ],
        total: 1,
        page: 1,
        totalPages: 1
      };

      mockedAdminService.getUsers.mockResolvedValue(mockUsers as any);

      const response = await request(app)
        .get('/admin/users')
        .query({
          page: 1,
          limit: 20,
          search: 'test',
          user_type: 'customer',
          verification_status: 'verified'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockedAdminService.getUsers).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        search: 'test',
        user_type: 'customer',
        verification_status: 'verified'
      });
    });

    it('should use default pagination values', async () => {
      const mockUsers = { users: [], total: 0, page: 1, totalPages: 0 };
      mockedAdminService.getUsers.mockResolvedValue(mockUsers as any);

      await request(app)
        .get('/admin/users')
        .expect(200);

      expect(mockedAdminService.getUsers).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        search: undefined,
        user_type: undefined,
        verification_status: undefined
      });
    });

    it('should handle user service errors', async () => {
      const error = new Error('User service error');
      mockedAdminService.getUsers.mockRejectedValue(error);

      const response = await request(app)
        .get('/admin/users')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Get users error:', error);
    });
  });

  describe('PATCH /admin/users/:id', () => {
    it('should update user successfully', async () => {
      const mockUpdatedUser = {
        id: 1,
        full_name: 'Updated User',
        verification_status: 'verified',
        is_active: true,
        user_type: 'customer',
        is_admin: false
      };

      mockedAdminService.updateUser.mockResolvedValue(mockUpdatedUser as any);

      const updateData = {
        verification_status: 'verified',
        is_active: true,
        user_type: 'customer',
        is_admin: false
      };

      const response = await request(app)
        .patch('/admin/users/1')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'User updated successfully',
        data: mockUpdatedUser
      });
      expect(mockedAdminService.updateUser).toHaveBeenCalledWith(1, updateData);
    });

    it('should return 404 for non-existent user', async () => {
      const error = new Error('User not found');
      mockedAdminService.updateUser.mockRejectedValue(error);

      const response = await request(app)
        .patch('/admin/users/999')
        .send({ verification_status: 'verified' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
      expect(console.error).toHaveBeenCalledWith('Update user error:', error);
    });

    it('should handle invalid user ID gracefully', async () => {
      const response = await request(app)
        .patch('/admin/users/invalid')
        .send({ verification_status: 'verified' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle update user service errors', async () => {
      const error = new Error('Update failed');
      mockedAdminService.updateUser.mockRejectedValue(error);

      const response = await request(app)
        .patch('/admin/users/1')
        .send({ verification_status: 'verified' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Update user error:', error);
    });
  });

  describe('GET /admin/errands', () => {
    it('should return errands with filters', async () => {
      const mockErrands = {
        errands: [
          {
            id: 1,
            title: 'Test Errand',
            status: 'pending',
            category: 'food_delivery',
            customer_id: 1,
            runner_id: null,
            final_price: 25.50,
            created_at: new Date()
          }
        ],
        total: 1,
        page: 1,
        totalPages: 1
      };

      mockedAdminService.getErrands.mockResolvedValue(mockErrands as any);

      const response = await request(app)
        .get('/admin/errands')
        .query({
          status: 'pending',
          category: 'food_delivery',
          date_from: '2024-01-01',
          date_to: '2024-01-31',
          page: 1,
          limit: 20
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockedAdminService.getErrands).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: 'pending',
        category: 'food_delivery',
        date_from: '2024-01-01',
        date_to: '2024-01-31'
      });
    });

    it('should handle errand service errors', async () => {
      const error = new Error('Errand service error');
      mockedAdminService.getErrands.mockRejectedValue(error);

      const response = await request(app)
        .get('/admin/errands')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Get errands error:', error);
    });
  });

  describe('PATCH /admin/errands/:id', () => {
    it('should update errand successfully', async () => {
      const mockUpdatedErrand = {
        id: 1,
        status: 'completed',
        final_price: 30.00,
        runner_id: 2
      };

      mockedAdminService.updateErrand.mockResolvedValue(mockUpdatedErrand as any);

      const updateData = {
        status: 'completed',
        final_price: 30.00,
        runner_id: 2
      };

      const response = await request(app)
        .patch('/admin/errands/1')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Errand updated successfully',
        data: mockUpdatedErrand
      });
      expect(mockedAdminService.updateErrand).toHaveBeenCalledWith(1, updateData);
    });

    it('should return 404 for non-existent errand', async () => {
      const error = new Error('Errand not found');
      mockedAdminService.updateErrand.mockRejectedValue(error);

      const response = await request(app)
        .patch('/admin/errands/999')
        .send({ status: 'completed' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Errand not found');
      expect(console.error).toHaveBeenCalledWith('Update errand error:', error);
    });
  });

  describe('GET /admin/transactions', () => {
    it('should return transactions with filters', async () => {
      const mockTransactions = {
        transactions: [
          {
            id: 1,
            amount: 25.50,
            payment_status: 'completed',
            errand_id: 1,
            created_at: new Date()
          }
        ],
        total: 1,
        page: 1,
        totalPages: 1
      };

      mockedAdminService.getTransactions.mockResolvedValue(mockTransactions as any);

      const response = await request(app)
        .get('/admin/transactions')
        .query({
          payment_status: 'completed',
          date_from: '2024-01-01',
          date_to: '2024-01-31',
          page: 1,
          limit: 20
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockedAdminService.getTransactions).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        payment_status: 'completed',
        date_from: '2024-01-01',
        date_to: '2024-01-31'
      });
    });
  });

  describe('GET /admin/reviews', () => {
    it('should return reviews with rating filter', async () => {
      const mockReviews = {
        reviews: [
          {
            id: 1,
            rating: 5,
            comment: 'Great service!',
            errand_id: 1,
            reviewer_id: 1,
            reviewee_id: 2,
            created_at: new Date()
          }
        ],
        total: 1,
        page: 1,
        totalPages: 1
      };

      mockedAdminService.getReviews.mockResolvedValue(mockReviews as any);

      const response = await request(app)
        .get('/admin/reviews')
        .query({
          rating: '5',
          page: 1,
          limit: 20
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockedAdminService.getReviews).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        rating: '5'
      });
    });
  });

  describe('GET /admin/runners', () => {
    it('should return runners with approval filter', async () => {
      const mockRunners = {
        runners: [
          {
            id: 1,
            user_id: 2,
            is_approved: true,
            is_available: true,
            rating: 4.5,
            completed_errands: 25,
            user: {
              full_name: 'Test Runner',
              email: 'runner@example.com'
            }
          }
        ],
        total: 1,
        page: 1,
        totalPages: 1
      };

      mockedAdminService.getRunners.mockResolvedValue(mockRunners as any);

      const response = await request(app)
        .get('/admin/runners')
        .query({
          is_approved: 'true',
          search: 'test',
          page: 1,
          limit: 20
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockedAdminService.getRunners).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        is_approved: 'true',
        search: 'test'
      });
    });
  });

  describe('PATCH /admin/runners/:id', () => {
    it('should update runner approval status', async () => {
      const mockUpdatedRunner = {
        id: 1,
        is_approved: true,
        rejection_reason: null,
        is_available: true
      };

      mockedAdminService.updateRunner.mockResolvedValue(mockUpdatedRunner as any);

      const updateData = {
        is_approved: true,
        rejection_reason: null,
        is_available: true
      };

      const response = await request(app)
        .patch('/admin/runners/1')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Runner updated successfully');
      expect(mockedAdminService.updateRunner).toHaveBeenCalledWith(1, updateData);
    });

    it('should return 404 for non-existent runner', async () => {
      const error = new Error('Runner not found');
      mockedAdminService.updateRunner.mockRejectedValue(error);

      const response = await request(app)
        .patch('/admin/runners/999')
        .send({ is_approved: true })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Runner not found');
    });
  });

  describe('GET /admin/reports', () => {
    it('should return reports with status and type filters', async () => {
      const mockReports = {
        reports: [
          {
            id: 1,
            report_type: 'user_behavior',
            status: 'pending',
            reporter_id: 1,
            reported_user_id: 2,
            description: 'Inappropriate behavior',
            created_at: new Date()
          }
        ],
        total: 1,
        page: 1,
        totalPages: 1
      };

      mockedAdminService.getReports.mockResolvedValue(mockReports as any);

      const response = await request(app)
        .get('/admin/reports')
        .query({
          status: 'pending',
          report_type: 'user_behavior',
          page: 1,
          limit: 20
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockedAdminService.getReports).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: 'pending',
        report_type: 'user_behavior'
      });
    });
  });

  describe('PATCH /admin/reports/:id', () => {
    it('should update report status with admin notes', async () => {
      const mockUpdatedReport = {
        id: 1,
        status: 'resolved',
        admin_notes: 'Issue has been addressed with the user.'
      };

      mockedAdminService.updateReport.mockResolvedValue(mockUpdatedReport as any);

      const updateData = {
        status: 'resolved',
        admin_notes: 'Issue has been addressed with the user.'
      };

      const response = await request(app)
        .patch('/admin/reports/1')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Report updated successfully');
      expect(mockedAdminService.updateReport).toHaveBeenCalledWith(1, updateData);
    });

    it('should return 404 for non-existent report', async () => {
      const error = new Error('Report not found');
      mockedAdminService.updateReport.mockRejectedValue(error);

      const response = await request(app)
        .patch('/admin/reports/999')
        .send({ status: 'resolved' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Report not found');
    });
  });

  describe('GET /admin/system-health', () => {
    it('should return system health status', async () => {
      const mockHealth = {
        database: 'healthy',
        cache: 'healthy',
        storage: 'healthy',
        api: 'healthy',
        uptime: '15 days',
        memoryUsage: '45%',
        cpuLoad: '25%',
        activeConnections: 25
      };

      mockedAdminService.getSystemHealth.mockResolvedValue(mockHealth as any);

      const response = await request(app)
        .get('/admin/system-health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHealth);
    });

    it('should handle system health service errors', async () => {
      const error = new Error('Health check failed');
      mockedAdminService.getSystemHealth.mockRejectedValue(error);

      const response = await request(app)
        .get('/admin/system-health')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('system health');
      expect(console.error).toHaveBeenCalledWith('Get system health error:', error);
    });
  });
});