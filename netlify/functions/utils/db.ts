import { getDatabase } from '@netlify/database';

// Lazily initialized so the module can be imported before the connection
// string env var is set (e.g. during build-time bundling).
let _db: ReturnType<typeof getDatabase> | null = null;

export function getDb() {
  if (!_db) {
    const connectionString =
      process.env.NETLIFY_DB_URL;
    _db = getDatabase({ connectionString });
  }
  return _db;
}

export interface BookingSlot {
  _id: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  status: 'available' | 'booked' | 'blocked';
  booking?: {
    name: string;
    email: string;
    phone?: string;
    partySize?: number;
    message?: string;
    bookedAt: string;
  };
}
