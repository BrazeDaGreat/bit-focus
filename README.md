# BIT Focus

Your local-first workspace for focused work, planning, and personal productivity.

[Use BIT Focus](https://focus.uziraze.com) | [View changelog](https://focus.uziraze.com/changelog) | [Report an issue](https://github.com/BrazeDaGreat/bit-focus/issues)

BIT Focus combines a focus timer, time tracking, project planning, calendar timeblocking, rich text notes, rewards, ambient sound, and optional AI in one day-to-day workspace. Core features work without an account, and app data stays in your browser unless you explicitly connect an account or use an integration.

> **Current release: v0.24.0 (LTS).** This release strengthens focus-session saving, task-note recovery, and complete manual backups. Export a `.bitf.json` backup regularly, especially before upgrading a self-hosted instance.

## Use BIT Focus

The easiest way to get started is the hosted app:

**[Open focus.uziraze.com](https://focus.uziraze.com)**

No installation or account is required. Complete onboarding, choose your tags and theme, then start a focus session. Accounts are optional and are only needed for cross-device sync.

BIT Focus is designed around a practical daily loop:

1. Plan work with projects, tasks, deadlines, estimates, and calendar timeblocks.
2. Start a standard or Pomodoro focus session from any page.
3. Compare planned time with completed sessions and review trends by tag.
4. Use earned points for self-defined rewards.
5. Export a local backup or opt into account sync when you need another device.

## Features

### Focus and time tracking

- Standard count-up and configurable Pomodoro timers
- Global mini timer, document-title timer, Picture-in-Picture timer, and landscape timer for phones
- Session goals, configurable breaks, and optional timer recovery after reload
- Active-time accounting, atomic session saves, and retry/reload recovery for failed saves
- Manual session entry for time tracked elsewhere
- Searchable focus table with filtering, sorting, pagination, bulk editing, deletion, and CSV export
- Focus charts, tag breakdowns, yearly heatmap, and streak tracking
- Optional Discord webhook updates and quick messages

### Planning and project work

- Project rail on desktop and project tiles on phones, with searchable project icons
- Tasks and subtasks with tags, primary focus tag, deadlines, priorities, and estimates
- Quick add that recognizes dates, times, tags, projects, priorities, and estimates, with a preview you can correct
- Deadline runway and tasks grouped by due date, with completed tasks and Trash folded away
- Rich task notes with save status, retry controls, local draft recovery, pasted images, and local file attachments up to 25 MB each
- Task restoration and project archiving
- Task-linked standard/Pomodoro sessions, estimated versus actual time, and task results in Home's weekly review
- Task deadlines on the existing calendar, plus multiple linked calendar blocks per task
- Automatic migration of older issues and todo records, retaining milestone budgets/payment states and older backups
- Calendar views for planned timeblocks, task deadlines, and actual focus sessions
- Drag-to-create, move, resize, edit, and filter timeblocks

### Focus environment

- Ambience mixer with 18 loopable sounds and per-sound volume controls
- Global pause and resume for the ambience mix
- Embedded YouTube player on the Focus page
- Floating notepad and global keyboard shortcuts
- Multiple light, dark, AMOLED, pastel, and themed color schemes
- Feature toggles for hiding tools you do not use

### Notes and personal workspace

- Nested note pages with search, project-style icons, move controls, Trash, and restoration
- Rich text editing with slash commands, tables, code, equations, callouts, columns, and images
- Note autosave, local recovery drafts, and PDF export
- Custom rewards, discounts, point loans, and redemptions
- Context-aware AI chat with a configurable OpenAI-compatible endpoint, including local endpoints
- Command palette for timer controls, navigation, tags, themes, and backups
- Complete manual `.bitf.json` backups and a preview before restoring
- Optional accounts with two-way sync, conflict resolution, and manual upload/download controls

## Backups and recovery

Export a backup from Settings → Data, the data menu, or the command palette. Manual exports include note images and task attachments. Restoring first validates the file and shows its contents and file coverage; saved data is replaced only after you confirm.

Automatic backups download every 24 hours while the app is open, when enabled. They omit note images and task attachments to stay small, and their filenames include `without-files`. Make a manual export before moving devices or upgrading a self-hosted instance.

Older `.bitf.json` backups remain supported. If a backup omits files, restoring keeps existing note images and keeps local task attachments only for tasks present in the restored data. A backup without files cannot recover files on an empty device. Task attachments stay on the device and do not sync; note images participate in account sync.

Account session tokens and device recovery drafts are excluded from backups. Backups can contain saved API keys and webhook URLs, so store them privately.

Finished focus sessions are saved before completion messages and reward points are issued. Failed saves offer Retry and are recovered on reload when browser storage is available. Switching timer modes finishes the current focus session if it meets the one-minute minimum, then starts the selected mode from zero. Pauses and breaks do not earn focus time.

Task notes keep unsaved drafts on this device and show save status. If saving fails, retry from the editor. Reload recovery needs working local storage; when storage is blocked or full, keep the editor or timer tab open and follow its recovery message.

## Privacy and data ownership

BIT Focus is local-first:

- Focus sessions, projects, notes, rewards, settings, and other workspace data are stored in IndexedDB and local storage.
- You can use the core app while signed out.
- AI API keys are supplied by you and stored locally in your browser.
- Data only leaves your browser when you choose a networked feature such as AI chat, a Discord webhook, account authentication, or cloud sync.
- Exported `.bitf.json` backups exclude account session tokens.

Browser storage can be cleared by browser settings, privacy tools, or site-data cleanup. Keep backups if the data matters to you.

## Run locally

### Requirements

- Node.js 18 or newer
- [pnpm](https://pnpm.io/installation)

### Setup

```bash
git clone https://github.com/BrazeDaGreat/bit-focus.git
cd bit-focus
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful commands:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Turbopack development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm test` | Persistence, timer, autosave, backup, migration, sync, and date regression tests |
| `pnpm test:e2e` | Browser workflow regressions (app server on port 3001) |
| `pnpm exec tsc --noEmit` | Check TypeScript types |
| `pnpm lint` | Run the configured Next.js lint command |

No environment variables are required for local-only use. The AI providers use API keys entered in the app.

### Optional account and sync backend

Accounts and cross-device sync use PocketBase. The app defaults to the public BIT Focus backend. To point a self-hosted frontend at your own compatible PocketBase instance, set:

```bash
NEXT_PUBLIC_POCKETBASE_URL=https://your-pocketbase.example.com
```

A custom backend must provide the authentication providers and owner-scoped sync collection expected by the app. Without that backend, local features still work; account and sync features will not.

## Self-hosting

BIT Focus is a standard Next.js application and can be hosted anywhere that supports Next.js 15. For a basic Node.js deployment:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Use HTTPS in production so browser storage, authentication, clipboard access, notifications, and Picture-in-Picture behavior work reliably. If you do not want to maintain a deployment, use the hosted version at [focus.uziraze.com](https://focus.uziraze.com).

## Contributing

Contributions are welcome. Bug reports, documentation fixes, accessibility improvements, focused UI refinements, and well-scoped feature proposals are useful.

1. Search [existing issues](https://github.com/BrazeDaGreat/bit-focus/issues) before opening a new one.
2. Fork the repository and create a branch from the current default branch.
3. Install dependencies with `pnpm install`.
4. Make a focused change that follows the existing TypeScript, React, Tailwind, and shadcn/ui patterns.
5. Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build`. Run relevant browser tests for interaction changes.
6. Open a pull request explaining the problem, solution, test steps, and any visible UI changes.

For larger features or changes to persistence and sync behavior, open an issue first. Include screenshots for UI changes and note any IndexedDB schema, import/export, or backward-compatibility impact.

Please do not include API keys, authentication tokens, webhook URLs, personal exports, or other private data in issues, commits, or screenshots.

## Architecture

BIT Focus uses:

- [Next.js 15](https://nextjs.org/) with the App Router and Turbopack
- [React 19](https://react.dev/) and TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/) with shadcn/ui and Radix primitives
- [Dexie.js](https://dexie.org/) over IndexedDB for local persistence
- [Zustand](https://zustand.docs.pmnd.rs/) and React Context for application state
- [PocketBase](https://pocketbase.io/) for optional authentication and sync
- [Recharts](https://recharts.org/) and React Big Calendar for analytics and scheduling
- [TipTap](https://tiptap.dev/) for rich text notes
- [Vercel AI SDK](https://ai-sdk.dev/) and assistant-ui for optional AI chat

The main application routes live in `app/`, shared interface components in `components/`, state stores and contexts in `hooks/`, and persistence/integration code in `lib/`.

## Upgrading older installations

Database version 13 converts issues into tasks with stable identities, preserving project notes and links, issue dates and completion, and milestone names in the retained data. Legacy milestone budgets, payment states, project versions, and saved filters remain in storage and backups, even where the current task workspace no longer exposes them.

Task deadlines, estimates, and focus time are distinct. Date-only deadlines retain their calendar day across time zones. Existing focus history is kept; only sessions started from a task gain task/project attribution. Calendar blocks can link to a task without adding scheduling fields to the task.

The upgrade resets the sync pull cursor once, allowing previously unknown task records to be fetched. Use the updated app on each device; older clients still operate on the retained issue records and do not understand task edits. Tasks and saved filters use the existing generic sync collection. No backend collection is added. New backups include tasks, saved filters, and task links; older BIT Focus backups are converted when restored.

Run `pnpm test` for persistence regressions. For browser checks, install Chromium with `pnpm exec playwright install chromium`, start `pnpm dev --port 3001` in another terminal, then run `pnpm test:e2e`. To check the production app, run `pnpm build` and use `pnpm start --port 3001` instead. Offline service-worker behavior is enabled only in production.

## License

BIT Focus is available under the [MIT License](./LICENSE.md).
