import jwt from 'jsonwebtoken';
import models from '../models';

interface TokenPayload {
  userId: number;
  phoneNumber: string;
  userType: string;
}

class JWTService {
  private secret = process.env.JWT_SECRET!;

  generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: '7d', // Token expires in 7 days
    });
  }

  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.secret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async generateAuthTokens(user: any): Promise<{ token: string; user: any }> {
    const payload: TokenPayload = {
      userId: user.id,
      phoneNumber: user.phone_number,
      userType: user.user_type,
    };

    const token = this.generateToken(payload);

    // Get user with runner profile if exists
    const userWithProfile = await models.User.findByPk(user.id, {
      include: [{
        model: models.Runner,
        as: 'runner_profile',
        required: false,
      }],
    });

    return {
      token,
      user: userWithProfile,
    };
  }
}

export default new JWTService();