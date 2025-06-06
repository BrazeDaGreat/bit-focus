export const VERSION = "v0.6.1-alpha";

const CHANGELOG = `
## \`v0.6.0-alpha\` (2025-05-30)
### Added
- Added \`SaveManager.ts\`.
- Added Import/Export functionality. The data is exported in a \`.bitf.json\` file extension.
### \`v0.6.1-alpha\`
- Bumped \`package.json\` version.
- Shifted to \`pnpm\`.
- Added a Todo button in top bar.
- Thus, added a simple functioning todo list, to keep track of tasks while you're focusing.
***

## \`v0.5.0-alpha\` (2025-05-28)
### Added
- Mini PIP Player for timer.
- \`usePip()\` hook.
- \`usePipSpace()\` hook.
- \`PipTimer\` component for the mini window.
### \`v0.5.1-alpha\` (2025-05-28)
- Graph's Table shows saved tag color now.
***

## \`v0.4.0-alpha\` (2025-05-25)
### Added
- Implemented Saved Tags.
### Fixed
- Fixed border lines in Details graph.
- Fixed the Homepage time being in days instead of hours.
### \`v0.4.1-alpha\` (2025-05-25)
- Tag creation popup automatically closes after creating now.
### \`v0.4.2-alpha\` (2025-05-26)
- The correct tag color shows up in Graph now.
- The graph entires are now low-to-high, more pleasant to look at.

***

## \`v0.3.0-alpha\` (2025-05-18)
### Added
- \`calculateTime()\` function as a standard time difference calculator.
- \`formatTimeNew()\` that is compatible with \`TimeObject\`.
- \`durationFromSeconds()\` as helper function.
- \`reduceSessions()\` which reduces \`FocusSession[]\` into a \`TimeObject\` equivalent.
- Added 30 Days view in Detailed Graph, and Home Screen.
- Removed "Tasks" option from sidebar.
### Changed
- You need to focus for at least 1 minute before it being counted.
### Fixed
- Fixed Focus Time not being counted when you are paused.
- Fixed issues related to differences in time calculation in different parts.

### \`v0.3.1-alpha\` (2025-05-21)
- Added Discord & GitHub buttons to TopBar.

### \`v0.3.2-alpha\` (2025-05-24)
- Added Discord Webhook support.
- Sends a webhook call whenever timer starts/finishes.

### \`v0.3.3-alpha\` (2025-05-24)
- The document's title now shows live timer time, even when tab is inactive.

### \`v0.3.4-alpha\` (2025-05-24)
- Added Theming support.
- Also added Purple, Rose, and Amoled themes.

### \`v0.3.5-alpha\` (2025-05-24)
- Removed previous themes in favor of Amethyst and Blue Night.
- Updated AMOLED color.
***

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
### \`v0.2.4-alpha\` (2025-04-15)
- Added a Focus Summary table in Details view.
### \`v0.2.5-alpha\` (2025-04-22)
- Focus Summary now shows items in ascending order.
### \`v0.2.6-alpha\` (2025-05-11)
- Made the Detailed View scrollable, fixing issues with long Focus Summary tables.
- Fixed Focus Mode tag hovering issues.
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
