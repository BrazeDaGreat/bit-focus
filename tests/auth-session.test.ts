import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REFRESH_INTERVAL_MS,
  isRefreshDue,
  tokenExpiresAt,
} from "../lib/auth-session";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Build an unsigned JWT-shaped token expiring at `expMs`. */
function tokenExpiring(expMs: number): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode({ exp: Math.floor(expMs / 1000) })}.sig`;
}

test("tokenExpiresAt reads the exp claim in milliseconds", () => {
  const exp = Date.UTC(2026, 10, 14, 12, 0, 0);
  assert.equal(tokenExpiresAt(tokenExpiring(exp)), exp);
});

test("tokenExpiresAt returns null for empty or malformed tokens", () => {
  assert.equal(tokenExpiresAt(""), null);
  assert.equal(tokenExpiresAt("not-a-token"), null);
  assert.equal(tokenExpiresAt("a.%%%.c"), null);
});

test("a restored token with unknown issue time is due at once", () => {
  const now = Date.now();
  assert.equal(isRefreshDue(tokenExpiring(now + 7 * DAY), 0, now), true);
});

test("a fresh token is not due until the interval passes", () => {
  const issued = Date.now();
  const token = tokenExpiring(issued + 7 * DAY);
  assert.equal(isRefreshDue(token, issued, issued + 10 * 60 * 1000), false);
  assert.equal(isRefreshDue(token, issued, issued + REFRESH_INTERVAL_MS), true);
});

test("a short-lived token is renewed before it expires", () => {
  const issued = Date.now();
  const token = tokenExpiring(issued + 30 * 60 * 1000);
  assert.equal(isRefreshDue(token, issued, issued + 10 * 60 * 1000), false);
  assert.equal(isRefreshDue(token, issued, issued + 25 * 60 * 1000), true);
});

test("no token is never due", () => {
  assert.equal(isRefreshDue("", 0, Date.now()), false);
});
