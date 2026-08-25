import type { Handler } from '@netlify/functions';
import { google } from 'googleapis';

/* 
** This function adds an event to a Google Calendar using the Google Calendar API.
** In this case, we are automatically adding booked tours to the owner's Google Calendar.
*/
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { summary, description, startDateTime, endDateTime } = JSON.parse(event.body || '{}');
    const timeZone = 'America/New_York'; // Set your desired timezone

    // Basic validation
    if (!summary || !startDateTime || !endDateTime) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields or invalid format' }) };
    }

    // Authenticate using Service Account environment variables
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      requestBody: {
        summary,
        description,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, eventLink: response.data.htmlLink }),
    };
  } catch (error: any) {
    console.error('Error adding calendar event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};