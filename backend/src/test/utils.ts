import models from '../models';

export const createTestUser = async (userData?: any) => {
  return await models.User.create({
    phone_number: '+255700000001',
    full_name: 'Test User',
    user_type: 'customer',
    student_id: 'TEST001',
    verification_status: 'verified',
    ...userData,
  });
};

export const createTestRunner = async (userData?: any, runnerData?: any) => {
  const user = await createTestUser({
    user_type: 'runner',
    ...userData,
  });

  const runner = await models.Runner.create({
    user_id: user.id,
    areas_covered: ['hostel_area', 'library'],
    transportation_mode: 'walking',
    is_available: true,
    rating: 4.5,
    ...runnerData,
  });

  return { user, runner };
};

export const createTestErrand = async (customerId: number, errandData?: any) => {
  return await models.Errand.create({
    customer_id: customerId,
    title: 'Test Errand',
    description: 'Test description',
    category: 'delivery',
    status: 'pending',
    location_from: 'Hostel A',
    location_to: 'Library',
    budget: 5000.00,
    urgency: 'standard',
    ...errandData,
  });
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
};