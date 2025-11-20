import models from '../models';

export const createTestUser = async (userData: any = {}) => {
  const user = await models.User.create({
    phone_number: userData.phone_number || `2557${Math.floor(10000000 + Math.random() * 90000000)}`,
    email: userData.email || `test${Math.random()}@example.com`,
    full_name: userData.full_name || 'Test User',
    user_type: userData.user_type || 'customer',
    student_id: userData.student_id || `ST${Math.floor(10000 + Math.random() * 90000)}`,
    verification_status: 'verified',
    ...userData
  });

  return user;
};

export const createTestRunner = async (runnerData: any = {}) => {
  const user = await createTestUser({ 
    user_type: 'runner',
    ...runnerData 
  });

  const runner = await models.Runner.create({
    user_id: user.id,
    is_available: true,
    rating: 4.5,
    completed_errands: 0,
    earnings: 0,
    transportation_mode: 'walking',
    ...runnerData
  });

  return { user, runner };
};

// test/utils.ts

export const createTestErrand = async (customerId: number, errandData: any = {}) => {
  // Ensure the customer exists
  const customer = await models.User.findByPk(customerId);
  if (!customer) {
    throw new Error(`Customer with id ${customerId} not found`);
  }

  const errand = await models.Errand.create({
    customer_id: customerId,
    title: errandData.title || "Test Errand",
    description: errandData.description || "Test description",
    category: errandData.category || "delivery",
    status: errandData.status || "pending",
    location_from: errandData.location_from || "Location A",
    location_to: errandData.location_to || "Location B",
    base_price: errandData.base_price || 5000,
    final_price: errandData.final_price || 5000,
    distance_km: errandData.distance_km || 0,
    urgency: errandData.urgency || "standard",
    runner_id: errandData.runner_id || null,
    ...errandData
  });

  return errand;
};


export const generateAuthToken = async (user: any) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { 
      userId: user.id, 
      phoneNumber: user.phone_number, 
      userType: user.user_type 
    },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
 
 //return `mock-token-${user.id}-${Date.now()}`;

};

export const createTestTransaction = async (errandId: number, transactionData?: any) => {
  return await models.Transaction.create({
    errand_id: errandId,
    amount: 5000.00,
    platform_fee: 1250.00,
    runner_earnings: 3750.00,
    payment_status: 'completed',
    payment_method: 'tigo_pesa',
    transaction_code: 'TP123456789',
    ...transactionData,
  });
};