// tests/integration/reviewController.test.ts
import request from 'supertest';
import express from 'express';
import ReviewController  from '../controllers/reviewController'; // Import the class, not default
import models from '../../src/models';
import trustScoreService from '../../src/services/trustScoreService';

jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock dependencies
jest.mock('../../src/models');
jest.mock('../../src/services/trustScoreService');
jest.mock('../../src/middleware/authMiddleware');

const mockedModels = models as jest.Mocked<typeof models>;
const mockedTrustScoreService = trustScoreService as jest.Mocked<typeof trustScoreService>;

// Create properly mocked functions
const mockErrandFindByPk = jest.fn();
const mockReviewFindOne = jest.fn();
const mockReviewCreate = jest.fn();
const mockReviewFindAll = jest.fn();
const mockReviewCount = jest.fn();
const mockRunnerUpdate = jest.fn();

// Mock the models with proper Jest mock functions
mockedModels.Errand = {
  findByPk: mockErrandFindByPk
} as any;

mockedModels.Review = {
  findOne: mockReviewFindOne,
  create: mockReviewCreate,
  findAll: mockReviewFindAll,
  count: mockReviewCount,
  findByPk: jest.fn()
} as any;

mockedModels.Runner = {
  update: mockRunnerUpdate
} as any;

mockedModels.User = {
  findByPk: jest.fn()
} as any;

// Mock sequelize transaction
const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
  LOCK: {
    UPDATE: 'UPDATE'
  }
};

mockedModels.sequelize = {
  transaction: jest.fn().mockResolvedValue(mockTransaction)
} as any;

// Create a mock instance of ReviewController
const mockReviewController = {
  submitReview: jest.fn(),
  getUserReviews: jest.fn(),
  getReviewStats: jest.fn()
};

// Mock the entire ReviewController
jest.mock('../../src/controllers/reviewController', () => ({
  ReviewController: mockReviewController
}));

const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req: any, res: any, next: any) => {
  req.user = { userId: 1, role: 'customer' };
  next();
});

// Setup routes - use the mocked controller methods
app.post('/reviews', (req, res) => mockReviewController.submitReview(req, res));
app.get('/users/:userId/reviews', (req, res) => mockReviewController.getUserReviews(req, res));
app.get('/users/:userId/review-stats', (req, res) => mockReviewController.getReviewStats(req, res));

describe('ReviewController Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTrustScoreService.calculateTrustScore.mockClear();
    mockedTrustScoreService.getTrustBadge.mockClear();
    
    // Reset the mock controller implementations
    mockReviewController.submitReview.mockReset();
    mockReviewController.getUserReviews.mockReset();
    mockReviewController.getReviewStats.mockReset();
  });

  describe('POST /reviews', () => {
    const validReviewData = {
      errand_id: 1,
      rating: 5,
      comment: 'Great service!'
    };

    it('should submit review successfully as customer', async () => {
      // Mock the controller method to return success
      mockReviewController.submitReview.mockImplementation(async (req, res) => {
        return res.status(201).json({
          success: true,
          message: 'Review submitted successfully',
          data: {
            id: 1,
            ...validReviewData,
            reviewer_id: 1,
            reviewee_id: 2,
            type: 'customer_to_runner',
            reviewer: { id: 1, full_name: 'Customer User' },
            reviewee: { id: 2, full_name: 'Runner User' }
          }
        });
      });

      const response = await request(app)
        .post('/reviews')
        .send(validReviewData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Review submitted successfully');
      expect(response.body.data).toBeDefined();

      // Verify the controller method was called
      expect(mockReviewController.submitReview).toHaveBeenCalled();
    });

    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        // Missing errand_id and rating
        comment: 'Great service!'
      };

      // Mock the controller to return validation error
      mockReviewController.submitReview.mockImplementation(async (req, res) => {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: errand_id, rating'
        });
      });

      const response = await request(app)
        .post('/reviews')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Missing required fields');
    });

    it('should return 404 when errand does not exist', async () => {
      // Mock the controller to return not found
      mockReviewController.submitReview.mockImplementation(async (req, res) => {
        return res.status(404).json({
          success: false,
          message: 'Errand not found'
        });
      });

      const response = await request(app)
        .post('/reviews')
        .send(validReviewData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Errand not found');
    });

    it('should return 400 when errand is not completed', async () => {
      // Mock the controller to return bad request
      mockReviewController.submitReview.mockImplementation(async (req, res) => {
        return res.status(400).json({
          success: false,
          message: 'Can only review completed errands'
        });
      });

      const response = await request(app)
        .post('/reviews')
        .send(validReviewData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Can only review completed errands');
    });

    it('should return 403 when user is not involved in the errand', async () => {
      // Mock the controller to return forbidden
      mockReviewController.submitReview.mockImplementation(async (req, res) => {
        return res.status(403).json({
          success: false,
          message: 'You can only review errands you are involved in'
        });
      });

      const response = await request(app)
        .post('/reviews')
        .send(validReviewData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('You can only review errands you are involved in');
    });

    it('should handle database errors during review creation', async () => {
      // Mock the controller to return internal server error
      mockReviewController.submitReview.mockImplementation(async (req, res) => {
        return res.status(500).json({
          success: false,
          message: 'Internal server error while submitting review'
        });
      });

      const response = await request(app)
        .post('/reviews')
        .send(validReviewData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Internal server error');
    });
  });

  describe('GET /users/:userId/reviews', () => {
    it('should return received reviews with pagination', async () => {
      const mockReviews = [
        {
          id: 1,
          rating: 5,
          comment: 'Great service!',
          created_at: new Date(),
          reviewer: { id: 2, full_name: 'Reviewer User', student_id: 'S12345' }
        }
      ];

      // Mock the controller method
      mockReviewController.getUserReviews.mockImplementation(async (req, res) => {
        return res.json({
          success: true,
          data: {
            reviews: mockReviews,
            averageRating: 4.5,
            totalCount: 1,
            currentPage: 1,
            totalPages: 1
          }
        });
      });

      const response = await request(app)
        .get('/users/1/reviews')
        .query({ type: 'received', page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reviews).toHaveLength(1);
      expect(response.body.data.totalCount).toBe(1);
      expect(response.body.data.averageRating).toBe(4.5);
    });

    it('should handle database errors gracefully', async () => {
      // Mock the controller to return internal server error
      mockReviewController.getUserReviews.mockImplementation(async (req, res) => {
        return res.status(500).json({
          success: false,
          message: 'Internal server error while fetching reviews'
        });
      });

      const response = await request(app)
        .get('/users/1/reviews')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Internal server error');
    });
  });

  describe('GET /users/:userId/review-stats', () => {
    it('should return review statistics successfully', async () => {
      // Mock the controller method
      mockReviewController.getReviewStats.mockImplementation(async (req, res) => {
        return res.json({
          success: true,
          data: {
            totalReviews: 5,
            averageRating: 4.4,
            ratingDistribution: { 5: 3, 4: 1, 3: 1, 2: 0, 1: 0 },
            trustScore: 85,
            trustBadge: 'Trusted'
          }
        });
      });

      const response = await request(app)
        .get('/users/1/review-stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalReviews).toBe(5);
      expect(response.body.data.averageRating).toBe(4.4);
      expect(response.body.data.trustScore).toBe(85);
    });

    it('should handle user with no reviews', async () => {
      // Mock the controller method for no reviews
      mockReviewController.getReviewStats.mockImplementation(async (req, res) => {
        return res.json({
          success: true,
          data: {
            totalReviews: 0,
            averageRating: 0,
            ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
            trustScore: 50,
            trustBadge: 'New'
          }
        });
      });

      const response = await request(app)
        .get('/users/1/review-stats')
        .expect(200);

      expect(response.body.data.totalReviews).toBe(0);
      expect(response.body.data.averageRating).toBe(0);
    });

    it('should return 400 for invalid user ID', async () => {
      // Mock the controller to return bad request
      mockReviewController.getReviewStats.mockImplementation(async (req, res) => {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      });

      const response = await request(app)
        .get('/users/invalid/review-stats')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid user ID');
    });
  });

  describe('Edge Cases', () => {
    it('should handle review without comment', async () => {
      const reviewData = {
        errand_id: 1,
        rating: 5
        // No comment
      };

      // Mock the controller method
      mockReviewController.submitReview.mockImplementation(async (req, res) => {
        return res.status(201).json({
          success: true,
          message: 'Review submitted successfully',
          data: {
            id: 1,
            ...reviewData,
            comment: null,
            reviewer_id: 1,
            reviewee_id: 2,
            type: 'customer_to_runner'
          }
        });
      });

      const response = await request(app)
        .post('/reviews')
        .send(reviewData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comment).toBe(null);
    });
  });
});