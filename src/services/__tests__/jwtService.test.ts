import jwtService from '../jwtService';
import models from '../../models';

process.env.JWT_SECRET = 'test-secret';

describe('JWT Service', () => {
  const mockUser = {
    id: 1,
    phone_number: '0712345678',
    user_type: 'customer'
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = jwtService.generateToken({
        userId: mockUser.id,
        phoneNumber: mockUser.phone_number,
        userType: mockUser.user_type,
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a token', () => {
      const payload = {
        userId: mockUser.id,
        phoneNumber: mockUser.phone_number,
        userType: mockUser.user_type,
      };

      const token = jwtService.generateToken(payload);
      const decoded = jwtService.verifyToken(token);

      expect(decoded.userId).toBe(payload.userId);
    });

    it('should throw for invalid token', () => {
      expect(() => jwtService.verifyToken('invalid.token'))
        .toThrow('Invalid or expired token');
    });
  });

  describe('generateAuthTokens', () => {
    it('should return token and user profile', async () => {
      // Mock sequelize User.findByPk
      jest.spyOn(models.User, 'findByPk').mockResolvedValue({
        id: mockUser.id,
        phone_number: mockUser.phone_number,
        user_type: mockUser.user_type,
        runner_profile: null,
      } as any);

      const result = await jwtService.generateAuthTokens(mockUser);

      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(mockUser.id);
    });
  });
});
