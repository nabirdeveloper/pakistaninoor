import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import { connectDB } from '@/lib/db/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string;
      role: 'user' | 'admin' | 'superadmin';
      isVerified: boolean;
    };
  }

  interface User {
    id: string;
    name: string;
    email: string;
    image?: string;
    role: 'user' | 'admin' | 'superadmin';
    isVerified: boolean;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: 'user' | 'admin' | 'superadmin';
    isVerified: boolean;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        isAdmin: { label: 'Is Admin', type: 'text' },
        secretKey: { label: 'Secret Key', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please provide email and password');
        }

        await connectDB();

        const user = await User.findOne({ email: credentials.email }).select('+password');

        if (!user) {
          throw new Error('No user found with this email');
        }

        if (!user.isActive) {
          throw new Error('Your account has been deactivated');
        }

        const isPasswordValid = await user.comparePassword(credentials.password as string);

        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }

        // Admin login validation
        if (credentials.isAdmin === 'true') {
          if (user.role !== 'admin' && user.role !== 'superadmin') {
            throw new Error('You do not have admin access');
          }

          // Verify secret key for admin - environment variable takes priority
          const envSecretKey = process.env.ADMIN_SECRET_KEY;
          const settings = await Settings.findOne();
          const validSecretKey = envSecretKey || settings?.adminSecretKey;

          if (validSecretKey && credentials.secretKey !== validSecretKey) {
            throw new Error('Invalid admin secret key');
          }
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.avatar,
          role: user.role,
          isVerified: user.isVerified,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          Facebook({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' || account?.provider === 'facebook') {
        await connectDB();

        // Check if user exists
        let existingUser = await User.findOne({ email: user.email });

        if (!existingUser) {
          // Create new user
          existingUser = await User.create({
            name: user.name,
            email: user.email,
            avatar: user.image,
            password: Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12),
            isVerified: true,
            role: 'user',
          });
        } else {
          // Update avatar if not set
          if (!existingUser.avatar && user.image) {
            existingUser.avatar = user.image;
            await existingUser.save();
          }
        }

        if (!existingUser.isActive) {
          return false;
        }

        existingUser.lastLogin = new Date();
        await existingUser.save();

        // Pass the database user info to jwt callback
        user.id = existingUser._id.toString();
        user.role = existingUser.role;
        user.isVerified = existingUser.isVerified;
        user.image = existingUser.avatar;
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isVerified = user.isVerified;
      }

      // Handle session update
      if (trigger === 'update' && session) {
        token.name = session.name;
        token.picture = session.image;
      }

      // Fetch fresh user data on each request (for role updates, etc.)
      if (token.id) {
        await connectDB();
        const freshUser = await User.findById(token.id);
        if (freshUser) {
          token.role = freshUser.role;
          token.isVerified = freshUser.isVerified;
          token.name = freshUser.name;
          token.picture = freshUser.avatar;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'user' | 'admin' | 'superadmin';
        session.user.isVerified = token.isVerified as boolean;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
    newUser: '/auth/profile-setup',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  trustHost: true,
});
