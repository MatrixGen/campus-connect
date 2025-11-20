// tests/integration/errandController.test.ts
import request from 'supertest';
import express from 'express';
import ErrandController from '../controllers/errandController';
//import {validateErrandCreation, validateErrandId, validateCancelErrand, validatePreviewEarnings } from '../controllers/errandController';
import { errandService } from '../../src/services/errandService';
import models from '../../src/models';
import { Category, Urgency, ErrandStatus } from '../../src/types/errand';

// Mock dependencies
jest.mock('../../src/services/errandService');
jest.mock('../../src/models');
jest.mock('../../src/middleware/authMiddleware');
jest.mock('../../src/utils/logger');

const mockedErrandService = errandService as jest.Mocked<typeof errandService>;
const mockedModels = models as jest.Mocked<typeof models>;

// Create mock functions for Sequelize operations
const mockFindOne = jest.fn();
const mockFindByPk = jest.fn();
const mockFindAndCountAll = jest.fn();
const mockCount = jest.fn();
const mockSum = jest.fn();
const mockUpdate = jest.fn();

// Mock the models
mockedModels.Runner.findOne = mockFindOne;
mockedModels.Errand.findByPk = mockFindByPk;
mockedModels.Errand.findAndCountAll = mockFindAndCountAll;
mockedModels.Errand.count = mockCount;
mockedModels.Transaction.sum = mockSum;

// Fix the route order in your test file
const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req: any, res: any, next: any) => {
  req.user = { userId: 1, role: 'customer' };
  next();
});

// Import validation middleware
import {
  validateErrandCreation,
  validateErrandId,
  validateCancelErrand,
  validatePreviewEarnings,
  validateQueryFilters,
  handleValidationErrors
} from '../../src/controllers/errandController';

// Setup routes - SPECIFIC ROUTES FIRST, GENERIC ROUTES LAST
app.post('/errands', 
  validateErrandCreation, 
  handleValidationErrors, 
  ErrandController.createErrand
);

app.get('/errands/available', 
  validateQueryFilters, 
  handleValidationErrors, 
  ErrandController.getAvailableErrands
);

app.get('/errands/my-requests', 
  validateQueryFilters, 
  handleValidationErrors, 
  ErrandController.getMyRequests
);

app.get('/errands/my-jobs', 
  validateQueryFilters, 
  handleValidationErrors, 
  ErrandController.getMyJobs
);

app.get('/errands/stats',  // ← This should come BEFORE the :id routes
  ErrandController.getErrandStats
);

app.post('/errands/preview-earnings', 
  validatePreviewEarnings, 
  handleValidationErrors, 
  ErrandController.previewEarnings
);

// All :id routes come AFTER the specific routes
app.post('/errands/:id/accept', 
  validateErrandId, 
  handleValidationErrors, 
  ErrandController.acceptErrand
);

app.post('/errands/:id/start', 
  validateErrandId, 
  handleValidationErrors, 
  ErrandController.startErrand
);

app.post('/errands/:id/complete', 
  validateErrandId, 
  handleValidationErrors, 
  ErrandController.completeErrand
);

app.post('/errands/:id/cancel', 
  validateCancelErrand, 
  handleValidationErrors, 
  ErrandController.cancelErrand
);

app.get('/errands/:id', 
  validateErrandId, 
  handleValidationErrors, 
  ErrandController.getErrandDetails
);

app.patch('/errands/:id', 
  validateErrandId, 
  handleValidationErrors, 
  ErrandController.updateErrand
);

describe('ErrandController Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /errands', () => {
    const validErrandData = {
      title: 'Test Errand',
      category: Category.FOOD_DELIVERY,
      location_from: '123 Main St',
      location_to: '456 Oak Ave',
      budget: 25.50,
      urgency: Urgency.STANDARD,
      description: 'Test description',
      estimated_duration_min: 30,
      distance: 5.2
    };

    it('should create errand successfully with valid data', async () => {
      const mockErrand = {
        id: 1,
        ...validErrandData,
        customerId: 1,
        status: ErrandStatus.PENDING
      };

      mockedErrandService.createErrand.mockResolvedValue(mockErrand as any);

      const response = await request(app)
        .post('/errands')
        .send(validErrandData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'Errand created successfully',
        data: mockErrand
      });

      expect(mockedErrandService.createErrand).toHaveBeenCalledWith({
        ...validErrandData,
        customerId: 1
      });
    });

    it('should return 400 for invalid errand data', async () => {
      const invalidData = {
        title: '', // Empty title
        category: 'INVALID_CATEGORY',
        location_from: 'A'.repeat(600), // Too long
        budget: 0, // Invalid budget
      };

      const response = await request(app)
        .post('/errands')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeInstanceOf(Array);
    });

    it('should handle service errors appropriately', async () => {
      mockedErrandService.createErrand.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/errands')
        .send(validErrandData)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /errands/available', () => {
    beforeEach(() => {
      // Mock successful runner check
      mockFindOne.mockResolvedValue({
        user_id: 1,
        is_available: true,
        is_approved: true
      } as any);
    });

    it('should return available errands with filters', async () => {
      const mockErrands = [
        {
          id: 1,
          title: 'Test Errand 1',
          category: Category.FOOD_DELIVERY,
          status: ErrandStatus.PENDING,
          customer_id: 2,
          urgency: Urgency.STANDARD,
          distance_km: 2.5,
          final_price: 20.50,
          created_at: new Date()
        }
      ];

      mockFindAndCountAll.mockResolvedValue({
        count: 1,
        rows: mockErrands
      });

      const response = await request(app)
        .get('/errands/available')
        .query({
          category: Category.FOOD_DELIVERY,
          urgency: Urgency.STANDARD,
          max_distance: 5,
          page: 1,
          limit: 10,
          sort_by: 'urgency'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toBeDefined();
    });

    it('should return 403 when runner is not available', async () => {
      mockFindOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/errands/available')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not available');
    });
  });

  describe('GET /errands/my-requests', () => {
    it('should return customer errands with pagination', async () => {
      const mockErrands = [
        {
          id: 1,
          title: 'My Errand',
          status: ErrandStatus.PENDING,
          customer_id: 1
        }
      ];

      mockFindAndCountAll.mockResolvedValue({
        count: 1,
        rows: mockErrands
      });

      const response = await request(app)
        .get('/errands/my-requests')
        .query({ status: ErrandStatus.PENDING, page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('GET /errands/my-jobs', () => {
    beforeEach(() => {
      mockFindOne.mockResolvedValue({
        user_id: 1
      } as any);
    });

    it('should return runner jobs with proper categorization', async () => {
      const mockJobs = [
        {
          id: 1,
          title: 'Active Job',
          status: ErrandStatus.IN_PROGRESS,
          runner_id: 1,
          accepted_at: new Date()
        },
        {
          id: 2,
          title: 'Completed Job',
          status: ErrandStatus.COMPLETED,
          runner_id: 1,
          accepted_at: new Date()
        }
      ];

      mockFindAndCountAll.mockResolvedValue({
        count: 2,
        rows: mockJobs
      });

      const response = await request(app)
        .get('/errands/my-jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.active).toBeDefined();
      expect(response.body.data.completed).toBeDefined();
      expect(response.body.counts).toBeDefined();
    });

    it('should return 403 when runner profile not found', async () => {
      mockFindOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/errands/my-jobs')
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /errands/:id/accept', () => {
    it('should accept errand successfully', async () => {
      const mockErrand = {
        id: 1,
        status: ErrandStatus.ACCEPTED,
        runner_id: 1
      };

      mockedErrandService.acceptErrand.mockResolvedValue(mockErrand as any);

      const response = await request(app)
        .post('/errands/1/accept')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockedErrandService.acceptErrand).toHaveBeenCalledWith(1, 1);
    });

    it('should return 400 for invalid errand ID', async () => {
      const response = await request(app)
        .post('/errands/invalid/accept')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle service errors for accepting errand', async () => {
      mockedErrandService.acceptErrand.mockRejectedValue(new Error('Errand not available'));

      const response = await request(app)
        .post('/errands/1/accept')
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /errands/:id/start', () => {
    it('should start errand successfully', async () => {
      const mockErrand = {
        id: 1,
        status: ErrandStatus.IN_PROGRESS
      };

      mockedErrandService.startErrand.mockResolvedValue(mockErrand as any);

      const response = await request(app)
        .post('/errands/1/start')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockedErrandService.startErrand).toHaveBeenCalledWith(1, 1);
    });
  });

  describe('POST /errands/:id/complete', () => {
    it('should complete errand successfully', async () => {
      const mockErrand = {
        id: 1,
        status: ErrandStatus.COMPLETED
      };

      mockedErrandService.completeErrand.mockResolvedValue(mockErrand as any);

      const response = await request(app)
        .post('/errands/1/complete')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockedErrandService.completeErrand).toHaveBeenCalledWith(1, 1);
    });
  });

  describe('POST /errands/:id/cancel', () => {
    it('should cancel errand with reason', async () => {
      const mockErrand = {
        id: 1,
        status: ErrandStatus.CANCELLED
      };

      mockedErrandService.cancelErrand.mockResolvedValue(mockErrand as any);

      const response = await request(app)
        .post('/errands/1/cancel')
        .send({ reason: 'Changed my mind' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockedErrandService.cancelErrand).toHaveBeenCalledWith(1, 1, 'Changed my mind');
    });
  });

  describe('GET /errands/:id', () => {
    it('should return errand details for authorized user', async () => {
      const mockErrand = {
        id: 1,
        title: 'Test Errand',
        customer_id: 1,
        runner_id: null,
        customer: { id: 1, full_name: 'Test Customer' },
        runner: null,
        transaction: null,
        review: null
      };

      mockFindByPk.mockResolvedValue(mockErrand as any);

      const response = await request(app)
        .get('/errands/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
    });

    it('should return 404 for non-existent errand', async () => {
      mockFindByPk.mockResolvedValue(null);

      const response = await request(app)
        .get('/errands/999')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 for unauthorized access', async () => {
      const mockErrand = {
        id: 1,
        customer_id: 2, // Different customer
        runner_id: null
      };

      mockFindByPk.mockResolvedValue(mockErrand as any);

      const response = await request(app)
        .get('/errands/1')
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /errands/preview-earnings', () => {
    it('should calculate earnings preview successfully', async () => {
      const mockPricing = {
        basePrice: 20,
        serviceFee: 2,
        platformFee: 1,
        runnerEarnings: 17,
        totalPrice: 23
      };

      mockedErrandService.previewEarnings.mockReturnValue(mockPricing as any);

      const requestData = {
        basePrice: 20,
        category: Category.FOOD_DELIVERY,
        urgency: Urgency.STANDARD,
        distance: 5.2
      };

      const response = await request(app)
        .post('/errands/preview-earnings')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPricing);
    });

    it('should return 400 for invalid pricing data', async () => {
      const invalidData = {
        basePrice: -10, // Invalid negative price
        category: 'INVALID_CATEGORY'
      };

      const response = await request(app)
        .post('/errands/preview-earnings')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

describe('GET /errands/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Debug test to see what's actually happening
  it('debug - should see actual error', async () => {
    mockFindOne.mockResolvedValue(null);
    mockCount.mockResolvedValue(0);
    mockSum.mockResolvedValue(0);

    const response = await request(app)
      .get('/errands/stats');

    console.log('DEBUG Stats response:', JSON.stringify({
      status: response.status,
      body: response.body
    }, null, 2));
  });

  it('should return customer statistics', async () => {
    // Mock as customer (no runner profile)
    mockFindOne.mockResolvedValue(null);

    // Let's be more defensive - mock all possible count calls
    mockCount.mockImplementation(() => Promise.resolve(0));
    
    // But override specific calls if needed
    mockCount
      .mockResolvedValueOnce(10) // totalRequested
      .mockResolvedValueOnce(7)  // completedCount
      .mockResolvedValueOnce(2)  // pendingCount
      .mockResolvedValueOnce(1)  // inProgressCount
      .mockResolvedValueOnce(0); // cancelledCount

    mockSum.mockResolvedValue(150.75);

    const response = await request(app)
      .get('/errands/stats')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });

  it('should return runner statistics', async () => {
    const mockRunner = {
      user_id: 1,
      rating: 4.5,
      is_available: true,
      completed_errands: 50
    };

    mockFindOne.mockResolvedValue(mockRunner as any);

    // Use mockImplementation for more control
    let callCount = 0;
    mockCount.mockImplementation(() => {
      const results = [45, 2, 1, 48];
      return Promise.resolve(results[callCount++] || 0);
    });

    mockSum
      .mockResolvedValueOnce(1000)
      .mockResolvedValueOnce(150)
      .mockResolvedValueOnce(500);

    const response = await request(app)
      .get('/errands/stats')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.total_earnings).toBe(1000);
  });
});

  describe('PATCH /errands/:id', () => {
    it('should update errand successfully', async () => {
      const mockErrand = {
        id: 1,
        customer_id: 1,
        status: ErrandStatus.PENDING,
        update: jest.fn().mockResolvedValue(true)
      };

      mockFindByPk
        .mockResolvedValueOnce(mockErrand as any) // First call for finding
        .mockResolvedValueOnce({ // Second call for returning updated
          id: 1,
          title: 'Updated Title',
          description: 'Updated description',
          customer_id: 1,
          status: ErrandStatus.PENDING,
          customer: { id: 1, full_name: 'Test Customer' }
        } as any);

      const updateData = {
        title: 'Updated Title',
        description: 'Updated description'
      };

      const response = await request(app)
        .patch('/errands/1')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockErrand.update).toHaveBeenCalledWith(updateData);
    });

    it('should return 403 when updating another customers errand', async () => {
      const mockErrand = {
        id: 1,
        customer_id: 2, // Different customer
        status: ErrandStatus.PENDING
      };

      mockFindByPk.mockResolvedValue(mockErrand as any);

      const response = await request(app)
        .patch('/errands/1')
        .send({ title: 'New Title' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when updating non-pending errand', async () => {
      const mockErrand = {
        id: 1,
        customer_id: 1,
        status: ErrandStatus.ACCEPTED // Not pending
      };

      mockFindByPk.mockResolvedValue(mockErrand as any);

      const response = await request(app)
        .patch('/errands/1')
        .send({ title: 'New Title' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('pending');
    });
  });

  describe('Error Handling', () => {
    it('should handle different types of service errors appropriately', async () => {
      const testCases = [
        { error: new Error('not available'), expectedStatus: 403 },
        { error: new Error('not found'), expectedStatus: 404 },
        { error: new Error('already assigned'), expectedStatus: 409 },
        { error: new Error('Too many requests'), expectedStatus: 429 },
        { error: new Error('Invalid data'), expectedStatus: 400 },
        { error: new Error('Unknown error'), expectedStatus: 500 }
      ];

      for (const { error, expectedStatus } of testCases) {
        mockedErrandService.createErrand.mockRejectedValueOnce(error);

        const response = await request(app)
          .post('/errands')
          .send({
            title: 'Test',
            category: Category.FOOD_DELIVERY,
            location_from: 'Test from',
            location_to: 'Test to',
            budget: 20
          })
          .expect(expectedStatus);

        expect(response.body.success).toBe(false);
      }
    });
  });
});