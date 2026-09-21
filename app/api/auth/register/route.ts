import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';
import Referral from '@/models/Referral';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  referralCode: z.string().optional(),
  isAdmin: z.boolean().optional(),
  secretKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password, phone, referralCode, isAdmin, secretKey } = validation.data;

    await connectDB();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Admin registration validation
    let role: 'user' | 'admin' = 'user';
    if (isAdmin) {
      // First check against environment variable for initial setup
      const envSecretKey = process.env.ADMIN_SECRET_KEY;
      const settings = await Settings.findOne();

      // Environment variable takes priority (allows updating via .env.local)
      const validSecretKey = envSecretKey || settings?.adminSecretKey;

      if (!validSecretKey || secretKey !== validSecretKey) {
        return NextResponse.json(
          { error: 'Invalid admin secret key' },
          { status: 401 }
        );
      }

      // Initialize settings if they don't exist
      if (!settings && envSecretKey) {
        await Settings.create({
          siteName: 'Pakistani Noor',
          adminSecretKey: envSecretKey,
        });
      }

      role = 'admin';
    }

    // Find referrer if referral code provided
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role,
      referredBy: referrer?._id,
    });

    // Create referral record if referred
    if (referrer) {
      const settings = await Settings.findOne();
      await Referral.create({
        referrer: referrer._id,
        referred: user._id,
        referralCode: referralCode?.toUpperCase(),
        referrerBonus: settings?.loyalty.referralBonus || 50,
        referredBonus: settings?.loyalty.referralBonus || 50,
      });
    }

    // Return user without password
    const userWithoutPassword = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
    };

    return NextResponse.json(
      {
        message: 'User registered successfully',
        user: userWithoutPassword,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
