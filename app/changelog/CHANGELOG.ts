export const VERSION = "v0.2.3-alpha";

const CHANGELOG = `

## \`v0.2.0-alpha\` (2025-03-29)
### Added
- Added Favicon.
- Added Focus Summary on Home page.
- Added & Removed Notes feature, \`useNotes\` hook is still available.
### Changed
- Y-Axis in Graph shows Formatted Time instead of minutes.
- Formatted Time now shoes only non-zero values. (2m instead of 2m 0s)
- Returns 0s if time is less than 1 second.
### \`v0.2.1-alpha\` (2025-03-30)
- Added version number to sidebar footer.
- Added Skeletons in Home focus summary stats.
- Added Focus Mode in Sidebar Timer.
### \`v0.2.2-alpha\` (2025-04-07)
- Added page's title showing elapsed time.
- Fixed Toaster's time upon session end.
### \`v0.2.3-alpha\` (2025-04-07)
- Fixed Focus Mode's unnecessary updates that caused crashes.
- Diversified \`stringToHexColor()\` function to return more diversified colors.
- Fixed Graph showing Tags that do not have focused time the visible range.
***

## \`v0.1.0-alpha\` (2025-03-25)
### Fixed
- Fixed timer desyncing due to use of setInterval.
- Fixed the issue of the time being off by 1 second.
- Fixed age calculation logic.
### Added
- Added /changelog page.
- Added \`react-markdown\`.

`;

export default CHANGELOG;
