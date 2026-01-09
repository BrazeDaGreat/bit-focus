# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
pnpm dev          # Start development server with Turbopack (http://localhost:3000)
pnpm build        # Production build
pnpm lint         # Run ESLint
pnpm start        # Start production server
```

Note: This project uses pnpm as the package manager.

## Architecture Overview

BIT Focus is a Next.js 15 productivity tracking application with client-side data storage.

### Data Layer

- **IndexedDB via Dexie.js** (`lib/db.ts`): All data is stored locally in the browser using IndexedDB. The database schema includes tables for configuration, focus sessions, notes, projects, milestones, issues, rewards, and discounts.
- **Zustand stores** (`hooks/`): Each data domain has its own Zustand store that provides CRUD operations and syncs with IndexedDB:
  - `useFocus.ts` - Focus session management
  - `useProjects.ts` - Project/milestone/issue hierarchy
  - `useTag.ts` - Tag management with localStorage persistence
  - `useRewards.ts` - Rewards system
  - `useConfig.ts` - User configuration

### State Management

- **PomoContext** (`hooks/PomoContext.tsx`): React Context for the Pomodoro/standard timer. Manages timer state (running/paused), mode selection, phase transitions (focus/break), and session saving. Timer state persists in localStorage.
- **Zustand with IndexedDB**: Domain stores use Zustand for reactive state with optimistic updates, syncing to Dexie for persistence.

### UI Structure

- **Layout** (`app/layout.tsx`): Provider hierarchy: PomoProvider → SidebarProvider → ThemeProvider
- **Pages**: Next.js App Router pages in `app/` (focus, projects, rewards, changelog)
- **Components**:
  - `components/ui/` - shadcn/ui primitives (Radix-based)
  - `components/` - Application-specific components

### Key Features

- **Timer modes**: Standard (count up) and Pomodoro (count down with focus/break phases)
- **Project management**: Hierarchical Projects → Milestones → Issues structure
- **Picture-in-Picture**: Timer can be shown in a PiP window (`hooks/usePip.tsx`)
- **Multiple themes**: Light, dark, amethyst, bluenight, amoled, and pastel variants
- **Webhook integration**: Optional Discord/webhook notifications for session events

### Technologies

- Next.js 15 with App Router and Turbopack
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui components (Radix primitives)
- Tiptap for rich text editing
- Recharts for analytics visualization
