// src/__tests__/auth.integration.test.ts
import request from 'supertest';
import app from '../server';
import models from '../models';
import otpService from '../services/otpService';
import smsService from '../services/smsService';
import jwtService from '../services/jwtService';

process.env.NODE_ENV = 'development';

jest.mock('../services/smsService'); // Mock SMS sending
jest.mock('../services/otpService'); // Mock OTP generation

const mockedSmsService = smsService as jest.Mocked<typeof smsService>;
const mockedOtpService = otpService as jest.Mocked<typeof otpService>;

describe('Auth API Integration Tests', () => {
  beforeAll(async () => {
    await models.sequelize.sync({ force: true });
  });

  afterEach(async () => {
    // Clean tables
    await models.Review.destroy({ where: {}, force: true });
    await models.Transaction.destroy({ where: {}, force: true });
    await models.Errand.destroy({ where: {}, force: true });
    await models.Runner.destroy({ where: {}, force: true });
    await models.User.destroy({ where: {}, force: true });
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      mockedOtpService.createOTP.mockResolvedValue('123456');
      mockedSmsService.sendOTP.mockResolvedValue(undefined);

      const res = await request(app).post('/api/auth/register').send({
        phone_number: '+255712345678',
        full_name: 'John Doe',
        user_type: 'customer',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.phone_number).toBe('+255712345678');
      expect(res.body.data.otp).toBeDefined();
    });

    it('should reject duplicate phone number', async () => {
      mockedOtpService.createOTP.mockResolvedValue('123456');
      mockedSmsService.sendOTP.mockResolvedValue(undefined);

      await request(app).post('/api/auth/register').send({
        phone_number: '+255712345678',
        full_name: 'John Doe',
        user_type: 'customer',
      });

      const res = await request(app).post('/api/auth/register').send({
        phone_number: '+255712345678',
        full_name: 'Jane Doe',
        user_type: 'customer',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login existing user and send OTP', async () => {
      mockedOtpService.createOTP.mockResolvedValue('654321');
      mockedSmsService.sendOTP.mockResolvedValue(undefined);

      // Create user first
      await models.User.create({
        phone_number: '+255712345678',
        full_name: 'John Doe',
        user_type: 'customer',
      });

      const res = await request(app).post('/api/auth/login').send({
        phone_number: '+255712345678',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.otp).toBeDefined();
    });

    it('should reject login for non-existent user', async () => {
      const res = await request(app).post('/api/auth/login').send({
        phone_number: '+255700000000',
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('should verify OTP and return JWT token', async () => {
      mockedOtpService.verifyOTP.mockResolvedValue(true);

      const user = await models.User.create({
        phone_number: '+255712345678',
        full_name: 'John Doe',
        user_type: 'customer',
        verification_status: 'pending',
      });

      const res = await request(app).post('/api/auth/verify-otp').send({
        phone_number: '+255712345678',
        otp_code: '123456',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();

      const updatedUser = await models.User.findByPk(user.id);
      expect(updatedUser?.verification_status).toBe('verified');
    });

    it('should reject invalid OTP', async () => {
      mockedOtpService.verifyOTP.mockRejectedValue(new Error('Invalid OTP code'));

      await models.User.create({
        phone_number: '+255712345678',
        full_name: 'John Doe',
        user_type: 'customer',
        verification_status: 'pending',
      });

      const res = await request(app).post('/api/auth/verify-otp').send({
        phone_number: '+255712345678',
        otp_code: 'wrong123',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid OTP code');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile with valid token', async () => {
      const user = await models.User.create({
        phone_number: '+255712345678',
        full_name: 'John Doe',
        user_type: 'customer',
      });

      const token = jwtService.generateToken({
        userId: user.id,
        phoneNumber: user.phone_number,
        userType: user.user_type,
      });

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phone_number).toBe(user.phone_number);
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/auth/profile');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access token required');
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid or expired token');
    });
  });
});
