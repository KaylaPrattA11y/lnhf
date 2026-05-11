import { MongoClient, type Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Returns a cached MongoDB Db instance.
 * Reuses the connection across warm serverless function invocations.
 */
export async function getDb(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  client = new MongoClient(uri, {
    // Lean connection options suited for serverless (short-lived containers)
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  await client.connect();
  db = client.db('lnhf');
  return db;
}

export interface BookingSlot {
  _id?: unknown;
  date: string;           // "YYYY-MM-DD"
  startTime: string;      // "10:00"
  endTime: string;        // "11:00"
  status: 'available' | 'booked' | 'blocked';
  booking?: {
    name: string;
    email: string;
    phone?: string;
    partySize?: number;
    message?: string;
    bookedAt: Date;
  };
}
