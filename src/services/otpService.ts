import otpGenerator from 'otp-generator';
import models from '../models';

interface OTPData {
  phone_number: string;
  code: string;
  expires_at: Date;
  verified: boolean;
}

class OTPService {
  private otpStore: Map<string, OTPData> = new Map();

  generateOTP(): string {
    return otpGenerator.generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });
  }

  async createOTP(phoneNumber: string): Promise<string> {
    // Clean phone number
    const cleanPhone = phoneNumber.replace(/[\s\-+]/g, '');
    
    const otpCode = this.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const otpData: OTPData = {
      phone_number: cleanPhone,
      code: otpCode,
      expires_at: expiresAt,
      verified: false,
    };

    // Store in memory (in production, use Redis)
    this.otpStore.set(cleanPhone, otpData);

    console.log(`📱 OTP ${otpCode} generated for ${cleanPhone}, expires at ${expiresAt}`);

    return otpCode;
  }

  async verifyOTP(phoneNumber: string, code: string): Promise<boolean> {
    const cleanPhone = phoneNumber.replace(/[\s\-+]/g, '');
    const otpData = this.otpStore.get(cleanPhone);

    if (!otpData) {
      throw new Error('OTP not found or expired');
    }

    if (otpData.expires_at < new Date()) {
      this.otpStore.delete(cleanPhone);
      throw new Error('OTP has expired');
    }

    if (otpData.code !== code) {
      throw new Error('Invalid OTP code');
    }

    // Mark as verified and clean up
    otpData.verified = true;
    this.otpStore.delete(cleanPhone);

    return true;
  }

  async isOTPVerified(phoneNumber: string): Promise<boolean> {
    const cleanPhone = phoneNumber.replace(/[\s\-+]/g, '');
    const otpData = this.otpStore.get(cleanPhone);
    
    return otpData?.verified || false;
  }

  cleanupExpiredOTPs(): void {
    const now = new Date();
    for (const [phone, otpData] of this.otpStore.entries()) {
      if (otpData.expires_at < now) {
        this.otpStore.delete(phone);
      }
    }
  }
}

export default new OTPService();