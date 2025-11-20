import models from '../models';

const createTestData = async (): Promise<void> => {
  try {
    console.log('🧪 Creating test data...');

    // Create verified test users
    const user1 = await models.User.create({
      phone_number: '+255700000001',
      full_name: 'John Student',
      user_type: 'customer',
      student_id: 'CS2024001',
      verification_status: 'verified',
    });

    const user2 = await models.User.create({
      phone_number: '+255700000002',
      full_name: 'Sarah Runner',
      user_type: 'runner',
      student_id: 'BA2024002',
      verification_status: 'verified',
    });

    const user3 = await models.User.create({
      phone_number: '+255700000003',
      full_name: 'Mike Both',
      user_type: 'both',
      student_id: 'EE2024003',
      verification_status: 'verified',
    });

    // Create runner profiles
    const runner1 = await models.Runner.create({
      user_id: user2.id,
      areas_covered: ['hostel_area', 'library', 'town_center'],
      transportation_mode: 'walking',
      is_available: true,
      rating: 4.8,
      completed_errands: 12,
      earnings: 45000.00,
    });

    const runner2 = await models.Runner.create({
      user_id: user3.id,
      areas_covered: ['campus_center', 'library', 'hostel_area'],
      transportation_mode: 'bicycle',
      is_available: true,
      rating: 4.5,
      completed_errands: 8,
      earnings: 32000.00,
    });

    // Create test errands with different statuses
    const pendingErrand = await models.Errand.create({
      customer_id: user1.id,
      title: 'Print lecture notes',
      description: 'Need 50 pages of lecture notes printed and delivered to hostel',
      category: 'printing',
      status: 'pending',
      location_from: 'Library printing shop',
      location_to: 'Hostel Block B',
      budget: 3500.00,
      urgency: 'standard',
    });

    const acceptedErrand = await models.Errand.create({
      customer_id: user1.id,
      runner_id: user2.id,
      title: 'Buy and deliver lunch',
      description: 'Chicken burger and chips from town food court',
      category: 'shopping',
      status: 'accepted',
      location_from: 'Town Food Court',
      location_to: 'Campus Library',
      budget: 8000.00,
      urgency: 'urgent',
      accepted_at: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    });

    const inProgressErrand = await models.Errand.create({
      customer_id: user3.id,
      runner_id: user2.id,
      title: 'Deliver documents to administration',
      description: 'Need to submit these admission documents',
      category: 'delivery',
      status: 'in_progress',
      location_from: 'Hostel Block A',
      location_to: 'Administration Building',
      budget: 5000.00,
      urgency: 'urgent',
      accepted_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    });

    const completedErrand = await models.Errand.create({
      customer_id: user1.id,
      runner_id: user2.id,
      title: 'Stand in queue for registration',
      description: 'Need someone to hold my place in the registration line',
      category: 'queue_standing',
      status: 'completed',
      location_from: 'Registration Office',
      location_to: 'Registration Office',
      budget: 6000.00,
      urgency: 'standard',
      accepted_at: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    });

    // Create transactions for completed errands
    const transaction1 = await models.Transaction.create({
      errand_id: completedErrand.id,
      amount: 6000.00,
      platform_fee: 1500.00,
      runner_earnings: 4500.00,
      payment_status: 'completed',
      payment_method: 'tigo_pesa',
      transaction_code: 'TP123456789',
    });

    // Create reviews
    const review1 = await models.Review.create({
      errand_id: completedErrand.id,
      reviewer_id: user1.id,
      reviewee_id: user2.id,
      rating: 5,
      comment: 'Excellent service! Waited in line for 2 hours without complaints.',
    });

    console.log('✅ Test data created successfully!');
    console.log(`📊 Created: 
      - 3 users (1 customer, 1 runner, 1 both)
      - 2 runner profiles
      - 4 errands (pending, accepted, in_progress, completed)
      - 1 transaction
      - 1 review`);

  } catch (error) {
    console.error('❌ Failed to create test data:', error);
  }
};

export default createTestData;