/**
 * PocketBase Client - Shared Backend Connection
 *
 * BIT Focus is local-first: every feature works with no account at all. When a
 * user *chooses* to connect an account, this module is the single door to the
 * backend that makes their data follow them between devices.
 *
 * The backend is a PocketBase instance shared across BrazeApps. The `users`
 * auth collection is deliberately unified — one identity for every app — while
 * everything belonging to this app is namespaced with a `focus_` prefix.
 *
 * Authentication is OAuth2-only (Google, Discord, GitHub). There is no
 * email/password path: the `users` collection has password auth disabled
 * server-side, so the only way in is a provider the user already trusts.
 *
 * @fileoverview PocketBase singleton, collection names, and shared auth types.
 * @author BIT Focus Development Team
 * @since v0.19.0
 */

import PocketBase, { type RecordModel } from "pocketbase";

/**
 * Backend origin. Overridable per-environment; falls back to the shared
 * BrazeApps instance so a checkout with no `.env` still works.
 */
export const POCKETBASE_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://brazeapps-db.uziraze.com";

/** Unified identity collection, shared with other BrazeApps products. */
export const USERS_COLLECTION = "users";

/**
 * Legacy snapshot collection. One record per user, holding the entire database
 * as a single JSON blob.
 *
 * Superseded by {@link RECORDS_COLLECTION} in v0.21.0 and read only during the
 * one-time migration. Whole-database snapshots could not merge — two devices
 * that both changed anything produced a choice between two versions, and
 * whichever one lost took real data with it.
 */
export const SYNC_COLLECTION = "focus_sync";

/**
 * This app's per-record sync collection. One row per entity, per user.
 *
 * Each record carries its collection, its stable uid, its payload and a hybrid
 * logical clock stamp. Because the unit of sync is a row rather than the whole
 * database, two devices editing different things merge instead of colliding.
 */
export const RECORDS_COLLECTION = "focus_records";

/**
 * localStorage key the PocketBase SDK uses for its auth store.
 *
 * Exported because our own import/restore paths must never clear it — wiping
 * it mid-restore would sign the user out of the very account they are
 * restoring from.
 */
export const PB_AUTH_STORAGE_KEY = "pocketbase_auth";

/** Singleton client. Recreated per module load; safe on the server (no window). */
export const pb = new PocketBase(POCKETBASE_URL);

// The SDK auto-cancels duplicate in-flight requests to the same endpoint. Sync
// legitimately fires overlapping reads and writes, so opt out globally and
// handle races ourselves in the sync engine.
pb.autoCancellation(false);

/**
 * Authenticated User Record
 *
 * The subset of the shared `users` collection this app reads. Providers give us
 * a name, an email, and a picture — that is all BIT Focus asks for.
 */
export interface AuthUser extends RecordModel {
  /** Display name, mapped from the OAuth2 provider profile. */
  name: string;
  /** Primary email address from the provider. */
  email: string;
  /** Provider-hosted profile picture URL. */
  avatarUrl: string;
  /** Slug of the provider used most recently (e.g. `google`). */
  provider: string;
}

/** OAuth2 providers this app renders sign-in buttons for, in display order. */
export const SUPPORTED_PROVIDERS = ["google", "discord", "github"] as const;

export type ProviderName = (typeof SUPPORTED_PROVIDERS)[number];

/** Human-readable provider names for UI copy. */
export const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  discord: "Discord",
  github: "GitHub",
};

/**
 * Resolve Avatar URL
 *
 * Prefers the provider picture stored on the record. Falls back to the same
 * DiceBear mark the app already uses for local-only profiles, so an account
 * without a picture still gets a consistent avatar rather than a blank circle.
 *
 * @param user - Authenticated user record, or null when signed out.
 * @param fallbackSeed - Seed used for the generated fallback avatar.
 * @returns A URL suitable for an `<img src>`.
 */
export function resolveAvatarUrl(
  user: AuthUser | null,
  fallbackSeed: string,
): string {
  if (user?.avatarUrl) return user.avatarUrl;
  const seed = user?.name || user?.email || fallbackSeed || "bit-focus";
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(seed)}`;
}
