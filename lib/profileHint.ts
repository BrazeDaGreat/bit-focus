/**
 * Profile Hint - Lets the server render the app frame for returning users
 *
 * The real "does this person have a profile" answer lives in IndexedDB, which
 * only the browser can read, and only after JavaScript has loaded. Waiting for
 * that answer before rendering anything meant the whole page — including the
 * largest heading — sat behind a splash screen until hydration and the
 * database read had both finished.
 *
 * Instead the app frame is always part of the server-rendered HTML, and a
 * one-line localStorage flag written after a successful boot tells a tiny
 * inline script (run before first paint) whether to cover that frame with the
 * boot splash. Returning users see their page at once; first-time visitors and
 * anyone without the flag see the same splash as before, until the real answer
 * arrives. The flag is only a hint: the IndexedDB record still decides.
 *
 * @fileoverview Shared key and pre-paint script for the profile hint.
 * @author BIT Focus Development Team
 * @since v0.23.1
 */

/** localStorage key holding "1" once a profile has been seen on this device */
export const PROFILE_HINT_KEY = "bitf.profile";

/**
 * Inline script for `<head>`: marks the document `data-profile="ready"` when
 * the hint is present and `"none"` otherwise. CSS keys the boot overlay off it.
 */
export const PROFILE_HINT_SCRIPT = `(function(){var v="none";try{if(localStorage.getItem(${JSON.stringify(
  PROFILE_HINT_KEY
)})==="1")v="ready"}catch(e){}document.documentElement.setAttribute("data-profile",v)})()`;

/** Remember (or forget) that this device has a profile. */
export function writeProfileHint(hasProfile: boolean): void {
  try {
    if (hasProfile) localStorage.setItem(PROFILE_HINT_KEY, "1");
    else localStorage.removeItem(PROFILE_HINT_KEY);
  } catch {
    // Storage can be unavailable (private mode); the splash simply always shows.
  }
}
