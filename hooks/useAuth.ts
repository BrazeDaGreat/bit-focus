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
 * @fileoverview Account connection state and OAuth2 sign-in actions.
 * @author BIT Focus Development Team
 * @since v0.19.0
 */

import { create } from "zustand";
import {
  pb,
  USERS_COLLECTION,
  SUPPORTED_PROVIDERS,
  type AuthUser,
  type ProviderName,
} from "@/lib/pocketbase";

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

export const useAuth = create<AuthState>((set, get) => ({
  user: (pb.authStore.record as AuthUser | null) ?? null,
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
        set({ user: (pb.authStore.record as AuthUser | null) ?? null });
      }, false);

      if (!pb.authStore.isValid) {
        set({ user: null, ready: true });
        return;
      }

      // Trust the stored session immediately. The refresh below only ever
      // confirms or revokes it, and the app should not flicker through a
      // signed-out state while that round trip is in flight.
      const cached = (pb.authStore.record as AuthUser | null) ?? null;
      set({ user: cached, ready: true });

      try {
        // Catch a revoked or deleted account. `requestKey: null` opts this
        // request out of deduplication so a concurrent caller cannot abort it.
        const result = await pb
          .collection(USERS_COLLECTION)
          .authRefresh({ requestKey: null });
        set({ user: result.record as AuthUser });
      } catch (error) {
        if (isSessionRejected(error)) {
          pb.authStore.clear();
          set({ user: null });
          return;
        }
        // Offline, aborted, or the server is unwell — keep the session and
        // carry on with the cached account.
        set({ user: cached });
      }
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
