import otpService from '../otpService';

describe('OTP Service', () => {
  beforeEach(() => {
    // Clear OTP store before each test
    (otpService as any).otpStore.clear();
  });

  describe('generateOTP', () => {
    it('should generate a 6-digit numeric OTP', () => {
      const otp = otpService.generateOTP();
      
      expect(otp).toHaveLength(6);
      expect(otp).toMatch(/^\d+$/);
    });

    it('should generate unique OTPs', () => {
      const otp1 = otpService.generateOTP();
      const otp2 = otpService.generateOTP();
      
      expect(otp1).not.toBe(otp2);
    });
  });

  describe('createOTP', () => {
    it('should create and store OTP for phone number', async () => {
      const phoneNumber = '+255712345678';
      const otp = await otpService.createOTP(phoneNumber);

      expect(otp).toBeDefined();
      expect(otp).toHaveLength(6);
    });

    it('should clean phone number format', async () => {
      const phoneNumber = '0712 345-678';
      const otp = await otpService.createOTP(phoneNumber);

      // Should work without throwing error
      expect(otp).toBeDefined();
    });
  });

  describe('verifyOTP', () => {
    it('should verify correct OTP', async () => {
      const phoneNumber = '+255712345678';
      const otp = await otpService.createOTP(phoneNumber);

      const result = await otpService.verifyOTP(phoneNumber, otp);
      
      expect(result).toBe(true);
    });

    it('should reject incorrect OTP', async () => {
      const phoneNumber = '+255712345678';
      await otpService.createOTP(phoneNumber);

      await expect(
        otpService.verifyOTP(phoneNumber, 'wrong123')
      ).rejects.toThrow('Invalid OTP code');
    });

    it('should reject expired OTP', async () => {
      const phoneNumber = '+255712345678';
      const otp = await otpService.createOTP(phoneNumber);

      // Manually expire the OTP
      const otpStore = (otpService as any).otpStore;
      const otpData = otpStore.get(phoneNumber.replace(/[\s\-+]/g, ''));
      otpData.expires_at = new Date(Date.now() - 1000); // Set to past

      await expect(
        otpService.verifyOTP(phoneNumber, otp)
      ).rejects.toThrow('OTP has expired');
    });
  });
});