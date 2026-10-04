/**
 * Current app version.
 *
 * Kept apart from the changelog text on purpose: the shell, the sidebar and the
 * webhook code all need the version number, and importing it from
 * `CHANGELOG.ts` dragged the entire release-notes string into the JavaScript
 * every page downloads. Bump it here when cutting a release.
 */
export const VERSION = "v0.23.1-beta";
