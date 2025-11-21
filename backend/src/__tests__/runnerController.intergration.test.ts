// tests/integration/runnerController.test.ts
import request from 'supertest';
import express from 'express';
import RunnerController from '../../src/controllers/runnerController';
import  runnerService  from '../../src/services/runnerService';
import  validationService  from '../../src/services/validationService';
import models from '../../src/models';

// Mock dependencies
jest.mock('../../src/services/runnerService');
jest.mock('../../src/services/validationService');
jest.mock('../../src/models');
jest.mock('../../src/middleware/authMiddleware');
jest.mock('../../src/utils/logger');

const mockedRunnerService = runnerService as jest.Mocked<typeof runnerService>;
const mockedValidationService = validationService as jest.Mocked<typeof validationService>;
const mockedModels = models as jest.Mocked<typeof models>;

// Create mock functions for Sequelize operations
const mockFindOne = jest.fn();
const mockFindAndCountAll = jest.fn();
const mockCount = jest.fn();
const mockSum = jest.fn();
const mockUpdate = jest.fn();

// Mock the models
mockedModels.Runner.findOne = mockFindOne;
mockedModels.Runner.findAndCountAll = mockFindAndCountAll;
mockedModels.Runner.count = mockCount;
mockedModels.Transaction.sum = mockSum;
mockedModels.User.update = mockUpdate;

// Create express app
const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req: any, res: any, next: any) => {
  req.user = { userId: 1, role: 'user' };
  next();
});

// Setup routes
app.post('/runners/register', RunnerController.registerRunner);
app.get('/runners/profile', RunnerController.getRunnerProfile);
app.put('/runners/profile', RunnerController.updateRunnerProfile);
app.get('/runners/nearby', RunnerController.getNearbyRunners);
app.get('/runners/dashboard', RunnerController.getRunnerDashboard);
app.get('/runners/approval-status', RunnerController.getApprovalStatus);
app.get('/runners/earnings', RunnerController.getEarningsBreakdown);

describe('RunnerController Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /runners/register', () => {
    const validRunnerData = {
      areas_covered: ['Area 1', 'Area 2'],
      transportation_mode: 'bicycle',
      id_card_url: 'https://example.com/id.jpg',
      student_card_url: 'https://example.com/student.jpg'
    };

    it('should register runner successfully with valid data', async () => {
      // Mock validation
      mockedValidationService.validateRunnerRegistration.mockReturnValue({
        isValid: true
      });

      // Mock service calls
      mockedRunnerService.checkExistingRunner.mockResolvedValue(false);
      mockedRunnerService.updateUserType.mockResolvedValue(undefined);
      mockedRunnerService.createRunnerProfile.mockResolvedValue({
        id: 1,
        user_id: 1,
        ...validRunnerData,
        is_approved: false,
        documents_verified: false,
        rating: 0,
        total_distance_covered: 0,
        cancellation_rate: 0
      } as any);

      const response = await request(app)
        .post('/runners/register')
        .send(validRunnerData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'Runner registration submitted for approval',
        data: expect.any(Object)
      });

      expect(mockedValidationService.validateRunnerRegistration).toHaveBeenCalledWith(validRunnerData);
      expect(mockedRunnerService.checkExistingRunner).toHaveBeenCalledWith(1);
      expect(mockedRunnerService.updateUserType).toHaveBeenCalledWith(1);
      expect(mockedRunnerService.createRunnerProfile).toHaveBeenCalledWith(1, validRunnerData);
    });

    it('should return 400 for invalid runner data', async () => {
      const invalidData = {
        areas_covered: [], // Empty array
        transportation_mode: 'invalid_mode', // Invalid transportation
        id_card_url: 'not-a-url', // Invalid URL
      };

      mockedValidationService.validateRunnerRegistration.mockReturnValue({
        isValid: false,
        message: 'Validation failed: Invalid transportation mode'
      });

      const response = await request(app)
        .post('/runners/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    it('should return 400 if runner already exists', async () => {
      mockedValidationService.validateRunnerRegistration.mockReturnValue({
        isValid: true
      });
      mockedRunnerService.checkExistingRunner.mockResolvedValue(true);

      const response = await request(app)
        .post('/runners/register')
        .send(validRunnerData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('You are already registered as a runner');
    });

    it('should handle service errors appropriately', async () => {
      mockedValidationService.validateRunnerRegistration.mockReturnValue({
        isValid: true
      });
      mockedRunnerService.checkExistingRunner.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/runners/register')
        .send(validRunnerData)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /runners/profile', () => {
    it('should return runner profile successfully', async () => {
      const mockRunner = {
        id: 1,
        user_id: 1,
        areas_covered: ['Area 1', 'Area 2'],
        transportation_mode: 'bicycle',
        rating: 4.5,
        total_distance_covered: 150.5,
        cancellation_rate: 0.1,
        is_approved: true,
        documents_verified: true
      };

      const mockStatistics = {
        total_orders: 50,
        completed_orders: 45,
        total_earnings: 1000,
        active_orders: 2
      };

      mockedRunnerService.getRunnerByUserId.mockResolvedValue(mockRunner as any);
      mockedRunnerService.getRunnerStatistics.mockResolvedValue(mockStatistics as any);

      const response = await request(app)
        .get('/runners/profile')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile).toEqual(mockRunner);
      expect(response.body.data.statistics).toEqual({
        ...mockStatistics,
        average_rating: 4.5,
        total_distance_covered: 150.5,
        cancellation_rate: 0.1
      });
    });

    it('should return 404 if runner profile not found', async () => {
      mockedRunnerService.getRunnerByUserId.mockResolvedValue(null);

      const response = await request(app)
        .get('/runners/profile')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Runner profile not found');
    });

    it('should handle service errors for getRunnerProfile', async () => {
  mockedRunnerService.getRunnerByUserId.mockRejectedValue(new Error('Database error'));

  const response = await request(app)
    .get('/runners/profile')
    .expect(500);

  expect(response.body.success).toBe(false);
});
  });

  describe('PUT /runners/profile', () => {
    const validUpdateData = {
      areas_covered: ['New Area 1', 'New Area 2'],
      transportation_mode: 'scooter'
    };

    it('should update runner profile successfully', async () => {
      const updatedRunner = {
        id: 1,
        user_id: 1,
        ...validUpdateData,
        rating: 4.5,
        is_approved: true
      };

      mockedValidationService.validateRunnerUpdate.mockReturnValue({
        isValid: true
      });
      mockedRunnerService.updateRunnerProfile.mockResolvedValue(updatedRunner as any);

      const response = await request(app)
        .put('/runners/profile')
        .send(validUpdateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Runner profile updated successfully',
        data: updatedRunner
      });

      expect(mockedValidationService.validateRunnerUpdate).toHaveBeenCalledWith(validUpdateData);
      expect(mockedRunnerService.updateRunnerProfile).toHaveBeenCalledWith(1, validUpdateData);
    });

    it('should return 400 for invalid update data', async () => {
      const invalidData = {
        transportation_mode: 'invalid_mode'
      };

      mockedValidationService.validateRunnerUpdate.mockReturnValue({
        isValid: false,
        message: 'Invalid transportation mode'
      });

      const response = await request(app)
        .put('/runners/profile')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 if runner profile not found during update', async () => {
      mockedValidationService.validateRunnerUpdate.mockReturnValue({
        isValid: true
      });
      mockedRunnerService.updateRunnerProfile.mockRejectedValue(
        new Error('Runner profile not found')
      );

      const response = await request(app)
        .put('/runners/profile')
        .send(validUpdateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Runner profile not found');
    });

    it('should handle service errors during update', async () => {
      mockedValidationService.validateRunnerUpdate.mockReturnValue({
        isValid: true
      });
      mockedRunnerService.updateRunnerProfile.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .put('/runners/profile')
        .send(validUpdateData)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /runners/nearby', () => {
    it('should return nearby runners with pagination', async () => {
      const mockRunners = [
        {
          id: 1,
          user_id: 2,
          areas_covered: ['Downtown'],
          transportation_mode: 'bicycle',
          rating: 4.5,
          is_available: true,
          user: {
            full_name: 'John Doe',
            profile_picture_url: 'https://example.com/avatar.jpg'
          }
        },
        {
          id: 2,
          user_id: 3,
          areas_covered: ['Downtown'],
          transportation_mode: 'scooter',
          rating: 4.8,
          is_available: true,
          user: {
            full_name: 'Jane Smith',
            profile_picture_url: 'https://example.com/avatar2.jpg'
          }
        }
      ];

      const mockResult = {
        runners: mockRunners,
        total: 2
      };

      mockedRunnerService.getNearbyRunners.mockResolvedValue(mockResult as any);

      const response = await request(app)
        .get('/runners/nearby')
        .query({
          area: 'Downtown',
          page: 1,
          limit: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
      expect(response.body.total).toBe(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.totalPages).toBe(1);

      expect(mockedRunnerService.getNearbyRunners).toHaveBeenCalledWith('Downtown', 1, 10);
    });

    it('should use default pagination values when not provided', async () => {
      const mockResult = {
        runners: [],
        total: 0
      };

      mockedRunnerService.getNearbyRunners.mockResolvedValue(mockResult as any);

      const response = await request(app)
        .get('/runners/nearby')
        .expect(200);

      expect(mockedRunnerService.getNearbyRunners).toHaveBeenCalledWith(undefined, 1, 20);
    });

    it('should handle service errors', async () => {
      mockedRunnerService.getNearbyRunners.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/runners/nearby')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /runners/dashboard', () => {
    it('should return runner dashboard data successfully', async () => {
      const mockDashboardData = {
        recent_orders: [
          { id: 1, title: 'Test Errand 1', status: 'completed' },
          { id: 2, title: 'Test Errand 2', status: 'in_progress' }
        ],
        earnings: {
          today: 50,
          this_week: 300,
          this_month: 1200
        },
        active_orders: 2,
        performance_metrics: {
          completion_rate: 95,
          average_rating: 4.5,
          response_time_minutes: 15
        }
      };

      mockedRunnerService.getRunnerDashboard.mockResolvedValue(mockDashboardData as any);

      const response = await request(app)
        .get('/runners/dashboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDashboardData);
      expect(mockedRunnerService.getRunnerDashboard).toHaveBeenCalledWith(1);
    });

    it('should return 404 if runner profile not found for dashboard', async () => {
      mockedRunnerService.getRunnerDashboard.mockRejectedValue(
        new Error('Runner profile not found')
      );

      const response = await request(app)
        .get('/runners/dashboard')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Runner profile not found');
    });

    it('should handle service errors for dashboard', async () => {
      mockedRunnerService.getRunnerDashboard.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/runners/dashboard')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /runners/approval-status', () => {
    it('should return approval status successfully', async () => {
      const mockRunner = {
        id: 1,
        user_id: 1,
        is_approved: true,
        documents_verified: true,
        approved_at: '2023-01-01T00:00:00.000Z',
        rejection_reason: null,
        id_card_url: 'https://example.com/id.jpg',
        student_card_url: 'https://example.com/student.jpg'
      };

      mockedRunnerService.getRunnerByUserId.mockResolvedValue(mockRunner as any);

      const response = await request(app)
        .get('/runners/approval-status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        is_approved: true,
        documents_verified: true,
        approved_at: '2023-01-01T00:00:00.000Z',
        rejection_reason: null,
        documents: {
          id_card_url: 'https://example.com/id.jpg',
          student_card_url: 'https://example.com/student.jpg'
        }
      });
    });

    it('should return 404 if runner profile not found for approval status', async () => {
      mockedRunnerService.getRunnerByUserId.mockResolvedValue(null);

      const response = await request(app)
        .get('/runners/approval-status')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle service errors for approval status', async () => {
      mockedRunnerService.getRunnerByUserId.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/runners/approval-status')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /runners/earnings', () => {
    it('should return earnings breakdown for specified period', async () => {
      const mockEarnings = {
        total: 1500,
        breakdown: [
          { period: '2023-01', amount: 500 },
          { period: '2023-02', amount: 600 },
          { period: '2023-03', amount: 400 }
        ],
        currency: 'USD'
      };

      mockedRunnerService.getEarningsBreakdown.mockResolvedValue(mockEarnings as any);

      const response = await request(app)
        .get('/runners/earnings')
        .query({ period: 'month' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockEarnings);
      expect(mockedRunnerService.getEarningsBreakdown).toHaveBeenCalledWith(1, 'month');
    });

    it('should use default period when not specified', async () => {
      const mockEarnings = {
        total: 1500,
        breakdown: [],
        currency: 'USD'
      };

      mockedRunnerService.getEarningsBreakdown.mockResolvedValue(mockEarnings as any);

      const response = await request(app)
        .get('/runners/earnings')
        .expect(200);

      expect(mockedRunnerService.getEarningsBreakdown).toHaveBeenCalledWith(1, 'month');
    });

    it('should handle service errors for earnings', async () => {
      mockedRunnerService.getEarningsBreakdown.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/runners/earnings')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle different types of service errors appropriately', async () => {
    const testCases = [
      { 
        method: 'post' as const, 
        endpoint: '/runners/register', 
        data: {
          areas_covered: ['Area 1'],
          transportation_mode: 'bicycle',
          id_card_url: 'https://example.com/id.jpg',
          student_card_url: 'https://example.com/student.jpg'
        },
        // For validation errors, we need to mock the validation service to return invalid
        setupMock: () => {
          mockedValidationService.validateRunnerRegistration.mockReturnValue({
            isValid: false,
            message: 'Validation failed'
          });
        },
        expectedStatus: 400 
      },
      { 
        method: 'get' as const, 
        endpoint: '/runners/profile', 
        data: null,
        setupMock: () => {
          // For getRunnerProfile, "Runner profile not found" returns 404 from the service
          // but the controller handles it by checking if runner is null, not by catching errors
          mockedRunnerService.getRunnerByUserId.mockResolvedValue(null);
        },
        expectedStatus: 404 
      },
      { 
        method: 'put' as const, 
        endpoint: '/runners/profile', 
        data: { areas_covered: ['New Area'] },
        setupMock: () => {
          mockedValidationService.validateRunnerUpdate.mockReturnValue({ isValid: true });
          mockedRunnerService.updateRunnerProfile.mockRejectedValue(new Error('Database connection failed'));
        },
        expectedStatus: 500 
      }
    ];

    for (const { method, endpoint, data, setupMock, expectedStatus } of testCases) {
      // Reset mocks for each test case
      jest.clearAllMocks();
      
      // Setup the specific mock for this test case
      setupMock();

      const requestCall = data ? 
        request(app)[method](endpoint).send(data) : 
        request(app)[method](endpoint);

      const response = await requestCall.expect(expectedStatus);

      expect(response.body.success).toBe(false);
    }
  });

    it('should handle validation errors for registration', async () => {
      // Test specific validation error case
      mockedValidationService.validateRunnerRegistration.mockReturnValue({
        isValid: false,
        message: 'Invalid transportation mode'
      });

      const response = await request(app)
        .post('/runners/register')
        .send({
          areas_covered: ['Area 1'],
          transportation_mode: 'invalid_mode',
          id_card_url: 'https://example.com/id.jpg',
          student_card_url: 'https://example.com/student.jpg'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid transportation mode');
    });

    it('should handle existing runner error', async () => {
      mockedValidationService.validateRunnerRegistration.mockReturnValue({
        isValid: true
      });
      mockedRunnerService.checkExistingRunner.mockResolvedValue(true);

      const response = await request(app)
        .post('/runners/register')
        .send({
          areas_covered: ['Area 1'],
          transportation_mode: 'bicycle',
          id_card_url: 'https://example.com/id.jpg',
          student_card_url: 'https://example.com/student.jpg'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('You are already registered as a runner');
    });
  });
});