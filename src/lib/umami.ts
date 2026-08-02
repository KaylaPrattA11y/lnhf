// Reference: https://docs.umami.is/docs/guides/identify-logged-in-users

// Generate / retrieve a persistent visitor ID
export function getVisitorId() {
  let id = localStorage.getItem('umami-visitor-id');
  if (!id) {
    id = crypto.randomUUID(); // or any unique string ≤ 50 characters
    localStorage.setItem('umami-visitor-id', id);
  }
  return id;
}

// Wait for the tracker, then identify
export function identifyVisitor() {
  const visitorId = getVisitorId();
  if (window.umami) {
    umami.identify({ id: visitorId });
    // Optional: add extra session data
    // umami.identify({ id: visitorId, source: 'homepage' });
  } else {
    // Retry briefly if the script has not loaded yet
    setTimeout(identifyVisitor, 100);
  }
}