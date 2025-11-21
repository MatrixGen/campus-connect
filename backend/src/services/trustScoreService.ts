import models from '../models';

interface TrustScoreFactors {
  rating: number;
  completedErrands: number;
  responseRate: number;
  cancellationRate: number;
  accountAge: number;
  verificationStatus: number; // Changed from string to number
  reportCount: number;
}

class TrustScoreService {
  // Calculate trust score for a user (0-100)
  async calculateTrustScore(userId: number): Promise<number> {
    try {
      const user = await models.User.findByPk(userId, {
        include: [
          {
            model: models.Runner,
            as: 'runner_profile',
            required: false,
          },
          {
            model: models.Review,
            as: 'reviews_received',
            required: false,
          },
          {
            model: models.Report,
            as: 'reports_received',
            where: { status: 'resolved' },
            required: false,
          }
        ]
      });

      if (!user) {
        throw new Error('User not found');
      }

      const factors = await this.calculateFactors(userId, user);
      return this.computeScore(factors);
    } catch (error) {
      console.error('Error calculating trust score:', error);
      return 50; // Default score if calculation fails
    }
  }

  private async calculateFactors(userId: number, user: any): Promise<TrustScoreFactors> {
    // Rating factor (0-50 points)
    const rating = user.runner_profile?.rating || 5.0;
    const ratingScore = (rating / 5) * 50;

    // Completed errands factor (0-20 points)
    const completedErrands = user.runner_profile?.completed_errands || 0;
    const errandScore = Math.min(completedErrands * 0.5, 20); // 0.5 points per errand, max 20

    // Response rate (0-10 points)
    const responseRate = await this.calculateResponseRate(userId);
    const responseScore = responseRate * 10;

    // Cancellation rate (0-10 points)
    const cancellationRate = await this.calculateCancellationRate(userId);
    const cancellationScore = (1 - cancellationRate) * 10;

    // Account age factor (0-5 points)
    const accountAge = this.calculateAccountAge(user.created_at);
    const ageScore = Math.min(accountAge / 30, 5); // 5 points after 150 days

    // Verification status (0-5 points)
    const verificationScore = user.verification_status === 'verified' ? 5 : 0;

    // Report penalty (0 to -20 points)
    const reportCount = user.reports_received?.length || 0;
    const reportPenalty = Math.min(reportCount * 2, 20);

    return {
      rating: ratingScore,
      completedErrands: errandScore,
      responseRate: responseScore,
      cancellationRate: cancellationScore,
      accountAge: ageScore,
      verificationStatus: verificationScore, // Now this matches the interface (number)
      reportCount: -reportPenalty
    };
  }

  private computeScore(factors: TrustScoreFactors): number {
    const baseScore = 
      factors.rating +
      factors.completedErrands +
      factors.responseRate +
      factors.cancellationRate +
      factors.accountAge +
      factors.verificationStatus + // Now this is a number
      factors.reportCount;

    return Math.max(0, Math.min(100, Math.round(baseScore)));
  }

  private async calculateResponseRate(userId: number): Promise<number> {
    // For runners: percentage of errands accepted vs viewed
    const totalOffers = await models.Errand.count({
      where: {
        status: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled']
      }
    });

    const acceptedOffers = await models.Errand.count({
      where: {
        runner_id: userId,
        status: ['accepted', 'in_progress', 'completed']
      }
    });

    return totalOffers > 0 ? acceptedOffers / totalOffers : 1;
  }

  private async calculateCancellationRate(userId: number): Promise<number> {
    const runnerErrands = await models.Errand.count({
      where: {
        runner_id: userId,
        status: ['accepted', 'in_progress', 'completed', 'cancelled']
      }
    });

    const cancelledErrands = await models.Errand.count({
      where: {
        runner_id: userId,
        status: 'cancelled'
      }
    });

    return runnerErrands > 0 ? cancelledErrands / runnerErrands : 0;
  }

  private calculateAccountAge(createdAt: Date): number {
    const now = new Date();
    const created = new Date(createdAt);
    const diffTime = Math.abs(now.getTime() - created.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Days
  }

  // Get trust badge based on score
  getTrustBadge(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'very_good';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'new';
  }

  // Check if user meets minimum trust requirements
  async meetsMinimumRequirements(userId: number): Promise<boolean> {
    const score = await this.calculateTrustScore(userId);
    return score >= 30; // Minimum threshold
  }
}

export default new TrustScoreService();