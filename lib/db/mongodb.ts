import mongoose from 'mongoose';
// Register every model up front so populate()/ref lookups never hit
// MissingSchemaError, even when a route is the first thing a cold
// server process handles (model availability must not depend on
// which module happened to load first).
import '@/models';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pakistaninoor';

if (!process.env.MONGODB_URI) {
  console.warn(
    'MONGODB_URI is not set. Using local fallback: mongodb://127.0.0.1:27017/pakistaninoor. Add it to .env.local for production or custom setups.'
  );
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      // Cold-start discovery handshakes across all Atlas shards can exceed a
      // 5s window on slower networks, 500ing the first requests a fresh dev
      // process handles. Allow more time so the initial pool warm-up succeeds;
      // if Atlas is genuinely unreachable requests still fail fast-ish.
      serverSelectionTimeoutMS: 12000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('MongoDB connected successfully');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
