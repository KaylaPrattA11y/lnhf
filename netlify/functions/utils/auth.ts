import type { HandlerEvent, HandlerContext } from '@netlify/functions';

/**
 * Returns true if the request carries a valid Netlify Identity JWT.
 *
 * Tries the pre-decoded clientContext first (fast path — Netlify injects this
 * when Identity is active and the token is not expired), then falls back to
 * calling the Identity /user endpoint directly.  The fallback handles two
 * common failure modes:
 *   1. The runtime no longer auto-injects clientContext (newer Netlify infra).
 *   2. The token just expired and Netlify declined to inject clientContext, but
 *      the Identity service itself can still give a clearer 401 so the client
 *      knows to refresh.
 */
export async function isAuthenticated(
  event: HandlerEvent,
  context: HandlerContext,
): Promise<boolean> {
  // Fast path: Netlify injects the decoded user when Identity is active
  const { clientContext } = context as { clientContext?: { user?: unknown } };
  if (clientContext?.user) return true;

  // Fallback: verify the Bearer token via the Netlify Identity API
  const rawAuth = event.headers?.authorization ?? '';
  const token = rawAuth.startsWith('Bearer ') ? rawAuth.slice(7) : '';
  if (!token) return false;

  try {
    // process.env.URL is set by Netlify to the site's primary URL
    const siteUrl = (process.env.URL ?? '').replace(/\/$/, '');
    if (!siteUrl) return false;
    const res = await fetch(`${siteUrl}/.netlify/identity/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
