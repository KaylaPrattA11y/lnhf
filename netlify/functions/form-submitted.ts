import type { Handler } from "@netlify/functions";

interface NetlifySubmissionPayload {
  payload: {
    data: Record<string, string>;
    form_name: string;
  };
}

interface EmailTemplateParameters {
  name: string;
  currentYear: number;
  googleCalendarUrl?: string;
  icsCalendarUrl?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const TOUR_TIME_ZONE = 'America/New_York';
const TOUR_LOCATION = 'Lower Notley Hall Farm, 36290 Notley Manor Ln, Chaptico, MD 20621';

type KnownFormName = 'tour-booking' | 'contact';

const EMAIL_TEMPLATE_BY_FORM: Record<KnownFormName, string> = {
  contact: 'message-received',
  'tour-booking': 'tour-booked',
};

const EMAIL_SUBJECT_BY_FORM: Record<KnownFormName, string> = {
  contact: 'We received your message',
  'tour-booking': 'Your Lower Notley Hall Farm tour was booked',
};

function sanitizeUrl(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed;
}

function toCompactDate(date: string) {
  return date.replace(/-/g, '');
}

function toCompactTime(time: string) {
  return `${time.replace(':', '')}00`;
}

function buildGoogleCalendarUrl(input: {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
}) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${toCompactDate(input.date)}T${toCompactTime(input.startTime)}/${toCompactDate(input.date)}T${toCompactTime(input.endTime)}`,
    details: input.description,
    location: TOUR_LOCATION,
    ctz: TOUR_TIME_ZONE,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildIcsCalendarUrl(input: {
  siteUrl: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
}) {
  const params = new URLSearchParams({
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    title: input.title,
    description: input.description,
    location: TOUR_LOCATION,
    filename: `lnhf-tour-${input.date}-${input.startTime}`,
  });

  return `${input.siteUrl}/.netlify/functions/tour-calendar-ics?${params.toString()}`;
}

function getTourCalendarLinks(data: Record<string, string>, siteUrl: string, guestName: string) {
  const providedGoogleUrl = sanitizeUrl(data['add-to-google-calendar']);
  const providedIcsUrl = sanitizeUrl(data['download-ics-calendar']);

  if (providedGoogleUrl && providedIcsUrl) {
    return { googleCalendarUrl: providedGoogleUrl, icsCalendarUrl: providedIcsUrl };
  }

  const date = (data['slot-date-iso'] ?? '').trim();
  const startTime = (data['slot-start-time'] ?? '').trim();
  const endTime = (data['slot-end-time'] ?? '').trim();

  if (!DATE_RE.test(date) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    const fallback = `${siteUrl}/booking/`;
    return {
      googleCalendarUrl: providedGoogleUrl ?? fallback,
      icsCalendarUrl: providedIcsUrl ?? fallback,
    };
  }

  const title = `Tour at Lower Notley Hall Farm${guestName ? ` with ${guestName}` : ''}`;
  const description = [
    guestName ? `Guest: ${guestName}` : '',
    data.email ? `Email: ${data.email.trim()}` : '',
    data.phone ? `Phone: ${data.phone.trim()}` : '',
    data.message ? `Notes: ${data.message.trim()}` : '',
  ].filter(Boolean).join('\n');

  return {
    googleCalendarUrl: providedGoogleUrl ?? buildGoogleCalendarUrl({ date, startTime, endTime, title, description }),
    icsCalendarUrl: providedIcsUrl ?? buildIcsCalendarUrl({ siteUrl, date, startTime, endTime, title, description }),
  };
}

const handler: Handler = async (event) => {
  if (process.env.ENABLE_CONFIRMATION_EMAILS !== 'true') {
    console.log(`Skipping submission handler — confirmation emails are disabled`);
    return { statusCode: 200, body: "Skipped: email confirmation disabled" };
  }

  if (event.body === null) {
    return { statusCode: 400, body: "Payload required" };
  }

  let payload: NetlifySubmissionPayload;

  try {
    payload = JSON.parse(event.body) as NetlifySubmissionPayload;
  } catch {
    return { statusCode: 400, body: "Invalid JSON payload" };
  }

  const { data, form_name } = payload.payload;

  if (["tour-booking", "contact"].includes(form_name) === false) {
    return { statusCode: 200, body: "Not a known form submission, skipping" };
  }

  const knownFormName = form_name as KnownFormName;

  // Honeypot check - if the bot-field is filled out, it's likely a bot submission
  if (data["bot-field"] && data["bot-field"].trim() !== "") {
    console.warn("Bot submission detected via honeypot");
    return { statusCode: 200, body: "Skipping bot submission" };
  }
  
  let requiredFields = ["email", "name"];

  if (form_name === "contact") {
    requiredFields.push("message");
  }

  // Check for missing or empty fields
  for (const field of requiredFields) {
    if (!data[field] || data[field].trim() === "") {
      console.warn(`Form submission missing required field: ${field}`, {
        submittedData: Object.keys(data),
        timestamp: new Date().toISOString()
      });
      return { 
        statusCode: 200, 
        body: `Skipping email send: missing ${field}` 
      };
    }
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email.trim())) {
    console.warn(`Invalid email format: ${data.email}`);
    return {
      statusCode: 200,
      body: "Skipping email send: invalid email format"
    };
  }

  if (!process.env.NETLIFY_EMAILS_SECRET) {
    console.error("NETLIFY_EMAILS_SECRET not configured");
    return { statusCode: 500, body: "Email service not configured" };
  }

  if (!process.env.NETLIFY_EMAILS_MAILGUN_DOMAIN) {
    console.error("NETLIFY_EMAILS_MAILGUN_DOMAIN not configured");
    return { statusCode: 500, body: "Email service not configured" };
  }

  if (!process.env.URL) {
    console.error("URL environment variable not configured");
    return { statusCode: 500, body: "Email service not configured" };
  }

  // Strip HTML tags and sanitize name to prevent injection
  const safeName = data.name.replace(/<[^>]*>/g, "").trim();
  
  // Additional sanitization: limit length
  const maxNameLength = 100;
  const truncatedName = safeName.substring(0, maxNameLength);

  const templateName = EMAIL_TEMPLATE_BY_FORM[knownFormName];
  const subject = EMAIL_SUBJECT_BY_FORM[knownFormName];
  const siteUrl = process.env.URL.replace(/\/$/, '');
  const parameters: EmailTemplateParameters = {
    name: truncatedName,
    currentYear: new Date().getFullYear(),
  };

  if (knownFormName === 'tour-booking') {
    const links = getTourCalendarLinks(data, siteUrl, truncatedName);
    parameters.googleCalendarUrl = links.googleCalendarUrl;
    parameters.icsCalendarUrl = links.icsCalendarUrl;
  }

  try {
    const response = await fetch(
      `${process.env.URL}/.netlify/functions/emails/${templateName}`,
      {
        headers: {
          "netlify-emails-secret": process.env.NETLIFY_EMAILS_SECRET,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          from: `noreply@${process.env.NETLIFY_EMAILS_MAILGUN_DOMAIN}`,
          to: data.email.trim(),
          subject,
          parameters,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Email send failed:", response.status, errorText);
      return { 
        statusCode: 500, 
        body: "Failed to send confirmation email" 
      };
    }

    console.log(`Confirmation email sent successfully to: ${data.email}`);
    return { statusCode: 200, body: "'Message received' email sent!" };
  } catch (error) {
    console.error("Error sending email:", error);
    return { 
      statusCode: 500, 
      body: "Failed to send confirmation email" 
    };
  }
};

export { handler };