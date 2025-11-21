// tests/integration/reportController.test.ts
import request from 'supertest';
import express from 'express';
import ReportController from '../../src/controllers/reportController';
import models from '../../src/models';
import trustScoreService from '../../src/services/trustScoreService';
import { Op } from 'sequelize';

jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock dependencies
jest.mock('../../src/models');
jest.mock('../../src/services/trustScoreService');
jest.mock('../../src/middleware/authMiddleware');

const mockedModels = models as jest.Mocked<typeof models>;
const mockedTrustScoreService = trustScoreService as jest.Mocked<typeof trustScoreService>;

// Create mock functions for Sequelize operations
const mockUserFindByPk = jest.fn();
const mockErrandFindByPk = jest.fn();
const mockReportFindOne = jest.fn();
const mockReportCreate = jest.fn();
const mockReportFindAll = jest.fn();
const mockReportCount = jest.fn();
const mockErrandCount = jest.fn();

// Mock the models
mockedModels.User.findByPk = mockUserFindByPk;
mockedModels.Errand.findByPk = mockErrandFindByPk;
mockedModels.Report.findOne = mockReportFindOne;
mockedModels.Report.create = mockReportCreate;
mockedModels.Report.findAll = mockReportFindAll;
mockedModels.Report.count = mockReportCount;
mockedModels.Errand.count = mockErrandCount;

const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req: any, res: any, next: any) => {
  req.user = { userId: 1, role: 'customer' };
  next();
});

// Setup routes
app.post('/reports', ReportController.submitReport);
app.get('/reports/my-reports', ReportController.getMyReports);
app.get('/reports/against-me', ReportController.getReportsAgainstMe);

describe('ReportController Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTrustScoreService.calculateTrustScore.mockClear();
  });

  describe('POST /reports', () => {
    const validReportData = {
      reported_user_id: 2,
      errand_id: 1,
      report_type: 'fraud',
      title: 'Suspicious Activity',
      description: 'User provided fake information',
      evidence_urls: ['https://example.com/evidence1.jpg']
    };

    it('should submit report successfully with valid data', async () => {
      // Mock user exists
      mockUserFindByPk.mockResolvedValueOnce({ id: 2 } as any);
      
      // Mock errand exists and user is involved
      mockErrandFindByPk.mockResolvedValueOnce({
        id: 1,
        customer_id: 1,
        runner_id: 2
      } as any);
      
      // Mock no duplicate recent reports
      mockReportFindOne.mockResolvedValueOnce(null);
      
      // Mock report creation
      const mockReport = {
        id: 1,
        ...validReportData,
        reporter_id: 1,
        status: 'pending',
        created_at: new Date()
      };
      mockReportCreate.mockResolvedValueOnce(mockReport as any);
      
      // Mock report with details fetch - use findByPk instead of findOne
      const mockReportWithDetails = {
        ...mockReport,
        reporter: { id: 1, full_name: 'Reporter User' },
        reported_user: { id: 2, full_name: 'Reported User', student_id: 'S12345' },
        errand: { id: 1, title: 'Test Errand', category: 'food' }
      };
      
      // Mock the Report.findByPk call that happens after creation
      mockedModels.Report.findByPk = jest.fn().mockResolvedValue(mockReportWithDetails as any);

      const response = await request(app)
        .post('/reports')
        .send(validReportData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Report submitted successfully. Our team will review it shortly.');
      expect(response.body.data).toBeDefined();

      expect(mockReportCreate).toHaveBeenCalledWith({
        reporter_id: 1,
        reported_user_id: 2,
        errand_id: 1,
        report_type: 'fraud',
        title: 'Suspicious Activity',
        description: 'User provided fake information',
        evidence_urls: ['https://example.com/evidence1.jpg'],
        status: 'pending'
      });

      expect(mockedTrustScoreService.calculateTrustScore).toHaveBeenCalledWith(2);
    });

    it('should submit report without errand_id successfully', async () => {
      const reportDataWithoutErrand = {
        reported_user_id: 2,
        report_type: 'inappropriate_behavior',
        title: 'Harassment Report',
        description: 'User sent inappropriate messages'
      };

      mockUserFindByPk.mockResolvedValueOnce({ id: 2 } as any);
      mockReportFindOne.mockResolvedValueOnce(null);
      
      const mockReport = {
        id: 1,
        ...reportDataWithoutErrand,
        reporter_id: 1,
        errand_id: undefined,
        status: 'pending',
        created_at: new Date()
      };
      mockReportCreate.mockResolvedValueOnce(mockReport as any);
      
      // Mock the Report.findByPk call
      mockedModels.Report.findByPk = jest.fn().mockResolvedValue(mockReport as any);

      const response = await request(app)
        .post('/reports')
        .send(reportDataWithoutErrand)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockReportCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          errand_id: undefined,
          evidence_urls: []
        })
      );
    });

    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        reported_user_id: 2,
        // Missing report_type, title, description
      };

      const response = await request(app)
        .post('/reports')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Missing required fields');
    });

    it('should return 400 when user tries to report themselves', async () => {
      const selfReportData = {
        reported_user_id: 1, // Same as reporter ID
        report_type: 'fraud',
        title: 'Self Report',
        description: 'Trying to report myself'
      };

      const response = await request(app)
        .post('/reports')
        .send(selfReportData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('cannot report yourself');
    });

    it('should return 404 when reported user does not exist', async () => {
      mockUserFindByPk.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/reports')
        .send(validReportData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Reported user not found');
    });

    it('should return 404 when errand does not exist', async () => {
      mockUserFindByPk.mockResolvedValueOnce({ id: 2 } as any);
      mockErrandFindByPk.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/reports')
        .send(validReportData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Errand not found');
    });

    it('should return 403 when reporter is not involved in the errand', async () => {
      mockUserFindByPk.mockResolvedValueOnce({ id: 2 } as any);
      mockErrandFindByPk.mockResolvedValueOnce({
        id: 1,
        customer_id: 3, // Different user
        runner_id: 4   // Different user
      } as any);

      const response = await request(app)
        .post('/reports')
        .send(validReportData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('only report users you have interacted with');
    });

    it('should return 400 for duplicate recent report', async () => {
      mockUserFindByPk.mockResolvedValueOnce({ id: 2 } as any);
      mockErrandFindByPk.mockResolvedValueOnce({
        id: 1,
        customer_id: 1,
        runner_id: 2
      } as any);
      
      // Mock duplicate report found - ensure this is called with correct parameters
      mockReportFindOne.mockResolvedValueOnce({
        id: 1,
        reporter_id: 1,
        reported_user_id: 2,
        report_type: 'fraud'
      } as any);

      const response = await request(app)
        .post('/reports')
        .send(validReportData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already submitted a similar report');
      
      // Verify the duplicate check was called with correct parameters
      expect(mockReportFindOne).toHaveBeenCalledWith({
        where: {
          reporter_id: 1,
          reported_user_id: 2,
          report_type: 'fraud',
          created_at: {
            [Op.gte]: expect.any(Date)
          }
        }
      });
    });

    it('should handle database errors during report creation', async () => {
      mockUserFindByPk.mockResolvedValueOnce({ id: 2 } as any);
      mockErrandFindByPk.mockResolvedValueOnce({
        id: 1,
        customer_id: 1,
        runner_id: 2
      } as any);
      mockReportFindOne.mockResolvedValueOnce(null);
      
      // Mock database error during creation
      mockReportCreate.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/reports')
        .send(validReportData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Internal server error');
    });

    it('should handle errors during trust score calculation', async () => {
      mockUserFindByPk.mockResolvedValueOnce({ id: 2 } as any);
      mockErrandFindByPk.mockResolvedValueOnce({
        id: 1,
        customer_id: 1,
        runner_id: 2
      } as any);
      mockReportFindOne.mockResolvedValueOnce(null);
      
      const mockReport = {
        id: 1,
        ...validReportData,
        reporter_id: 1,
        status: 'pending'
      };
      mockReportCreate.mockResolvedValueOnce(mockReport as any);
      mockedModels.Report.findByPk = jest.fn().mockResolvedValue(mockReport as any);
      
      // Mock trust score service error
      mockedTrustScoreService.calculateTrustScore.mockRejectedValueOnce(new Error('Trust score error'));

      const response = await request(app)
        .post('/reports')
        .send(validReportData)
        .expect(201); // Should still return 201 even if trust score calculation fails

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /reports/my-reports', () => {
    it('should return user reports with pagination', async () => {
      const mockReports = [
        {
          id: 1,
          report_type: 'fraud',
          title: 'Suspicious Activity',
          status: 'pending',
          created_at: new Date(),
          reported_user: { id: 2, full_name: 'Reported User', student_id: 'S12345' },
          errand: { id: 1, title: 'Test Errand', category: 'food' }
        }
      ];

      mockReportFindAll.mockResolvedValueOnce(mockReports as any);
      mockReportCount.mockResolvedValueOnce(1);

      const response = await request(app)
        .get('/reports/my-reports')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reports).toHaveLength(1);
      expect(response.body.data.totalCount).toBe(1);
      expect(response.body.data.currentPage).toBe(1);
      expect(response.body.data.totalPages).toBe(1);

      expect(mockReportFindAll).toHaveBeenCalledWith({
        where: { reporter_id: 1 },
        include: [
          {
            model: mockedModels.User,
            as: 'reported_user',
            attributes: ['id', 'full_name', 'student_id']
          },
          {
            model: mockedModels.Errand,
            as: 'errand',
            attributes: ['id', 'title', 'category']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 10,
        offset: 0
      });
    });

    it('should handle pagination parameters correctly', async () => {
      mockReportFindAll.mockResolvedValueOnce([] as any);
      mockReportCount.mockResolvedValueOnce(25);

      const response = await request(app)
        .get('/reports/my-reports')
        .query({ page: 2, limit: 10 })
        .expect(200);

      expect(response.body.data.currentPage).toBe(2);
      expect(response.body.data.totalPages).toBe(3);
      expect(mockReportFindAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 10
        })
      );
    });

    it('should handle database errors', async () => {
      mockReportFindAll.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/reports/my-reports')
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should use default pagination values when not provided', async () => {
      mockReportFindAll.mockResolvedValueOnce([] as any);
      mockReportCount.mockResolvedValueOnce(0);

      const response = await request(app)
        .get('/reports/my-reports')
        .expect(200);

      expect(mockReportFindAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0
        })
      );
    });
  });

  describe('GET /reports/against-me', () => {
    it('should return reports against user with pagination', async () => {
      const mockReports = [
        {
          id: 1,
          report_type: 'fraud',
          title: 'Report against me',
          status: 'pending',
          created_at: new Date(),
          reporter: { id: 2, full_name: 'Reporter User', student_id: 'S67890' },
          errand: { id: 1, title: 'Test Errand', category: 'food' }
        }
      ];

      mockReportFindAll.mockResolvedValueOnce(mockReports as any);
      mockReportCount.mockResolvedValueOnce(1);

      const response = await request(app)
        .get('/reports/against-me')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reports).toHaveLength(1);
      expect(response.body.data.totalCount).toBe(1);

      expect(mockReportFindAll).toHaveBeenCalledWith({
        where: { reported_user_id: 1 },
        include: [
          {
            model: mockedModels.User,
            as: 'reporter',
            attributes: ['id', 'full_name', 'student_id']
          },
          {
            model: mockedModels.Errand,
            as: 'errand',
            attributes: ['id', 'title', 'category']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 10,
        offset: 0
      });
    });

    it('should handle empty results', async () => {
      mockReportFindAll.mockResolvedValueOnce([] as any);
      mockReportCount.mockResolvedValueOnce(0);

      const response = await request(app)
        .get('/reports/against-me')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reports).toHaveLength(0);
      expect(response.body.data.totalCount).toBe(0);
    });
  });

  describe('checkFraudPatterns', () => {
    // Mock the Op operator for date comparisons
    const mockOp = {
      gte: expect.any(Date)
    };

    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
    });

    it('should detect high cancellation rate', async () => {
      mockErrandCount.mockResolvedValueOnce(3); // 3 cancellations
      mockReportCount.mockResolvedValueOnce(0); // No recent reports
      mockedTrustScoreService.calculateTrustScore.mockResolvedValueOnce(50); // Normal trust score

      const warnings = await ReportController.checkFraudPatterns(1);

      expect(warnings).toContain('High cancellation rate detected');
      expect(mockErrandCount).toHaveBeenCalledWith({
        where: {
          runner_id: 1,
          status: 'cancelled',
          created_at: {
            [Op.gte]: expect.any(Date)
          }
        }
      });
    });

    it('should detect multiple recent reports', async () => {
      mockErrandCount.mockResolvedValueOnce(0); // No cancellations
      mockReportCount.mockResolvedValueOnce(2); // 2 recent reports
      mockedTrustScoreService.calculateTrustScore.mockResolvedValueOnce(50);

      const warnings = await ReportController.checkFraudPatterns(1);

      expect(warnings).toContain('Multiple reports received recently');
    });

    it('should detect low trust score', async () => {
      mockErrandCount.mockResolvedValueOnce(0);
      mockReportCount.mockResolvedValueOnce(0);
      mockedTrustScoreService.calculateTrustScore.mockResolvedValueOnce(25); // Low trust score

      const warnings = await ReportController.checkFraudPatterns(1);

      expect(warnings).toContain('Low trust score detected');
    });

    it('should return multiple warnings for multiple patterns', async () => {
      mockErrandCount.mockResolvedValueOnce(4); // High cancellations
      mockReportCount.mockResolvedValueOnce(3); // Multiple reports
      mockedTrustScoreService.calculateTrustScore.mockResolvedValueOnce(20); // Low trust score

      const warnings = await ReportController.checkFraudPatterns(1);

      expect(warnings).toHaveLength(3);
      expect(warnings).toEqual([
        'High cancellation rate detected',
        'Multiple reports received recently',
        'Low trust score detected'
      ]);
    });

    it('should handle errors gracefully', async () => {
      mockErrandCount.mockRejectedValueOnce(new Error('Database error'));

      const warnings = await ReportController.checkFraudPatterns(1);

      expect(warnings).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty evidence_urls array', async () => {
      const reportData = {
        reported_user_id: 2,
        report_type: 'fraud',
        title: 'No Evidence Report',
        description: 'Report without evidence'
        // evidence_urls not provided
      };

      mockUserFindByPk.mockResolvedValueOnce({ id: 2 } as any);
      mockReportFindOne.mockResolvedValueOnce(null);
      
      const mockReport = {
        id: 1,
        ...reportData,
        evidence_urls: [],
        reporter_id: 1,
        status: 'pending',
        created_at: new Date()
      };
      mockReportCreate.mockResolvedValueOnce(mockReport as any);
      
      // Mock the Report.findByPk call
      mockedModels.Report.findByPk = jest.fn().mockResolvedValue(mockReport as any);

      const response = await request(app)
        .post('/reports')
        .send(reportData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockReportCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          evidence_urls: []
        })
      );
    });

    it('should handle different user roles in auth middleware', async () => {
      // Test with different user role
      const adminApp = express();
      adminApp.use(express.json());
      adminApp.use((req: any, res: any, next: any) => {
        req.user = { userId: 3, role: 'admin' }; // Different user and role
        next();
      });
      adminApp.post('/reports', ReportController.submitReport);

      mockUserFindByPk.mockResolvedValueOnce({ id: 2 } as any);
      mockReportFindOne.mockResolvedValueOnce(null);
      
      const mockReport = {
        id: 1,
        reporter_id: 3,
        reported_user_id: 2,
        report_type: 'fraud',
        title: 'Admin Report',
        description: 'Report from admin user',
        status: 'pending',
        created_at: new Date()
      };
      mockReportCreate.mockResolvedValueOnce(mockReport as any);
      mockedModels.Report.findByPk = jest.fn().mockResolvedValue(mockReport as any);

      const response = await request(adminApp)
        .post('/reports')
        .send({
          reported_user_id: 2,
          report_type: 'fraud',
          title: 'Admin Report',
          description: 'Report from admin user'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});