const CHANGELOG = `

## \`v0.2.0-alpha\` (2025-03-30)
### Added
- Added Favicon.
- Added Focus Summary on Home page.
- Added & Removed Notes feature, \`useNotes\` hook is still available.
### Changed
- Y-Axis in Graph shows Formatted Time instead of minutes.
- Formatted Time now shoes only non-zero values. (2m instead of 2m 0s)
- Returns 0s if time is less than 1 second.
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
