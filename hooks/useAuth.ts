/**
 * Authentication Hook - Optional Account Connection
 *
 * Wraps the PocketBase auth store in a Zustand store so any component can read
 * the current account without prop drilling. Everything here is optional by
 * design: BIT Focus runs entirely on-device until someone connects an account,
 * and signing out returns it to exactly that state.
 *
 * Sign-in is OAuth2 popup based. The provider list is fetched from the backend
 * rather than hardcoded, so enabling Discord or GitHub in the PocketBase admin
 * makes the button appear here with no code change.
 *
 * Sessions are kept alive in the background. A PocketBase token expires a fixed
 * time after it was issued unless it is refreshed, so the store refreshes it on
 * startup, hourly while the app is open, and whenever the app comes back into
 * view or back online.
 *
 * @fileoverview Account connection state and OAuth2 sign-in actions.
 * @author BIT Focus Development Team
 * @since v0.19.0
 * @updated v0.24.4-beta - Background session refresh.
 */

import { create } from "zustand";
import {
  pb,
  USERS_COLLECTION,
  SUPPORTED_PROVIDERS,
  type AuthUser,
  type ProviderName,
} from "@/lib/pocketbase";
import { REFRESH_CHECK_MS, isRefreshDue } from "@/lib/auth-session";

/** A provider the backend has configured and is ready to authenticate with. */
export interface AvailableProvider {
  /** Provider slug, e.g. `google`. */
  name: string;
  /** Provider-supplied display name, e.g. `Google`. */
  displayName: string;
}

interface AuthState {
  /** Currently connected account, or null when running local-only. */
  user: AuthUser | null;
  /** True once the initial auth check has settled. */
  ready: boolean;
  /** True while a sign-in round trip is in flight. */
  signingIn: boolean;
  /** Provider slug currently being authenticated, for per-button spinners. */
  pendingProvider: string | null;
  /** Providers enabled on the backend, ordered for display. */
  providers: AvailableProvider[];
  /** True while the provider list is being fetched. */
  loadingProviders: boolean;
  /** Last sign-in error, surfaced next to the provider buttons. */
  error: string | null;

  /** Restore and validate any persisted session. Safe to call repeatedly. */
  init: () => Promise<void>;
  /** Fetch the provider list from the backend. */
  loadProviders: () => Promise<void>;
  /** Open the provider popup and connect an account. Resolves to success. */
  signIn: (provider: ProviderName | string) => Promise<boolean>;
  /** Disconnect the account on this device. Local data is left untouched. */
  signOut: () => void;
  /** Permanently delete the account and its cloud snapshot. */
  deleteAccount: () => Promise<void>;
  /** Clear the current error message. */
  clearError: () => void;
}

/**
 * Order providers the way the app presents them, keeping any extra provider
 * the backend enables later at the end of the list rather than dropping it.
 */
function orderProviders(providers: AvailableProvider[]): AvailableProvider[] {
  const rank = (name: string) => {
    const i = SUPPORTED_PROVIDERS.indexOf(name as ProviderName);
    return i === -1 ? SUPPORTED_PROVIDERS.length : i;
  };
  return [...providers].sort((a, b) => rank(a.name) - rank(b.name));
}

/**
 * Guards the startup auth check.
 *
 * `init` is called from a component effect, so React's development double-mount
 * would otherwise fire two identical `authRefresh` requests. The second one
 * aborts the first, and an aborted refresh used to read as a dead session —
 * which signed the user out on every reload.
 */
let initPromise: Promise<void> | null = null;

/** In-flight refresh, shared so overlapping triggers send one request. */
let refreshPromise: Promise<void> | null = null;

/**
 * The token this device last saw issued, and when.
 *
 * A token restored from storage starts at 0 so it counts as due: its real
 * issue time is unknown, and it may be close to expiring.
 */
let issuedToken = "";
let issuedAt = 0;

/** Note a newly issued token (sign-in, refresh, or another tab's refresh). */
function noteToken(): void {
  const token = pb.authStore.token;
  if (token === issuedToken) return;
  issuedToken = token;
  issuedAt = token ? Date.now() : 0;
}

/**
 * Whether a failed refresh means the session is genuinely gone.
 *
 * Only the server rejecting the token counts. Aborts, offline errors, and
 * server faults are transient: the cached session stays, because throwing away
 * a valid token over a blip is far worse than trusting it a little longer.
 *
 * @param error - Whatever `authRefresh` threw.
 */
function isSessionRejected(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { status, isAbort } = error as { status?: number; isAbort?: boolean };
  if (isAbort) return false;
  return status === 401 || status === 403 || status === 404;
}

/** Narrow an unknown throwable into a message worth showing a person. */
function messageFor(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    // PocketBase surfaces a popup-blocked failure with this exact wording.
    if (/popup|window/i.test(error.message)) {
      return "The sign-in window was blocked. Allow popups for this site and try again.";
    }
    return error.message;
  }
  return fallback;
}

/**
 * Refresh the stored session, renewing its lifetime.
 *
 * Signs out only when the server rejects the token. Any other failure keeps
 * the session and leaves it due, so the next check tries again.
 *
 * @param set - Store setter, to publish the refreshed account.
 */
function refreshSession(set: (patch: Partial<AuthState>) => void): Promise<void> {
  if (refreshPromise) return refreshPromise;
  if (!pb.authStore.token) return Promise.resolve();

  refreshPromise = (async () => {
    const token = pb.authStore.token;
    try {
      // `requestKey: null` opts this request out of deduplication so a
      // concurrent caller cannot abort it.
      const result = await pb
        .collection(USERS_COLLECTION)
        .authRefresh({ requestKey: null });
      issuedToken = pb.authStore.token;
      issuedAt = Date.now();
      set({ user: result.record as AuthUser });
    } catch (error) {
      // Signed out, or signed in again in another tab, while this was in
      // flight: the answer is about a token that is no longer in use.
      if (pb.authStore.token !== token) return;
      if (isSessionRejected(error)) {
        pb.authStore.clear();
        set({ user: null });
      }
      // Offline, aborted, or the server is unwell — keep the cached account.
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Refresh the session whenever it is due while the app is open.
 *
 * The interval covers a tab left open. Visibility and connectivity cover a
 * device waking from sleep, when throttled background timers may not have run.
 *
 * @param refresh - Starts a refresh.
 */
function keepSessionAlive(refresh: () => void): void {
  const check = () => {
    if (isRefreshDue(pb.authStore.token, issuedAt, Date.now())) refresh();
  };
  window.setInterval(check, REFRESH_CHECK_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
  window.addEventListener("online", check);
}

export const useAuth = create<AuthState>((set, get) => ({
  // Always signed-out until `init` runs after mount: PocketBase restores its
  // session from localStorage as soon as it loads in the browser, which the
  // server cannot see, so reading it here would make the first client render
  // differ from the server-rendered HTML.
  user: null,
  ready: false,
  signingIn: false,
  pendingProvider: null,
  providers: [],
  loadingProviders: false,
  error: null,

  init: async () => {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      // Mirror every future auth store change into React state.
      pb.authStore.onChange(() => {
        noteToken();
        set({ user: (pb.authStore.record as AuthUser | null) ?? null });
      }, false);

      issuedToken = pb.authStore.token;
      keepSessionAlive(() => void refreshSession(set));

      // Only a missing token means signed out. A token this device's clock
      // calls expired still goes to the server: the clock may be wrong, and
      // only the server can say the session is over.
      if (!pb.authStore.token) {
        set({ user: null, ready: true });
        return;
      }

      // Trust the stored session immediately. The refresh below only ever
      // confirms or revokes it, and the app should not flicker through a
      // signed-out state while that round trip is in flight.
      set({ user: (pb.authStore.record as AuthUser | null) ?? null, ready: true });

      // Renew the session's lifetime and catch a revoked or deleted account.
      await refreshSession(set);
    })();

    return initPromise;
  },

  loadProviders: async () => {
    set({ loadingProviders: true });
    try {
      const methods = await pb.collection(USERS_COLLECTION).listAuthMethods();
      const list = (methods.oauth2?.providers ?? []).map((p) => ({
        name: p.name,
        displayName: p.displayName || p.name,
      }));
      set({ providers: orderProviders(list), loadingProviders: false });
    } catch {
      set({ providers: [], loadingProviders: false });
    }
  },

  signIn: async (provider) => {
    set({ signingIn: true, pendingProvider: provider, error: null });
    try {
      const result = await pb
        .collection(USERS_COLLECTION)
        .authWithOAuth2({ provider });

      const record = result.record as AuthUser;

      // Record which provider was used and backfill the picture on first
      // connect. The provider is informational — it drives the badge shown in
      // the account UI so a returning user knows which button to press.
      const patch: Record<string, string> = {};
      if (record.provider !== provider) patch.provider = provider;
      const avatar = result.meta?.avatarURL as string | undefined;
      if (avatar && !record.avatarUrl) patch.avatarUrl = avatar;
      const name = result.meta?.name as string | undefined;
      if (name && !record.name) patch.name = name;

      if (Object.keys(patch).length > 0) {
        try {
          const updated = await pb
            .collection(USERS_COLLECTION)
            .update(record.id, patch);
          set({ user: updated as AuthUser });
        } catch {
          // Non-fatal: the session is valid either way.
          set({ user: record });
        }
      } else {
        set({ user: record });
      }

      set({ signingIn: false, pendingProvider: null });
      return true;
    } catch (error) {
      set({
        signingIn: false,
        pendingProvider: null,
        error: messageFor(error, "Could not complete sign-in. Try again."),
      });
      return false;
    }
  },

  signOut: () => {
    pb.authStore.clear();
    set({ user: null, error: null });
  },

  deleteAccount: async () => {
    const user = get().user;
    if (!user) return;
    // The snapshot relation cascades, so deleting the account removes the
    // cloud copy of the data with it.
    await pb.collection(USERS_COLLECTION).delete(user.id);
    pb.authStore.clear();
    set({ user: null });
  },

  clearError: () => set({ error: null }),
}));
