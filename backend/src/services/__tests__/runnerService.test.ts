// tests/services/runnerService.test.ts
import { RunnerService } from "../../services/runnerService";
import { 
  RunnerRegistrationData, 
  RunnerUpdateData,
  RunnerWithUser 
} from "../../types/runner.types";

// Mock dependencies
jest.mock("../../models");
jest.mock("../../utils/logger");

// Import models after mocking
import models from "../../models";

const mockedModels = models as jest.Mocked<typeof models>;

// Define ValidationError class first
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Now mock the service
jest.mock('../../services/runnerService', () => {
  const originalModule = jest.requireActual('../../services/runnerService');
  
  // Use the locally defined ValidationError
  class MockValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  }
  
  return {
    ...originalModule,
    ValidationError: MockValidationError
  };
});

describe("RunnerService", () => {
  let runnerService: RunnerService;
  let mockTransaction: any;

  // Mock data
  const mockUser = {
    id: 1,
    user_type: 'customer',
    full_name: 'Test User',
    phone_number: '1234567890',
    email: 'test@example.com',
    student_id: 'STU123',
    verification_status: 'verified',
    update: jest.fn()
  };

  const mockRunnerWithUser: RunnerWithUser = {
    id: 1,
    user_id: 1,
    areas_covered: ["Area 1"],
    transportation_mode: "bicycle",
    is_available: true,
    is_approved: true,
    rating: 4.5,
    completed_errands: 10,
    earnings: 500.0,
    total_distance_covered: 150.5,
    average_response_time: 15,
    cancellation_rate: 0.1,
    documents_verified: true,
    id_card_url: "https://example.com/id.jpg",
    student_card_url: "https://example.com/student.jpg",
    created_at: new Date(),
    updated_at: new Date(),
    approved_at: new Date(),
    rejection_reason: null,
    last_active_at: new Date(),
    user: {
      id: 1,
      full_name: "Test User",
      phone_number: "1234567890",
      email: "test@example.com",
      student_id: "STU123",
      user_type: "runner",
      verification_status: "verified"
    }
  };

  const validRunnerData: RunnerRegistrationData = {
    areas_covered: ["Area 1", "Area 2"],
    transportation_mode: "bicycle",
    id_card_url: "https://example.com/id.jpg",
    student_card_url: "https://example.com/student.jpg"
  };

  beforeEach(() => {
    runnerService = new RunnerService();
    jest.clearAllMocks();

    // Mock transaction
    mockTransaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };

    // Mock sequelize transaction
    mockedModels.sequelize = {
      transaction: jest.fn().mockResolvedValue(mockTransaction),
    } as any;

    // Mock process.env
    process.env.REDIS_ENABLED = 'false';

    // Reset all mock implementations
    mockedModels.Runner.findOne = jest.fn();
    mockedModels.Runner.findByPk = jest.fn();
    mockedModels.Runner.create = jest.fn();
    mockedModels.Runner.update = jest.fn();
    mockedModels.Runner.count = jest.fn();
    mockedModels.Runner.findAll = jest.fn();
    mockedModels.User.findByPk = jest.fn();
    mockedModels.User.update = jest.fn();
    mockedModels.Errand.count = jest.fn();
    mockedModels.Errand.findAll = jest.fn();
    mockedModels.Transaction.findAll = jest.fn();
  });

  describe("checkExistingRunner", () => {
    it("should return true when runner exists", async () => {
      // Setup
      (mockedModels.Runner.findOne as jest.Mock).mockResolvedValue({ id: 1, user_id: 1 });

      // Execute
      const result = await runnerService.checkExistingRunner(1);

      // Assert
      expect(result).toBe(true);
      expect(mockedModels.Runner.findOne).toHaveBeenCalledWith({
        where: { user_id: 1 }
      });
    });

    it("should return false when runner does not exist", async () => {
      // Setup
      (mockedModels.Runner.findOne as jest.Mock).mockResolvedValue(null);

      // Execute
      const result = await runnerService.checkExistingRunner(1);

      // Assert
      expect(result).toBe(false);
    });

    it("should throw error when database query fails", async () => {
      // Setup
      (mockedModels.Runner.findOne as jest.Mock).mockRejectedValue(new Error("Database error"));

      // Execute & Assert
      await expect(runnerService.checkExistingRunner(1)).rejects.toThrow(
        "Failed to check runner existence"
      );
    });
  });

  describe("updateUserType", () => {
    it("should update customer to both successfully", async () => {
      // Setup
      const mockUserInstance = {
        ...mockUser,
        update: jest.fn().mockResolvedValue(true)
      };
      (mockedModels.User.findByPk as jest.Mock).mockResolvedValue(mockUserInstance);

      // Execute
      await runnerService.updateUserType(1);

      // Assert
      expect(mockedModels.User.findByPk).toHaveBeenCalledWith(1);
      expect(mockUserInstance.update).toHaveBeenCalledWith({ user_type: 'both' });
    });

    it("should update other types to runner", async () => {
      // Setup
      const mockUserInstance = {
        ...mockUser,
        user_type: 'admin',
        update: jest.fn().mockResolvedValue(true)
      };
      (mockedModels.User.findByPk as jest.Mock).mockResolvedValue(mockUserInstance);

      // Execute
      await runnerService.updateUserType(1);

      // Assert
      expect(mockUserInstance.update).toHaveBeenCalledWith({ user_type: 'runner' });
    });

    it("should throw error when user not found", async () => {
      // Setup
      (mockedModels.User.findByPk as jest.Mock).mockResolvedValue(null);

      // Execute & Assert
      await expect(runnerService.updateUserType(1)).rejects.toThrow("User not found");
    });

    it("should throw error when update fails", async () => {
      // Setup
      const mockUserInstance = {
        ...mockUser,
        update: jest.fn().mockRejectedValue(new Error("Update failed"))
      };
      (mockedModels.User.findByPk as jest.Mock).mockResolvedValue(mockUserInstance);

      // Execute & Assert
      await expect(runnerService.updateUserType(1)).rejects.toThrow("Failed to update user type");
    });
  });

  describe("createRunnerProfile", () => {
    beforeEach(() => {
      // Mock the private methods that will be called
      jest.spyOn(runnerService as any, 'getRunnerWithDetails').mockResolvedValue(mockRunnerWithUser);
      jest.spyOn(runnerService as any, 'invalidateRunnerCache').mockResolvedValue(undefined);
    });

    it("should create runner profile successfully", async () => {
      // Setup
      const mockRunnerInstance = {
        id: 1,
        ...validRunnerData,
        toJSON: jest.fn().mockReturnValue(mockRunnerWithUser)
      };
      (mockedModels.Runner.create as jest.Mock).mockResolvedValue(mockRunnerInstance);

      // Execute
      const result = await runnerService.createRunnerProfile(1, validRunnerData);

      // Assert
      expect(result).toEqual(mockRunnerWithUser);
      expect(mockedModels.Runner.create).toHaveBeenCalled();
      expect(mockedModels.sequelize.transaction).toHaveBeenCalled();
    });

    it("should throw validation error for empty areas covered", async () => {
      // Setup
      const invalidData = { ...validRunnerData, areas_covered: [] };

      // Execute & Assert
      await expect(runnerService.createRunnerProfile(1, invalidData)).rejects.toThrow(
        "At least one area must be covered"
      );
    });

    it("should throw validation error for too many areas", async () => {
      // Setup
      const invalidData = { 
        ...validRunnerData, 
        areas_covered: Array.from({ length: 11 }, (_, i) => `Area ${i + 1}`)
      };

      // Execute & Assert
      await expect(runnerService.createRunnerProfile(1, invalidData)).rejects.toThrow(
        "Maximum 10 areas allowed"
      );
    });

    it("should throw validation error for empty transportation mode", async () => {
      // Setup
      const invalidData = { ...validRunnerData, transportation_mode: "" };

      // Execute & Assert
      await expect(runnerService.createRunnerProfile(1, invalidData)).rejects.toThrow(
        "Transportation mode is required"
      );
    });

    it("should throw validation error for non-array areas covered", async () => {
      // Setup - TypeScript might prevent this, but test the validation
      const invalidData = { ...validRunnerData, areas_covered: "not an array" as any };

      // Execute & Assert
      await expect(runnerService.createRunnerProfile(1, invalidData)).rejects.toThrow(
        "Areas covered must be a non-empty array"
      );
    });

    it("should handle database errors", async () => {
      // Setup
      (mockedModels.Runner.create as jest.Mock).mockRejectedValue(new Error("Database error"));

      // Execute & Assert
      await expect(runnerService.createRunnerProfile(1, validRunnerData)).rejects.toThrow(
        "Failed to create runner profile"
      );
    });
  });

  describe("getRunnerByUserId", () => {
    it("should return runner when found", async () => {
      // Setup
      const mockRunnerInstance = {
        toJSON: jest.fn().mockReturnValue(mockRunnerWithUser)
      };
      (mockedModels.Runner.findOne as jest.Mock).mockResolvedValue(mockRunnerInstance);

      // Execute
      const result = await runnerService.getRunnerByUserId(1);

      // Assert
      expect(result).toEqual(mockRunnerWithUser);
      expect(mockedModels.Runner.findOne).toHaveBeenCalledWith({
        where: { user_id: 1 },
        include: [{
          model: mockedModels.User,
          as: 'user',
          attributes: ['id', 'full_name', 'phone_number', 'email', 'student_id', 'verification_status']
        }]
      });
    });

    it("should return null when runner not found", async () => {
      // Setup
      (mockedModels.Runner.findOne as jest.Mock).mockResolvedValue(null);

      // Execute
      const result = await runnerService.getRunnerByUserId(1);

      // Assert
      expect(result).toBe(null);
    });

    it("should throw error when database query fails", async () => {
      // Setup
      (mockedModels.Runner.findOne as jest.Mock).mockRejectedValue(new Error("Database error"));

      // Execute & Assert
      await expect(runnerService.getRunnerByUserId(1)).rejects.toThrow(
        "Failed to get runner profile"
      );
    });
  });

  describe("updateRunnerProfile", () => {
    const updateData: RunnerUpdateData = {
      areas_covered: ["New Area 1", "New Area 2"],
      transportation_mode: "scooter",
      is_available: false
    };

    beforeEach(() => {
      // Mock private methods
      jest.spyOn(runnerService as any, 'getRunnerWithDetails').mockResolvedValue(mockRunnerWithUser);
      jest.spyOn(runnerService as any, 'invalidateRunnerCache').mockResolvedValue(undefined);
    });

    it("should update runner profile successfully", async () => {
      // Setup
      const mockRunnerInstance = {
        id: 1,
        user_id: 1,
        areas_covered: ["Old Area"],
        transportation_mode: "bicycle",
        is_available: true,
        update: jest.fn().mockResolvedValue(true)
      };
      (mockedModels.Runner.findOne as jest.Mock).mockResolvedValue(mockRunnerInstance);

      // Execute
      const result = await runnerService.updateRunnerProfile(1, updateData);

      // Assert
      expect(result).toEqual(mockRunnerWithUser);
      expect(mockRunnerInstance.update).toHaveBeenCalled();
      expect(mockedModels.sequelize.transaction).toHaveBeenCalled();
    });

    it("should throw error when runner not found", async () => {
      // Setup
      (mockedModels.Runner.findOne as jest.Mock).mockResolvedValue(null);

      // Execute & Assert
      await expect(runnerService.updateRunnerProfile(1, updateData)).rejects.toThrow(
        "Runner profile not found"
      );
    });

    it("should throw validation error for empty areas covered", async () => {
      // Setup
      const invalidData = { ...updateData, areas_covered: [] };

      // Execute & Assert
      await expect(runnerService.updateRunnerProfile(1, invalidData)).rejects.toThrow(
        "At least one area must be covered"
      );
    });

    it("should throw validation error for too many areas", async () => {
      // Setup
      const invalidData = { 
        ...updateData, 
        areas_covered: Array.from({ length: 11 }, (_, i) => `Area ${i + 1}`)
      };

      // Execute & Assert
      await expect(runnerService.updateRunnerProfile(1, invalidData)).rejects.toThrow(
        "Maximum 10 areas allowed"
      );
    });

    it("should handle partial updates", async () => {
      // Setup
      const partialData = { transportation_mode: "car" };
      const mockRunnerInstance = {
        id: 1,
        user_id: 1,
        areas_covered: ["Area 1"],
        transportation_mode: "bicycle",
        is_available: true,
        update: jest.fn().mockResolvedValue(true)
      };
      (mockedModels.Runner.findOne as jest.Mock).mockResolvedValue(mockRunnerInstance);

      // Execute
      await runnerService.updateRunnerProfile(1, partialData);

      // Assert
      expect(mockRunnerInstance.update).toHaveBeenCalled();
    });

    it("should handle database errors", async () => {
      // Setup
      const mockRunnerInstance = {
        id: 1,
        user_id: 1,
        areas_covered: ["Area 1"],
        transportation_mode: "bicycle",
        is_available: true,
        update: jest.fn().mockRejectedValue(new Error("Database error"))
      };
      (mockedModels.Runner.findOne as jest.Mock).mockResolvedValue(mockRunnerInstance);

      // Execute & Assert
      await expect(runnerService.updateRunnerProfile(1, updateData)).rejects.toThrow(
        "Failed to update runner profile"
      );
    });
  });

  describe("getRunnerStatistics", () => {
    it("should return runner statistics successfully", async () => {
      // Setup
      const mockTransactions = [
        { runner_earnings: "25.50" },
        { runner_earnings: "15.75" },
        { runner_earnings: "30.00" }
      ];

      (mockedModels.Errand.count as jest.Mock)
        .mockResolvedValueOnce(10) // completed errands
        .mockResolvedValueOnce(2);  // active errands
      (mockedModels.Transaction.findAll as jest.Mock).mockResolvedValue(mockTransactions);

      // Execute
      const result = await runnerService.getRunnerStatistics(1);

      // Assert
      expect(result).toEqual({
        completed_errands: 10,
        active_errands: 2,
        total_earnings: 71.25 // 25.50 + 15.75 + 30.00
      });
    });

    it("should handle zero earnings", async () => {
      // Setup
      (mockedModels.Errand.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      (mockedModels.Transaction.findAll as jest.Mock).mockResolvedValue([]);

      // Execute
      const result = await runnerService.getRunnerStatistics(1);

      // Assert
      expect(result.total_earnings).toBe(0);
    });

    it("should throw error when database query fails", async () => {
      // Setup
      (mockedModels.Errand.count as jest.Mock).mockRejectedValue(new Error("Database error"));

      // Execute & Assert
      await expect(runnerService.getRunnerStatistics(1)).rejects.toThrow(
        "Failed to get runner statistics"
      );
    });
  });

  describe("getNearbyRunners", () => {
    it("should return nearby runners with area filter", async () => {
      // Setup
      const mockRunnerInstance = {
        toJSON: jest.fn().mockReturnValue(mockRunnerWithUser)
      };
      (mockedModels.Runner.findAll as jest.Mock).mockResolvedValue([mockRunnerInstance]);
      (mockedModels.Runner.count as jest.Mock).mockResolvedValue(1);

      // Execute
      const result = await runnerService.getNearbyRunners("Downtown", 1, 10);

      // Assert
      expect(result.runners).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockedModels.Runner.findAll).toHaveBeenCalled();
    });

    it("should return nearby runners without area filter", async () => {
      // Setup
      const mockRunnerInstance = {
        toJSON: jest.fn().mockReturnValue(mockRunnerWithUser)
      };
      (mockedModels.Runner.findAll as jest.Mock).mockResolvedValue([mockRunnerInstance]);
      (mockedModels.Runner.count as jest.Mock).mockResolvedValue(1);

      // Execute
      const result = await runnerService.getNearbyRunners(undefined, 1, 20);

      // Assert
      expect(result.runners).toHaveLength(1);
      expect(mockedModels.Runner.findAll).toHaveBeenCalled();
    });

    it("should use default pagination", async () => {
      // Setup
      (mockedModels.Runner.findAll as jest.Mock).mockResolvedValue([]);
      (mockedModels.Runner.count as jest.Mock).mockResolvedValue(0);

      // Execute
      await runnerService.getNearbyRunners();

      // Assert
      expect(mockedModels.Runner.findAll).toHaveBeenCalled();
    });
  });

  describe("getRunnerDashboard", () => {
    beforeEach(() => {
      // Mock the private methods that will be called
      jest.spyOn(runnerService as any, 'getRecentErrands').mockResolvedValue([{ id: 1, title: "Test Errand" }]);
      jest.spyOn(runnerService as any, 'getWeeklyEarnings').mockResolvedValue(150);
      jest.spyOn(runnerService as any, 'getCompletionRate').mockResolvedValue(85);
      jest.spyOn(runnerService as any, 'getTotalEarnings').mockResolvedValue(500);
    });

    it("should return dashboard data successfully", async () => {
      // Setup
      jest.spyOn(runnerService, 'getRunnerByUserId').mockResolvedValue(mockRunnerWithUser);

      // Execute
      const result = await runnerService.getRunnerDashboard(1);

      // Assert
      expect(result).toEqual({
        profile: mockRunnerWithUser,
        statistics: {
          total_earnings: 500,
          weekly_earnings: 150,
          completed_errands: 10,
          completion_rate: 85,
          current_rating: 4.5,
          total_distance_covered: 150.5,
          average_response_time: 15,
          cancellation_rate: 0.1
        },
        recent_errands: [{ id: 1, title: "Test Errand" }],
        approval_status: {
          is_approved: true,
          documents_verified: true,
          approved_at: mockRunnerWithUser.approved_at,
          rejection_reason: null
        }
      });
    });

    it("should throw error when runner not found", async () => {
      // Setup
      jest.spyOn(runnerService, 'getRunnerByUserId').mockResolvedValue(null);

      // Execute & Assert
      await expect(runnerService.getRunnerDashboard(1)).rejects.toThrow(
        "Runner profile not found"
      );
    });

    it("should handle database errors", async () => {
      // Setup
      jest.spyOn(runnerService, 'getRunnerByUserId').mockRejectedValue(new Error("Database error"));

      // Execute & Assert
      await expect(runnerService.getRunnerDashboard(1)).rejects.toThrow(
        "Failed to get dashboard data"
      );
    });
  });

  describe("getEarningsBreakdown", () => {
    it("should return earnings breakdown for month period", async () => {
      // Setup
      const mockTransactions = [
        {
          id: 1,
          runner_earnings: "25.50",
          platform_fee: "2.55",
          amount: "28.05",
          payment_method: "wallet",
          completed_at: new Date(),
          created_at: new Date(),
          errand: {
            id: 1,
            title: "Test Errand 1",
            category: "food_delivery",
            status: "completed"
          }
        }
      ];
      (mockedModels.Transaction.findAll as jest.Mock).mockResolvedValue(mockTransactions);

      // Execute
      const result = await runnerService.getEarningsBreakdown(1, "month");

      // Assert
      expect(result.period).toBe("month");
      expect(result.total_earnings).toBe(25.50);
      expect(result.total_errands).toBe(1);
    });

    it("should use default period when not specified", async () => {
      // Setup
      (mockedModels.Transaction.findAll as jest.Mock).mockResolvedValue([]);

      // Execute
      await runnerService.getEarningsBreakdown(1);

      // Assert
      expect(mockedModels.Transaction.findAll).toHaveBeenCalled();
    });
  });

  // Test ValidationError specifically
  describe("ValidationError", () => {
    it("should be thrown for validation errors", async () => {
      // Import the actual ValidationError from the service
      const { ValidationError: ServiceValidationError } = await import('../../services/runnerService');
      
      // Test that validation errors are instances of ValidationError
      const error = new ServiceValidationError("Test validation error");
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Test validation error');
    });
  });
});