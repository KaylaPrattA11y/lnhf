import { getDatabase } from '@netlify/database';

// Lazily initialized so the module can be imported before the connection
// string env var is set (e.g. during build-time bundling).
let _db: ReturnType<typeof getDatabase> | null = null;
let _weddingDb: ReturnType<typeof getDatabase> | null = null;

export function getDb() {
  if (!_db) {
    const connectionString = process.env.NETLIFY_TOURS_DB_URL;
    _db = getDatabase({ connectionString });
  }
  return _db;
}

export function getWeddingDb() {
  if (!_weddingDb) {
    const connectionString = process.env.NETLIFY_WEDDINGS_DB_URL ?? process.env.NETLIFY_TOURS_DB_URL;
    _weddingDb = getDatabase({ connectionString });
  }
  return _weddingDb;
}

export interface TourSlot {
  _id: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  status: 'available' | 'booked' | 'blocked';
  tour?: {
    name: string;
    email: string;
    phone?: string;
    partySize?: number;
    message?: string;
    bookedAt: string;
  };
}
