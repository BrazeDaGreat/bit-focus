# BIT Focus

Your local-first workspace for focused work, planning, and personal productivity.

[Use BIT Focus](https://focus.uziraze.com) | [View changelog](https://focus.uziraze.com/changelog) | [Report an issue](https://github.com/BrazeDaGreat/bit-focus/issues)

BIT Focus combines a focus timer, time tracking, project planning, calendar timeblocking, rewards, notes, whiteboarding, ambient sound, and optional AI in one day-to-day workspace. Core features work without an account, and app data stays in your browser unless you explicitly connect an account or use an integration.

> **Project status:** BIT Focus is under active development. Export a `.bitf.json` backup regularly, especially before upgrading a self-hosted instance.

## Use BIT Focus

The easiest way to get started is the hosted app:

**[Open focus.uziraze.com](https://focus.uziraze.com)**

No installation or account is required. Complete onboarding, choose your tags and theme, then start a focus session. Accounts are optional and are only needed for cross-device sync.

BIT Focus is designed around a practical daily loop:

1. Plan work with projects, milestones, issues, and calendar timeblocks.
2. Start a standard or Pomodoro focus session from any page.
3. Compare planned time with completed sessions and review trends by tag.
4. Use earned points for self-defined rewards.
5. Export a local backup or opt into account sync when you need another device.

## Features

### Focus and time tracking

- Standard count-up and configurable Pomodoro timers
- Global mini timer, document-title timer, and Picture-in-Picture timer
- Manual session entry for time tracked elsewhere
- Searchable focus table with filtering, sorting, pagination, bulk editing, deletion, and CSV export
- Focus charts, tag breakdowns, yearly heatmap, and streak tracking
- Optional Discord webhook updates and quick messages

### Planning and project work

- Projects with statuses, semantic versions, notes, and quick links
- Milestones with budgets, deadlines, and payment states
- Issues with labels, due dates, descriptions, and completion states
- Day and week calendar views for planned timeblocks and actual focus sessions
- Drag-to-create, move, resize, edit, and filter timeblocks

### Focus environment

- Ambience mixer with 18 loopable sounds and per-sound volume controls
- Global pause and resume for the ambience mix
- Embedded YouTube player on the Focus page
- Floating notepad and global keyboard shortcuts
- Multiple light, dark, AMOLED, pastel, and themed color schemes
- Feature toggles for hiding tools you do not use

### Personal workspace

- Custom rewards, discounts, point loans, and redemptions
- Multi-scene Excalidraw whiteboard with automatic local saves
- Context-aware AI chat using your own Groq or Google API key
- `.bitf.json` export and import for portable backups
- Optional accounts with two-way sync, conflict resolution, and manual upload/download controls

## Privacy and data ownership

BIT Focus is local-first:

- Focus sessions, projects, rewards, drawings, settings, and other workspace data are stored in IndexedDB and local storage.
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
5. Run `pnpm build` and `pnpm lint` where supported.
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
- [Excalidraw](https://excalidraw.com/) and TipTap for workspace tools
- [Vercel AI SDK](https://ai-sdk.dev/) and assistant-ui for optional AI chat

The main application routes live in `app/`, shared interface components in `components/`, state stores and contexts in `hooks/`, and persistence/integration code in `lib/`.

## License

BIT Focus is available under the [MIT License](./LICENSE.md).