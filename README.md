# ⬡ BIT Focus

BIT Focus is a premium, client-side productivity tracking workspace and gamified focus suite built on **Next.js 15**, **React 19**, and **IndexedDB**. Designed for creators, developer-freelancers, and self-starters, it combines tracking, planning, whiteboarding, and gamification with local-first database architecture and context-aware AI.

---

## 🚀 Key Features

### 1. ⏱️ Advanced Focus Timer
An interactive workspace timer that keeps you in the zone:
- **Modes**: Seamlessly switch between **Standard (count up)** and **Pomodoro (count down)** timer methods.
- **Customization**: Fully adjustable focus and break durations, alert sounds, and transition behaviors.
- **Picture-in-Picture (PiP)**: Pop out a floating mini-timer window using the custom PiP component (`hooks/usePip.tsx`) to monitor your focus while working in other apps.
- **Ambient Music Player**: Integrated collapsible YouTube music player directly in the timer stage.
- **Discord Integration**: Optional webhook connectivity to automatically broadcast focus achievements and session statistics.
- **Global Mini-Timer**: Collapsible timer in the sidebar keeps track of your focus state across all pages.

### 2. 📊 Project, Milestone & Issue Dashboard
A full-featured multi-tier task hierarchy designed to track deliverables and earnings:
- **Structure**: Organize work into **Projects** → **Milestones** → **Issues**.
- **Progress Tracking**: Real-time progress bars calculating milestone completions and open issue counts.
- **Quick Link Hub**: Attach documentation or repository URLs to projects. Features automatic icon resolution based on hostnames.
- **Earning Summary Compiler**: Formats project budgets and completed milestones into clipboard-ready text with custom status emojis to track project financials.

### 3. 📅 Drag-and-Drop Calendar & Timeblocking
Plan your days and compare plans against your actual tracked sessions:
- **Planned vs Actual**: Renders background timeblocks (dashed borders) alongside actual tracked focus sessions (solid color blocks).
- **Interactive Control**: Drag, drop, and resize planned blocks on the calendar grid to rearrange your schedule.
- **Drag-to-Create**: Drag on an empty slot to create planned blocks instantly via a coordinates-aware popup.
- **Zoom Configurator**: Toggle calendar density between **Compact**, **Normal**, and **Expanded** vertical spacing.
- **Smart Filtering**: Filter focus logs and planned tasks by custom tags.

### 4. 🛍️ Gamified Rewards Shop
Motivate yourself by earning points for focused work and redeeming them:
- **Local Economy**: Earn focus points (⬡ pts) based on the durations of completed sessions.
- **Rewards Store**: Define custom reward items with prices, descriptions, categories, and preset icons.
- **Discount Codes**: Add and toggle active percentage discount codes that dynamically lower redemption prices.
- **Points Loan System**: Borrow points with the loan feature to redeem rewards early and pay it back automatically during subsequent focus sessions.

### 5. 🎨 Excalidraw Whiteboard
A local sketch and diagramming space:
- **Fully Embedded**: Excalidraw whiteboard integration directly inside the app shell.
- **Auto-Saving**: Debounced local database saves (1000ms delay) to keep your diagrams safe.
- **Multi-Scene Support**: Create, load, rename, and delete scenes stored securely in IndexedDB.

### 6. 🧠 Context-Aware AI Chat Assistant
A local assistant that knows your productivity metrics:
- **Model Compatibility**: Support for multiple models from **Google Gemini** and **Groq** (bring your own API keys).
- **Workspace Context Injection**: Toggle dynamic context loading. The system compiles your name, exact age, accumulated points, recent focus durations (24h, 7d, 14d, 30d), tag breakdowns, and active timer states to feed directly into the model for highly personalized feedback.
- **Local Logs**: Chat histories are stored completely local using your browser's IndexedDB.

### 7. 🎨 Premium Custom Themes
Adapt your environment to match your mood. Toggle themes from the sidebar popover:
- **Light & Dark**: Standard light/dark themes.
- **AMOLED**: True-black design for energy saving.
- **Blue Night**: A cool, ocean-inspired palette.
- **Amethyst & Amethyst+**: Deep purple aesthetics.
- **Pastel Series**: Soft, calming pastel-blue, pastel-orange, and pastel-purple environments.

---

## 🛠️ Technical Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/) with Turbopack for lightning-fast compilation.
- **Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database Layer**: [Dexie.js](https://dexie.org/) (Wrapper for IndexedDB) providing local-first, schema-versioned client-side storage.
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) for reactive domain stores + React Context for global timer states.
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & [shadcn/ui](https://shadcn.dev/) components built on Radix UI primitives.
- **Rich Text / Editor**: [TipTap](https://tiptap.dev/)
- **Charts / Heatmaps**: [Recharts](https://recharts.org/) for productivity graphs and Git-style focus heatmaps.
- **Calendar**: [React Big Calendar](https://github.com/jquense/react-big-calendar) with drag-and-drop addons.
- **Canvas**: [@excalidraw/excalidraw](https://excalidraw.com/)
- **AI Engine**: [Vercel AI SDK](https://sdk.vercel.ai/docs) & [assistant-ui](https://assistant-ui.com/).

---

## 🗄️ Database Schema (IndexedDB)

The database schema is managed via Dexie.js in `lib/db.ts`. All user configuration, focus logs, projects, drawings, and chat histories remain strictly local to the user's browser.

| Table Name | Keys & Indexes | Purpose |
| :--- | :--- | :--- |
| `configuration` | `name` | Stores user configuration (name, DOB, webhook URL, preferred currency, updates toggles). |
| `focus` | `++id, tag, startTime, endTime` | Tracks completed focus sessions. |
| `timeblocks` | `++id, tag, startTime, endTime` | Tracks calendar planned timeblocks. |
| `notes` | `++id, title, type, parentId, createdAt, updatedAt` | Manages document and board-style notes. |
| `projects` | `++id, title, status, createdAt, updatedAt` | Stores project metadata, version history, and quick links. |
| `milestones` | `++id, projectId, title, status, deadline, createdAt, updatedAt` | Milestones hierarchy under projects including budgets. |
| `issues` | `++id, milestoneId, title, label, dueDate, status, createdAt, updatedAt` | Individual tasks/issues grouped under milestones. |
| `rewards` | `++id, title, cost, category, createdAt, updatedAt` | Items in the rewards shop. |
| `discounts` | `++id, title, percentage, active, createdAt, updatedAt` | Percentage coupons to discount rewards. |
| `excalidraw_v2` | `id, title, createdAt, updatedAt` | Drawings and canvas scenes. |
| `ai_chats` | `id, createdAt, updatedAt` | Local AI chat history logs. |
| `ai_config` | `key` | API configurations and key storage for Groq and Gemini. |

---

## ⚙️ Development and Installation

### Prerequisites
- Node.js (v18+ recommended)
- `pnpm` package manager (recommended for this project)

### Setup
1. **Clone the repository:**
   ```bash
   git clone https://github.com/BrazeDaGreat/bit-focus.git
   cd bit-focus
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Start the development server (with Turbopack):**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

4. **Production Build:**
   ```bash
   pnpm build
   pnpm start
   ```

5. **Linting:**
   ```bash
   pnpm lint
   ```

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE.md) file for details.