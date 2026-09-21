// Run with: npx ts-node scripts/reset-admin-password.ts
// Or: npx tsx scripts/reset-admin-password.ts

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = 'nabirhosen287@gmail.com';
const NEW_PASSWORD = 'Admin@123456'; // Change this to your desired password

async function resetPassword() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, salt);

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection is not ready');
    }

    const result = await db.collection('users').updateOne(
      { email: ADMIN_EMAIL },
      { $set: { password: hashedPassword } }
    );

    if (result.matchedCount === 0) {
      console.log('User not found:', ADMIN_EMAIL);
    } else {
      console.log('Password reset successfully!');
      console.log('Email:', ADMIN_EMAIL);
      console.log('New password:', NEW_PASSWORD);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

resetPassword();
