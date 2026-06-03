import type { Handler } from "@netlify/functions";

interface NetlifySubmissionPayload {
  payload: {
    data: Record<string, string>;
    form_name: string;
  };
}

type KnownFormName = 'tour-booking' | 'contact';

const EMAIL_TEMPLATE_BY_FORM: Record<KnownFormName, string> = {
  contact: 'message-received',
  'tour-booking': 'tour-booked',
};

const EMAIL_SUBJECT_BY_FORM: Record<KnownFormName, string> = {
  contact: 'We received your message',
  'tour-booking': 'Your Lower Notley Hall Farm tour was booked',
};

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
          parameters: {
            name: truncatedName,
          },
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