import type { Handler, HandlerContext } from '@netlify/functions';

import { syncSeededTourSlots } from './generate-seeded-tour-slots';
import { isAuthenticated } from './utils/auth';

export const handler: Handler = async (event, context: HandlerContext) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!(await isAuthenticated(event, context))) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const result = await syncSeededTourSlots();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, ...result }),
    };
  } catch (error) {
    console.error('[admin-seed-tour-slots] Error:', error);
    const details = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to sync seeded tour slots',
        details: process.env.CONTEXT === 'dev' || process.env.NODE_ENV !== 'production' ? details : undefined,
      }),
    };
  }
};
