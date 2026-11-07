/**
 * Auth Session Timing - When To Renew The Account Token
 *
 * PocketBase sessions are JWTs with a fixed lifetime set on the server. A
 * token only gets a new lifetime when it is refreshed, so a session that is
 * never refreshed expires on schedule no matter how often the app is used.
 * These helpers decide when a refresh is due; the auth store does the rest.
 *
 * Kept free of the SDK and the DOM so the timing rules can be tested directly.
 *
 * @fileoverview Token expiry decoding and refresh scheduling rules.
 * @author BIT Focus Development Team
 * @since v0.24.4-beta
 */

/**
 * How often an open app renews its session.
 *
 * Far shorter than any sensible token lifetime, so a device that is used at
 * least once per lifetime never sees its session lapse.
 */
export const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

/** How often an open app checks whether a refresh is due. */
export const REFRESH_CHECK_MS = 5 * 60 * 1000;

/**
 * Read a token's expiry time.
 *
 * Decoding only; the signature is the server's business.
 *
 * @param token - Raw JWT, or an empty string when signed out.
 * @returns Expiry in epoch milliseconds, or null when the token has none.
 */
export function tokenExpiresAt(token: string): number | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Whether the session should be refreshed now.
 *
 * Due once an interval has passed since the token was issued, or sooner when
 * the token is close to expiring (a server configured with a very short
 * lifetime still gets renewed in time).
 *
 * @param token - Current raw JWT.
 * @param issuedAt - When this device received the token, in epoch ms.
 * @param now - Current time in epoch ms.
 */
export function isRefreshDue(token: string, issuedAt: number, now: number): boolean {
  if (!token) return false;
  if (now - issuedAt >= REFRESH_INTERVAL_MS) return true;
  const expiresAt = tokenExpiresAt(token);
  if (expiresAt === null) return false;
  // Renew within the last fifth of the remaining window, measured from issue.
  const margin = Math.min(REFRESH_INTERVAL_MS, (expiresAt - issuedAt) / 5);
  return expiresAt - now <= margin;
}
