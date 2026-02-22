import mongoose from 'mongoose';
import { env } from '../config/index.js';

export async function connectMongo(): Promise<void> {
  mongoose.connection.on('connected', () => {
    console.log('[mongo] connected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[mongo] connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('[mongo] disconnected');
  });

  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    retryReads: true,
  });
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
