// tests/services/errandService.test.ts
import { ErrandService, ErrandError } from "../../services/errandService";
import { getFullPricing } from "../../utils/errandPricing";
import {
  Category,
  Urgency,
  ErrandStatus,
  CreateErrandData,
  PricingBreakdown,
} from "../../types/errand";

// Mock dependencies
jest.mock("../../models");
jest.mock("../../utils/errandPricing");
jest.mock("../../utils/logger");

// Import models after mocking
import models from "../../models";

const mockedModels = models as jest.Mocked<typeof models>;
const mockedGetFullPricing = getFullPricing as jest.MockedFunction<
  typeof getFullPricing
>;

// Create mock functions for Sequelize operations
const mockUserFindByPk = jest.fn();
const mockErrandFindByPk = jest.fn();
const mockErrandCount = jest.fn();
const mockErrandCreate = jest.fn();
const mockRunnerFindOne = jest.fn();
const mockTransactionCreate = jest.fn();
const mockRunnerUpdate = jest.fn();

// Mock the models
mockedModels.User.findByPk = mockUserFindByPk;
mockedModels.Errand.findByPk = mockErrandFindByPk;
mockedModels.Errand.count = mockErrandCount;
mockedModels.Errand.create = mockErrandCreate;
mockedModels.Runner.findOne = mockRunnerFindOne;
mockedModels.Transaction.create = mockTransactionCreate;
mockedModels.Runner.update = mockRunnerUpdate;

// Complete PricingBreakdown mock
const createMockPricing = (): PricingBreakdown => ({
  basePrice: 25.5,
  platformFee: 1.28,
  runnerEarnings: 21.67,
  finalPrice: 28.33,
  urgencyFee: 1.5,
  distanceFee: 0.5,
});

describe("ErrandService", () => {
  let errandService: ErrandService;

  beforeEach(() => {
    errandService = new ErrandService();
    jest.clearAllMocks();

    // Mock sequelize transaction
    mockedModels.sequelize = {
      transaction: jest.fn((callback: any) =>
        callback({
          LOCK: { UPDATE: "UPDATE" },
        })
      ),
    } as any;
  });

  describe("createErrand", () => {
    const validErrandData: CreateErrandData = {
      customerId: 1,
      title: "Test Errand",
      category: Category.FOOD_DELIVERY,
      location_from: "123 Main St",
      location_to: "456 Oak Ave",
      budget: 25.5,
      urgency: Urgency.STANDARD,
      description: "Test description",
      estimated_duration_min: 30,
      distance: 5.2,
    };

    beforeEach(() => {
      mockedGetFullPricing.mockReturnValue(createMockPricing());
    });

    it("should create errand successfully with valid data", async () => {
      const mockCustomer = { id: 1, is_active: true };
      const mockErrand = {
        id: 1,
        customer_id: 1,
        title: "Test Errand",
        category: Category.FOOD_DELIVERY,
        status: ErrandStatus.PENDING,
      };
      const mockCreatedErrand = {
        ...mockErrand,
        customer: mockCustomer,
      };

      mockUserFindByPk.mockResolvedValue(mockCustomer as any);
      mockErrandCount.mockResolvedValue(0);
      mockErrandCreate.mockResolvedValue(mockErrand as any);
      mockErrandFindByPk.mockResolvedValue(mockCreatedErrand as any);

      const result = await errandService.createErrand(validErrandData);

      expect(result).toEqual(mockCreatedErrand);
      expect(mockUserFindByPk).toHaveBeenCalledWith(1);
      expect(mockErrandCreate).toHaveBeenCalledWith({
        customer_id: 1,
        title: "Test Errand",
        description: "Test description",
        category: Category.FOOD_DELIVERY,
        location_from: "123 Main St",
        location_to: "456 Oak Ave",
        base_price: 25.5,
        final_price: 28.33,
        urgency: Urgency.STANDARD,
        distance_km: 5.2,
        estimated_duration_min: 30,
        status: ErrandStatus.PENDING,
        pricing_breakdown: createMockPricing(),
      } as any);
    });

    it("should throw error when customer not found", async () => {
      mockUserFindByPk.mockResolvedValue(null);

      await expect(errandService.createErrand(validErrandData)).rejects.toThrow(
        ErrandError
      );

      await expect(
        errandService.createErrand(validErrandData)
      ).rejects.toMatchObject({
        message: "Customer not found",
        code: "CUSTOMER_NOT_FOUND",
        statusCode: 404,
      });
    });

    it("should throw error when customer account is inactive", async () => {
      const mockCustomer = { id: 1, is_active: false };
      mockUserFindByPk.mockResolvedValue(mockCustomer as any);

      await expect(
        errandService.createErrand(validErrandData)
      ).rejects.toMatchObject({
        message: "Customer account is inactive",
        code: "ACCOUNT_INACTIVE",
        statusCode: 403,
      });
    });

    it("should throw error when too many pending errands", async () => {
      const mockCustomer = { id: 1, is_active: true };
      mockUserFindByPk.mockResolvedValue(mockCustomer as any);
      mockErrandCount.mockResolvedValue(10);

      await expect(
        errandService.createErrand(validErrandData)
      ).rejects.toMatchObject({
        message: expect.stringContaining("too many pending errands"),
        code: "TOO_MANY_PENDING_ERRANDS",
        statusCode: 429,
      });
    });

    it("should throw error for invalid budget", async () => {
      const mockCustomer = { id: 1, is_active: true };
      mockUserFindByPk.mockResolvedValue(mockCustomer as any);
      mockErrandCount.mockResolvedValue(0);

      const invalidData = { ...validErrandData, budget: 0 };

      await expect(
        errandService.createErrand(invalidData)
      ).rejects.toMatchObject({
        message: "Budget must be positive",
        code: "INVALID_BUDGET",
        statusCode: 400,
      });
    });
  });
  // Fix the acceptErrand tests in your errandService.test.ts

  describe("acceptErrand", () => {
    const mockRunner = {
      user_id: 2,
      is_available: true,
      is_approved: true,
      update: jest.fn().mockResolvedValue(true),
    };

    const mockErrand = {
      id: 1,
      customer_id: 1,
      runner_id: null,
      status: ErrandStatus.PENDING,
      category: Category.FOOD_DELIVERY,
      update: jest.fn().mockResolvedValue(true),
    };

    const mockUpdatedErrand = {
      id: 1,
      customer_id: 1,
      runner_id: 2,
      status: ErrandStatus.ACCEPTED,
      customer: { id: 1, full_name: "Test Customer" },
      runner: { id: 2, full_name: "Test Runner" },
    };

    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      mockRunnerFindOne.mockResolvedValue(mockRunner as any);
      // Default to 0 accepted count for most tests
      mockErrandCount.mockResolvedValue(0);
    });

    it("should accept errand successfully", async () => {
      mockErrandFindByPk
        .mockResolvedValueOnce(mockErrand as any) // First call in transaction
        .mockResolvedValueOnce(mockUpdatedErrand as any); // Second call for result

      const result = await errandService.acceptErrand(1, 2);

      expect(result).toEqual(mockUpdatedErrand);
      expect(mockErrand.update).toHaveBeenCalledWith(
        {
          runner_id: 2,
          status: ErrandStatus.ACCEPTED,
          accepted_at: expect.any(Date),
        } as any,
        { transaction: expect.anything() }
      );
      expect(mockRunner.update).toHaveBeenCalledWith(
        { is_available: false },
        { transaction: expect.anything() }
      );
    });

    it("should throw error when runner not available", async () => {
      mockRunnerFindOne.mockResolvedValue(null);

      await expect(errandService.acceptErrand(1, 2)).rejects.toMatchObject({
        message: "Runner not available or account not approved",
        code: "RUNNER_UNAVAILABLE",
        statusCode: 403,
      });
    });

    it("should throw error when daily limit reached", async () => {
      // Only for this test, mock the count to be 15
      mockErrandCount.mockResolvedValue(15);
      mockErrandFindByPk.mockResolvedValue(mockErrand as any);

      await expect(errandService.acceptErrand(1, 2)).rejects.toMatchObject({
        message: expect.stringContaining(
          "Daily errand acceptance limit reached"
        ),
        code: "DAILY_LIMIT_REACHED",
        statusCode: 429,
      });
    });

    it("should throw error when errand not found", async () => {
      // For this test, don't mock the count at all or keep it at 0
      mockErrandFindByPk.mockResolvedValue(null);

      await expect(errandService.acceptErrand(999, 2)).rejects.toMatchObject({
        message: "Errand not found",
        code: "ERRAND_NOT_FOUND",
        statusCode: 404,
      });
    });

    it("should throw error when accepting own errand", async () => {
      const ownErrand = {
        id: 1,
        customer_id: 2, // Same as runnerId
        runner_id: null,
        status: ErrandStatus.PENDING,
        category: Category.FOOD_DELIVERY,
        update: jest.fn().mockResolvedValue(true),
      };
      mockErrandFindByPk.mockResolvedValue(ownErrand as any);

      await expect(errandService.acceptErrand(1, 2)).rejects.toMatchObject({
        message: "Cannot accept your own errand",
        code: "SELF_ACCEPTANCE_NOT_ALLOWED",
        statusCode: 403,
      });
    });

    it("should throw error when errand not pending", async () => {
      const acceptedErrand = {
        id: 1,
        customer_id: 1,
        runner_id: null,
        status: ErrandStatus.ACCEPTED, // Not pending
        category: Category.FOOD_DELIVERY,
        update: jest.fn().mockResolvedValue(true),
      };
      mockErrandFindByPk.mockResolvedValue(acceptedErrand as any);

      await expect(errandService.acceptErrand(1, 2)).rejects.toMatchObject({
        message: expect.stringContaining("no longer available"),
        code: "ERRAND_UNAVAILABLE",
        statusCode: 409,
      });
    });

    it("should throw error when errand already assigned", async () => {
      const assignedErrand = {
        id: 1,
        customer_id: 1,
        runner_id: 3, // Already assigned to another runner
        status: ErrandStatus.PENDING,
        category: Category.FOOD_DELIVERY,
        update: jest.fn().mockResolvedValue(true),
      };
      mockErrandFindByPk.mockResolvedValue(assignedErrand as any);

      await expect(errandService.acceptErrand(1, 2)).rejects.toMatchObject({
        message: "Errand already assigned to another runner",
        code: "ERRAND_ALREADY_ASSIGNED",
        statusCode: 409,
      });
    });
  });

  describe("startErrand", () => {
    const mockErrand = {
      id: 1,
      runner_id: 2,
      status: ErrandStatus.ACCEPTED,
      update: jest.fn().mockResolvedValue(true),
    };

    const mockUpdatedErrand = {
      id: 1,
      status: ErrandStatus.IN_PROGRESS,
      customer: { id: 1 },
      runner: { id: 2 },
    };

    beforeEach(() => {
      // Mock the private getErrandWithDetails method
      errandService["getErrandWithDetails"] = jest
        .fn()
        .mockResolvedValue(mockUpdatedErrand);
    });

    it("should start errand successfully", async () => {
      mockErrandFindByPk.mockResolvedValue(mockErrand as any);

      const result = await errandService.startErrand(1, 2);

      expect(result).toEqual(mockUpdatedErrand);
      expect(mockErrand.update).toHaveBeenCalledWith(
        {
          status: ErrandStatus.IN_PROGRESS,
          started_at: expect.any(Date),
        } as any,
        { transaction: expect.anything() }
      );
    });

    it("should throw error when not assigned to errand", async () => {
      const differentRunnerErrand = {
        ...mockErrand,
        runner_id: 3,
      };
      mockErrandFindByPk.mockResolvedValue(differentRunnerErrand as any);

      await expect(errandService.startErrand(1, 2)).rejects.toMatchObject({
        message: "Not assigned to this errand",
        code: "NOT_ASSIGNED_RUNNER",
        statusCode: 403,
      });
    });
  });

  describe("completeErrand", () => {
    const mockErrand = {
      id: 1,
      runner_id: 2,
      customer_id: 1,
      status: ErrandStatus.IN_PROGRESS,
      base_price: 25.5,
      final_price: 28.33,
      category: Category.FOOD_DELIVERY,
      urgency: Urgency.STANDARD,
      distance_km: 5.2,
      update: jest.fn().mockResolvedValue(true),
    };

    const mockRunner = {
      user_id: 2,
      completed_errands: 10,
      earnings: 500,
      rating: 4.5,
      update: jest.fn().mockResolvedValue(true),
    };

    const mockUpdatedErrand = {
      id: 1,
      status: ErrandStatus.COMPLETED,
      customer: { id: 1 },
      runner: { id: 2 },
      transaction: { id: 1 },
    };

    beforeEach(() => {
      mockedGetFullPricing.mockReturnValue(createMockPricing());
      mockRunnerFindOne.mockResolvedValue(mockRunner as any);
      mockTransactionCreate.mockResolvedValue({} as any);

      // Mock the private getErrandWithDetails method
      errandService["getErrandWithDetails"] = jest
        .fn()
        .mockResolvedValue(mockUpdatedErrand);
    });

    it("should complete errand successfully", async () => {
      mockErrandFindByPk.mockResolvedValue(mockErrand as any);

      const result = await errandService.completeErrand(1, 2);

      expect(result).toEqual(mockUpdatedErrand);
      expect(mockErrand.update).toHaveBeenCalledWith(
        {
          status: ErrandStatus.COMPLETED,
          completed_at: expect.any(Date),
        } as any,
        { transaction: expect.anything() }
      );

      expect(mockRunner.update).toHaveBeenCalledWith(
        {
          is_available: true,
          completed_errands: 11,
          earnings: 521.67, // 500 + 21.67
          rating: expect.any(Number),
        },
        { transaction: expect.anything() }
      );

      expect(mockTransactionCreate).toHaveBeenCalledWith(
        {
          errand_id: 1,
          customer_id: 1,
          runner_id: 2,
          amount: 28.33,
          base_amount: 25.5,
          platform_fee: 1.28,
          runner_earnings: 21.67,
          payment_status: "pending",
          payment_method: "wallet",
          completed_at: expect.any(Date),
        } as any,
        { transaction: expect.anything() }
      );
    });

    it("should throw error when runner not found", async () => {
      mockErrandFindByPk.mockResolvedValue(mockErrand as any);
      mockRunnerFindOne.mockResolvedValue(null);

      await expect(errandService.completeErrand(1, 2)).rejects.toMatchObject({
        message: "Runner not found",
        code: "RUNNER_NOT_FOUND",
        statusCode: 404,
      });
    });
  });

  describe("cancelErrand", () => {
    const mockErrand = {
      id: 1,
      customer_id: 1,
      runner_id: null,
      status: ErrandStatus.PENDING,
      update: jest.fn().mockResolvedValue(true),
    };

    const mockUpdatedErrand = {
      id: 1,
      status: ErrandStatus.CANCELLED,
      customer: { id: 1 },
    };

    beforeEach(() => {
      // Mock the private getErrandWithDetails method
      errandService["getErrandWithDetails"] = jest
        .fn()
        .mockResolvedValue(mockUpdatedErrand);
    });

    it("should cancel errand successfully as customer", async () => {
      mockErrandFindByPk.mockResolvedValue(mockErrand as any);
      mockErrandCount.mockResolvedValue(0); // recent cancellations

      const result = await errandService.cancelErrand(1, 1, "Changed my mind");

      expect(result).toEqual(mockUpdatedErrand);
      expect(mockErrand.update).toHaveBeenCalledWith(
        {
          status: ErrandStatus.CANCELLED,
          cancellation_reason: "Changed my mind",
          cancelled_by: 1,
          cancelled_at: expect.any(Date),
        } as any,
        { transaction: expect.anything() }
      );
    });

    it("should throw error when too many cancellations as customer", async () => {
      mockErrandFindByPk.mockResolvedValue(mockErrand as any);
      mockErrandCount.mockResolvedValue(3); // recent cancellations

      await expect(
        errandService.cancelErrand(1, 1, "Reason")
      ).rejects.toMatchObject({
        message: expect.stringContaining("Too many cancellations"),
        code: "TOO_MANY_CANCELLATIONS",
        statusCode: 429,
      });
    });

    it("should not allow customer to cancel in-progress errand", async () => {
      const inProgressErrand = {
        id: 1,
        customer_id: 1,
        runner_id: 2,
        status: ErrandStatus.IN_PROGRESS,
        update: jest.fn().mockResolvedValue(true),
      };

      mockErrandFindByPk.mockResolvedValue(inProgressErrand as any);

      await expect(
        errandService.cancelErrand(1, 1, "test")
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          "Cannot cancel errand that is in progress"
        ),
        code: "CANCELLATION_NOT_ALLOWED",
        statusCode: 403,
      });
    });
  });

  describe("previewEarnings", () => {
    it("should return pricing breakdown for valid inputs", () => {
      const mockPricing = createMockPricing();
      mockedGetFullPricing.mockReturnValue(mockPricing);

      const result = errandService.previewEarnings(
        20,
        Category.FOOD_DELIVERY,
        Urgency.URGENT,
        5.2
      );

      expect(result).toEqual(mockPricing);
      expect(mockedGetFullPricing).toHaveBeenCalledWith(
        20,
        Category.FOOD_DELIVERY,
        Urgency.URGENT,
        5.2
      );
    });

    it("should throw error for invalid base price", () => {
      expect(() => {
        errandService.previewEarnings(
          -10,
          Category.FOOD_DELIVERY,
          Urgency.STANDARD
        );
      }).toThrow(ErrandError);
    });
  });

  describe("getErrandById", () => {
    const mockErrand = {
      id: 1,
      customer_id: 1,
      runner_id: 2,
      customer: { id: 1 },
      runner: { id: 2 },
      transaction: null,
      review: null,
    };

    beforeEach(() => {
      // Mock the private method
      errandService["getErrandWithDetails"] = jest.fn();
    });

    it("should return errand for authorized customer", async () => {
      errandService["getErrandWithDetails"] = jest
        .fn()
        .mockResolvedValue(mockErrand);

      const result = await errandService.getErrandById(1, 1);

      expect(result).toEqual(mockErrand);
    });

    it("should throw error for unauthorized user", async () => {
      errandService["getErrandWithDetails"] = jest
        .fn()
        .mockResolvedValue(mockErrand);

      await expect(errandService.getErrandById(1, 3)) // Different user
        .rejects.toMatchObject({
          message: "Not authorized to view this errand",
          code: "NOT_AUTHORIZED",
          statusCode: 403,
        });
    });
  });

  describe("authorizeErrandAction", () => {
    const mockErrand = {
      id: 1,
      customer_id: 1,
      runner_id: 2,
      status: ErrandStatus.PENDING,
    };

    it("should authorize customer to update pending errand", async () => {
      mockErrandFindByPk.mockResolvedValue(mockErrand as any);

      const result = await errandService.authorizeErrandAction(1, 1, "update");

      expect(result).toBe(true);
    });

    it("should not authorize customer to update non-pending errand", async () => {
      const acceptedErrand = {
        id: 1,
        customer_id: 1,
        runner_id: 2,
        status: ErrandStatus.ACCEPTED,
      };
      mockErrandFindByPk.mockResolvedValue(acceptedErrand as any);

      const result = await errandService.authorizeErrandAction(1, 1, "update");

      expect(result).toBe(false);
    });
  });
});
