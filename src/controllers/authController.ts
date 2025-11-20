import { Request, Response } from 'express';
import models from '../models';
import smsService from '../services/smsService';
import otpService from '../services/otpService';
import jwtService from '../services/jwtService';
import bcrypt from 'bcryptjs';

class AuthController {
  async register(req: Request, res: Response): Promise<Response> {
    try {
      const { phone_number, full_name, user_type, student_id, email } = req.body;

      // Check if user already exists
      const existingUser = await models.User.findOne({
        where: { phone_number },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this phone number already exists',
        });
      }

      // Create new user
      const newUser = await models.User.create({
        phone_number,
        full_name,
        user_type: user_type || 'customer',
        student_id,
        email,
        verification_status: 'pending',
      });

      // Generate and send OTP
      const otpCode = await otpService.createOTP(phone_number);
      
      try {
        await smsService.sendOTP(phone_number, otpCode);
      } catch (smsError) {
        console.error('SMS sending failed, but user created:', smsError);
        // Continue even if SMS fails for development
      }

      return res.status(201).json({
        success: true,
        message: 'User registered successfully. OTP sent to your phone.',
        data: {
          user: {
            id: newUser.id,
            phone_number: newUser.phone_number,
            full_name: newUser.full_name,
            user_type: newUser.user_type,
            verification_status: newUser.verification_status,
          },
          // In development, return OTP for testing
          otp: process.env.NODE_ENV === 'development' ? otpCode : undefined,
        },
      });

    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during registration',
      });
    }
  }

  async verifyOTP(req: Request, res: Response): Promise<Response> {
    try {
      const { phone_number, otp_code } = req.body;

      // Verify OTP
      await otpService.verifyOTP(phone_number, otp_code);

      // Find user and update verification status
      const user = await models.User.findOne({
        where: { phone_number },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Update user verification status
      await user.update({ verification_status: 'verified' });

      // Generate auth tokens
      const authData = await jwtService.generateAuthTokens(user);

      return res.json({
        success: true,
        message: 'Phone number verified successfully',
        data: authData,
      });

    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async login(req: Request, res: Response): Promise<Response> {
    try {
      const { phone_number } = req.body;

      // Find user
      const user = await models.User.findOne({
        where: { phone_number },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found. Please register first.',
        });
      }

      // Generate and send OTP
      const otpCode = await otpService.createOTP(phone_number);
      
      try {
        await smsService.sendOTP(phone_number, otpCode);
      } catch (smsError) {
        console.error('SMS sending failed:', smsError);
        // Continue even if SMS fails for development
      }

      return res.json({
        success: true,
        message: 'OTP sent to your phone number',
        data: {
          // In development, return OTP for testing
          otp: process.env.NODE_ENV === 'development' ? otpCode : undefined,
        },
      });

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during login',
      });
    }
  }

  async resendOTP(req: Request, res: Response): Promise<Response> {
    try {
      const { phone_number } = req.body;

      // Generate and send new OTP
      const otpCode = await otpService.createOTP(phone_number);
      
      try {
        await smsService.sendOTP(phone_number, otpCode);
      } catch (smsError) {
        console.error('SMS sending failed:', smsError);
        // Continue even if SMS fails for development
      }

      return res.json({
        success: true,
        message: 'New OTP sent to your phone number',
        data: {
          // In development, return OTP for testing
          otp: process.env.NODE_ENV === 'development' ? otpCode : undefined,
        },
      });

    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getProfile(req: Request, res: Response): Promise<Response> {
    try {
      // req.user is set by auth middleware (we'll create this next)
      const userId = (req as any).user.userId;

      const user = await models.User.findByPk(userId, {
        include: [{
          model: models.Runner,
          as: 'runner_profile',
          required: false,
        }],
        attributes: { exclude: ['created_at', 'updated_at'] },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.json({
        success: true,
        data: user,
      });

    } catch (error) {
      console.error('Get profile error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
}

export default new AuthController();