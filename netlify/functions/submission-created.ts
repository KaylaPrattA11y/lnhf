import { handler as formSubmittedHandler } from './form-submitted';

// Netlify invokes this function automatically for form submissions.
export const handler = formSubmittedHandler;
