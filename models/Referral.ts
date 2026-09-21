import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReferral extends Document {
  referrer: mongoose.Types.ObjectId;
  referred: mongoose.Types.ObjectId;
  referralCode: string;
  status: 'pending' | 'completed' | 'expired';
  referrerBonus: number;
  referredBonus: number;
  referrerBonusPaid: boolean;
  referredBonusPaid: boolean;
  firstOrderId?: mongoose.Types.ObjectId;
  firstOrderAmount?: number;
  expiresAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    referrer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referred: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'expired'],
      default: 'pending',
    },
    referrerBonus: {
      type: Number,
      default: 0,
    },
    referredBonus: {
      type: Number,
      default: 0,
    },
    referrerBonusPaid: {
      type: Boolean,
      default: false,
    },
    referredBonusPaid: {
      type: Boolean,
      default: false,
    },
    firstOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    firstOrderAmount: Number,
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
ReferralSchema.index({ referrer: 1, status: 1 });
ReferralSchema.index({ referralCode: 1 });
ReferralSchema.index({ status: 1, expiresAt: 1 });

// Unique constraint: One referral per referred user
ReferralSchema.index({ referred: 1 }, { unique: true });

// Static: Complete referral after first order
ReferralSchema.statics.completeReferral = async function (
  referredUserId: string,
  orderId: string,
  orderAmount: number,
  referrerBonus: number,
  referredBonus: number
) {
  const referral = await this.findOne({
    referred: referredUserId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });

  if (!referral) return null;

  referral.status = 'completed';
  referral.firstOrderId = new mongoose.Types.ObjectId(orderId);
  referral.firstOrderAmount = orderAmount;
  referral.referrerBonus = referrerBonus;
  referral.referredBonus = referredBonus;
  referral.completedAt = new Date();

  await referral.save();

  // Add loyalty points to both users
  const User = mongoose.model('User');
  await Promise.all([
    User.findByIdAndUpdate(referral.referrer, {
      $inc: { loyaltyPoints: referrerBonus },
    }),
    User.findByIdAndUpdate(referral.referred, {
      $inc: { loyaltyPoints: referredBonus },
    }),
  ]);

  referral.referrerBonusPaid = true;
  referral.referredBonusPaid = true;
  await referral.save();

  return referral;
};

// Static: Get referral stats for user
ReferralSchema.statics.getReferralStats = async function (userId: string) {
  const [totalReferrals, completedReferrals, pendingReferrals, totalEarned] = await Promise.all([
    this.countDocuments({ referrer: userId }),
    this.countDocuments({ referrer: userId, status: 'completed' }),
    this.countDocuments({ referrer: userId, status: 'pending' }),
    this.aggregate([
      { $match: { referrer: new mongoose.Types.ObjectId(userId), status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$referrerBonus' } } },
    ]),
  ]);

  return {
    totalReferrals,
    completedReferrals,
    pendingReferrals,
    totalEarned: totalEarned[0]?.total || 0,
  };
};

const Referral: Model<IReferral> = mongoose.models.Referral || mongoose.model<IReferral>('Referral', ReferralSchema);

export default Referral;
