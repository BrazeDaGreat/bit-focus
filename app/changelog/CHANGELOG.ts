export const VERSION = "v0.15.4 (LTS)";

const CHANGELOG = `
## \`v0.15.0-beta\` (2026-02-01)
- Fix: "Edit Focus Session" now respects start time.
- Add: Calendar Page, this showcases a rough estimate of where you spent your time, in a calendar view.
### \`v0.15.1-beta\` (2026-02-01)
- Fix: Calendar Page UI and styling.
- Improve: Calendar steps are now 30 minutes.
### \`v0.15.2 (LTS)\` (2026-02-01)
- Fix: Deployment Issues
### \`v0.15.3-beta\` (2026-02-01)
- Add: Clicking on Focus Item from Calendar opens it's Edit Modal.
- Add: Separate EditFocusSessionDialog component.
### \`v0.15.4 (LTS)\` (2026-02-01)
- Fix: Calendar Overlapping items
- Fix: Vertical Lines too bright on Calendar's dark mode
***

## \`v0.14.0-beta\` (2026-01-09)
- Add: Focus Activity Heatmap on Home page with GitHub-style year view, navigation, dynamic intensity, and streak tracking.
- Improve: Tag selector now supports pressing Enter to save tag (no need to click Save button).
### \`v0.14.1-beta\` (2026-01-09)
- Add: Amethyst Overloaded Theme.
- Add: "Upload" button in BITF Data popup, which uploads directly to Discord Webhook.
### \`v0.14.2\` (2026-01-09)
- Add: Better handling for BITF Data upload.
### \`v0.14.3\` (2026-01-29)
- Add: Sound when Pomodoro/break ends.
### \`v0.14.4\` (2026-01-30)
- Improve: Notification sound is now louder, longer, and uses a repeating bell chime pattern for better audibility.
- Fix: Floating Notepad is now responsive for Mobile, now takes up the entire screen (suitable for smalelr screens).
### \`v0.14.5 (LTS)\` (2026-01-30)
- Add: YouTube Player in Focus page.
- This youtube player automatically stops when the sound is to be played, and resumes afterwards.
- It also stores the YouTube video ID in localStorage.
***

## \`v0.13.0-beta\` (2025-10-11)
- Remove: Sidebar Notepad
- Add: Floating Notepad, accessible from the new Notepad button in Top Bar.
### \`v0.13.1-beta\` (2025-10-11)
- Add: Quick Message button in Top Bar, to quickly send a Discord webhook message.
- Add: \`lib/quickMessages.ts\` that contains predefined messages.
- Improve: Projects page now shows Quick Links instead of Progress.
### \`v0.13.2 (LTS)\` (2025-10-11)
- Add: Yearly view in Focus Graph.
### \`v0.13.3-beta\` (2026-01-08)
- Fixed: Buggy PIP window style in Pomodoro mode.
- Fixed: Cleaned up PIP UI (removed progress bar and settings in Pomo mode).
- Fixed: Added dynamic window sizing for PIP (Standard: 220x130, Pomodoro: 280x170).
- Fixed: Dashboard focus cards not loading data on initial visit.
### \`v0.13.4-beta\` (2026-01-08)
- Improve: Focus Graph and its popup now fully follow the system theme.
- Fixed: Hardcoded light theme colors in Graph tooltips.
- Add: Rolling "12 Months" and "3 Years" views in Focus Graph.
- Improve: Reorganized and standardized Graph view selection buttons.
### \`v0.13.5-beta\` (2026-01-08)
- Add: Daily Average calculation in Focus Graph data table.
- Add: "Productive Days Only" option for accurate daily average calculation.
- Fixed: Inflated average calculations in aggregated views (Months/Years).
- Fixed: "focusSessions is not defined" error in Graph popup.
### \`v0.13.6-beta\` (2026-01-08)
- Security: Updated Next.js to v15.2.8.
***

## \`v0.12.0-beta\` (2025-09-12)
- New "Pomodoro Mode".
### \`v0.12.1-beta\` (2025-09-12)
- Improvements to new Pomodoro mode.
- Improved Pomodoro design to be consistent with website.
### \`v0.12.2\` (2025-09-12)
- Fixed: Pomodoro time not being counted.
- Fixed: Pomodoro implementation causing persistent issues.
- Fixed: Focus Reports are not being loaded properly.
- Fixed: Break-mode design.
- Fixed: Changing Pomodoro mode broke timer.
### \`v0.12.3 (LTS)\` (2025-09-12)
- Fixed: Document Title not updating with time.
***

## \`v0.11.0-beta\` (2025-08-11)
- New "Rewards" System.
- Each focus minute gives you 1 reward point, shown in TopBar.
- You can spend these in the new Rewards page.
- Inclusion of a Discount System for Rewards.
- Custom-items on Rewards.
- Features to Throw Away/Take Loan for Reward Points.
Note: This feature is not practical, it's just meant to game-ify your daily todos, and maybe just give you a push, have fun.
- New \`useRewards\` hook.
- DB Version 6.
- New \`rewards/page.tsx\` page.
### \`v0.11.1-beta\` (2025-08-12)
- Fixed: Removed Destructive Text from Delete buttons.
- Changed: BITF Data moved into a separate \`components/BITFdata.tsx\`.
- Changed: BITF Data button was moved from \`/focus\` page to \`TopBar.tsx\`.
- Changed: Changed EMOJI_OPTIONS being icons, more in-line with the App's design system.
### \`v0.11.2 (LTS)\` (2025-08-12)
- Fixed: Improved navigation speed on \`projects/page.tsx\` and \`projects/[id]/page.tsx\`.
- Fixed: Fixed missing Quick Links-related errors, adding support for older \`.bitf.json\` files (pre-\`v0.10.0-beta\`).
### \`v0.11.3-beta\` (2025-08-15)
- Fixed: Icon not showing at "Confirm Purchase" Popup.
### \`v0.11.4-beta\` (2025-09-05)
- Added: Notion icon support in Quick Links.
***
## \`v0.10.0-beta\` (2025-07-28)
### Added
- New pastel themes (\`pastel-blue\`, \`pastel-orange\`, and \`pastel-purple\`)
- New Home page design.
- "Overdue" Issues are now shown on Home page.
- Responsivity of Focus page.
- Responsivity of Projects and individual Project page.
### Fixed
- Fixed Home page's skeleton issues.
- Fixed Projects page's skeleton issues.
### \`v0.10.1-beta\` (2025-07-29)
- New: Notepad component in App Sidebar, \`useNotepad()\` hook.
- New: \`<KeyboardKey />\` UI component.
### \`v0.10.2 (LTS)\` (2025-07-29)
- Fixed: Transparent Toaster issues.
- New: Quick Links feature in Projects page.
- New: \`getIconFromLink()\` function.
### \`v0.10.3-beta\` (2025-08-15)
- Fixed: "Confirm Purchase" popup not showing icon.
***
## \`v0.9.0-alpha\` (2025-07-15)
### Added
- BIT-Focus: Projects. Core project management functionality.
- StatusBadge component.
- Changes to Database, etc.
### \`v0.9.1-alpha\` (2025-07-15)
- Fixed the issue where the total budget was not being displayed correctly.
- Tweaked the Projects UI.
- Added markdown support for project notes.
### \`v0.9.2-alpha\` (2025-07-15)
- Removed \`useTask.ts\` hook.
- Removed \`QuickTaskAdd.tsx\` component.
- Removed \`TaskView.tsx\` component.
### \`v0.9.3-alpha\` (2025-07-15)
- A closed milestone is now counted as 100% progress.
- Issues can now be edited.
- Milestones can now be edited.
### \`v0.9.4-alpha\` (2025-07-17)
- Fixed: The page re-renders upon any state change.
- Fixed: Edit Milestone dialog box doesn't stay open.
- Fixed: Webhook Label points to the name field.
- Fixed: Edit Issue crashes the website.
- Refactor: Milestones appear in a grid now.
- Refactor: Currency symbol replaces hardcoded Dollar icon.
- Refactor: Milestone information appears above the Progress bar, as compared to below.
- Refactor: Progress bar colors are now accent and accent-foreground.
- Removed: package-lock.json
### \`v0.9.5-alpha\` (2025-07-17)
- Refactor: Due Dates are now optional for Milestones and Issues.
- Refactor: Changed Dirham's symbol to \`Dh\` until the new symbol is unicode-supported.
- Added: A single \`getCurrencySymbol()\` function in \`utils.ts\`.
- Added: New \`formatDate()\` function in \`utils.ts\`, due dates now show up in a more readable format.
### \`v0.9.6-alpha\` (2025-07-18)
- Refactor: Changed icon for version.
- Refactor: Project's page budget also uses the currency symbol now, instead of dollar icon.
- Refactor: Issue sheet redesign, now looks much better.
### \`v0.9.7-alpha\` (2025-07-19)
- Fix: Issues Sheet is now scrollable.
- Fix: Project Notes Sheet is now scrollable.
- Feature: Upcoming Issues are now shown on Home page.
### \`v0.9.8-alpha\` (2025-07-20)
- Feature: Added \`SaveManager.exportJSON()\` and \`SaveManager.importJSON()\` functions.
- Feature: \`SaveManager\` now also import/exports the Projects, Milestones, and Issues.
- Research: Completed the test of \`BIT: DCP\` protocol for syncing data. (More soon).
### \`v0.9.9-alpha\` (2025-07-21)
- Feature: Projects page now separates the projects into categories.
### \`v0.9.10-alpha\` (2025-07-21)
- Feature: Added new Milestone status: Paid, it is also treated as closed.
- Feature: Added new Copy Earnings button to Projects page.
- Feature: New \`setClipboard()\` function in \`utils.ts\`.
***

## \`v0.8.0-alpha\` (2025-07-03)
### Added
- Implemented Todo functionality.
### Updates
- Updated \`useTasks.ts\`.
- Updated \`SaveManager.ts\` and \`db.ts\` for new todo functionality.
### Removed
- Removed deprecated \`tasks/page.tsx\`.
### \`v0.8.1-alpha\` (2025-07-03)
- Bumped \`package.json\` version.
- Better webhook messages support with the new Todo functionality.
### \`v0.8.2-alpha\` (2025-07-15)
- Removed Todo functionality.
- Removed all instances of UI related to Todo.
- Removed \`/todo\`.
***

## \`v0.7.0-alpha\` (2025-07-03)
### Documented
- Added detailed documentation (with help of AI).
- Refactored filenames (v0.6.4-alpha).
### Fixed
- Fixed bugs (Mentioned in v0.6.2-alpha and v0.6.3-alpha).
***

## \`v0.6.0-alpha\` (2025-05-30)
### Added
- Added \`SaveManager.ts\`.
- Added Import/Export functionality. The data is exported in a \`.bitf.json\` file extension.
### \`v0.6.1-alpha\` (2025-06-07)
- Bumped \`package.json\` version.
- Shifted to \`pnpm\`.
- Added a Todo button in top bar.
- Thus, added a simple functioning todo list, to keep track of tasks while you're focusing.
### \`v0.6.2-alpha\` (2025-06-29)
- Fixed the bug where, if you stopped the timer, refreshed, and ended it, it wouldn't count and just reset.
### \`v0.6.3-alpha\` (2025-06-30)
- Fixed the navigation block while timer is running.
### \`v0.6.4-alpha\` (2025-06-30)
- Documented more code.
- Removed \`lib/cn.ts\` since all definitions use the one in \`lib/utils.ts\`.
- Renamed files from kebab-case to camelCase/PascalCase.
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
