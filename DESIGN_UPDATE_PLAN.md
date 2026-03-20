# BIT Focus — Design Update Plan

## Design Philosophy

**"Precision Tool"** — BIT Focus should feel like a high-end instrument built for serious work. Not a toy, not a generic SaaS dashboard. Every element earns its place. Hierarchy is communicated through spatial weight, not decoration.

### Core Principles

1. **Zones, not clutter** — Each page has clearly defined areas with a single purpose. The eye always knows where to go.
2. **Data is the hero** — Content takes center stage. UI chrome is subordinate and recedes.
3. **Consistent spatial rhythm** — A strict spacing scale (4px base unit). Sections breathe at 32px+ gaps; related elements cluster at 8–16px.
4. **Hierarchy through contrast** — Primary info is large and heavy. Secondary info is small and muted. No element competes with its parent.
5. **State is always visible** — Active sessions, running timers, and open items are unmistakably signaled without relying on color alone.

### Typography Rules (to apply across all pages)

- **Page titles / section headers**: Large, heavy weight (`text-2xl font-semibold` or `text-xl font-semibold`), tracking slightly tighter (`tracking-tight`)
- **Card titles**: `text-sm font-semibold uppercase tracking-widest text-muted-foreground` — labels, not headings
- **Metric values (times, counts)**: Monospace font, large (`text-3xl` to `text-5xl`), full foreground color
- **Body / descriptions**: `text-sm text-muted-foreground`, line-height generous
- **Status badges**: All-caps, `text-xs font-medium`, tight padding

### Layout Grid

- **Sidebar**: Fixed `240px` width on desktop, collapsible on mobile
- **Main content**: `max-w-screen-xl mx-auto`, `px-6 py-8` (desktop), `px-4 py-6` (mobile)
- **Content gap**: `gap-6` between major sections, `gap-4` between related cards
- **Two-column split**: `grid grid-cols-[2fr_1fr]` for content + sidebar arrangements

---

## Global Shell (Sidebar + TopBar)

### Current Problems
- Sidebar nav items are flat with no active state weight
- TopBar has no page context — it's just a floating toolbar
- Footer timer is buried and easy to miss when running
- Theme selector is wedged into the sidebar header awkwardly

### Redesigned Sidebar

**Structure (top to bottom)**:
```
┌─────────────────────────┐
│  [Logo/Brand]  BIT Focus │  ← Fixed header, 56px tall
├─────────────────────────┤
│  Navigation             │  ← Grows to fill space
│  ○ Home                 │
│  ● Focus          ←active│  ← Active: left 2px border, bg-accent/40, full width
│  ○ Calendar             │
│  ○ Projects             │
│  ○ Rewards              │
│  ○ Changelog            │
├─────────────────────────┤
│  [Timer Block]          │  ← Only visible when timer is active/paused
│  00:24:13               │     Monospace, `text-lg`, with status dot
│  ● Running — Deep Work  │     Tag label below time
├─────────────────────────┤
│  [Theme] [User]  v0.15.5│  ← Footer row: theme icon left, version right
└─────────────────────────┘
```

**Nav item anatomy**:
- Inactive: `px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground`
- Active: `px-3 py-2 rounded-md text-sm font-medium bg-accent text-foreground border-l-2 border-primary`
- Icon: `16px`, aligned left, `4px` gap to label
- No icon fill color changes — weight/background carries active state

**Timer block (footer)**:
- Only renders when `isRunning || isPaused`
- Separated by a `border-t`
- Shows: current time in monospace, mode label (Focus / Break / Standard), active tag chip
- Subtle pulsing dot for running state (CSS animation, not spinning)
- Click navigates to `/focus`

**Footer row**:
- Left: theme toggle (icon button cycles through themes or opens popover)
- Right: version string `text-xs text-muted-foreground/50`

---

### Redesigned TopBar

**Purpose**: Page title + global utility actions. Not a nav bar.

**Structure**:
```
[Page Title / Breadcrumb]          [Notepad] [Export] [Points Balance]
```

- **Left**: Current page name `text-lg font-semibold` on desktop. On Project Detail: `Projects / Project Name` breadcrumb with `/` separator in muted color.
- **Right**: Utility group — icon buttons with consistent `size-9` touch targets, `gap-1` between them. Points displayed as a pill `[⬡ 1,240 pts]` that opens the rewards dropdown on click.
- **Border**: `border-b` separating topbar from page content
- **Height**: Fixed `56px` (`h-14`), consistent with sidebar header for visual alignment

---

## Home Page (`/`)

### Current Problems
- No visual greeting or orientation — the page just starts
- Heatmap, issues, tags, and analytics feel like four separate apps
- The "Cards TimeFocused" are fine but feel like afterthoughts
- No sense of "what should I focus on today"

### Redesigned Layout

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER STRIP                                                │
│  Good morning. Here's your week.    [Today's date]          │
├──────────────────────────────────────────────────────────────┤
│  STATS ROW  (3 metric cards, full width)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Last 24h │  │  7 Days  │  │ 30 Days  │                   │
│  │  2h 14m  │  │ 18h 40m  │  │ 72h 12m  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
├─────────────────────────────┬────────────────────────────────┤
│  ACTIVITY  (2/3 width)      │  WORKLOAD  (1/3 width)        │
│                             │                               │
│  Activity Heatmap           │  Upcoming Issues              │
│  [12 months of dots]        │  ─────────────────            │
│                             │  TODAY                        │
│  ─────────────────          │  ○ Fix login bug              │
│  Focus Trend                │  ○ Write tests                │
│  [Recharts line/bar]        │  TOMORROW                     │
│                             │  ○ Review PR                  │
│                             │  ─────────────────            │
│                             │  Tags                         │
│                             │  ● Deep Work  ● Admin         │
└─────────────────────────────┴────────────────────────────────┘
```

**Header Strip**:
- `text-2xl font-semibold` greeting (static, not personalized unless config has a name)
- Date in `text-sm text-muted-foreground` right-aligned
- `pb-6 border-b mb-6` to separate from content

**Stats Row (3 metric cards)**:
- Full-width `grid grid-cols-3 gap-4`
- Each card: `border rounded-xl p-5`
- Top label: `text-xs font-semibold uppercase tracking-widest text-muted-foreground`
- Value: `text-4xl font-semibold font-mono tracking-tight` — the number is the hero
- Bottom: subtle delta indicator (e.g., `↑ 2h vs last period`) in `text-xs text-muted-foreground`
- No card action buttons — read-only overview

**Activity Section (left 2/3)**:
- Section label: `text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3`
- Heatmap component: full width, consistent cell sizing, proper tooltip on hover
- `mt-6` separator then "Focus Trend" — a simple area/bar chart using Recharts showing daily focus time for the last 30 days. Chart height: `120px`, no legend, just X-axis dates and Y-axis hours. Clean, minimal axes.

**Workload Section (right 1/3)**:
- `border-l pl-6` visual separator from activity section (desktop only)
- **Upcoming Issues**: Listed by date group. Date group header: `text-xs font-semibold uppercase tracking-widest text-muted-foreground`. Each issue: single row with `○` status indicator, issue title `text-sm`, optional due date chip. Max 8 items visible; "View all" link to projects.
- **Tags**: Below issues, separated by `border-t pt-4`. Tags as compact colored pills `text-xs`, wrapping flex row. Click navigates to filter focus sessions.

**Mobile (stacked)**:
- Stats row: `grid-cols-1 gap-3` or `grid-cols-2` with 30-day card full-width
- Activity and Workload stack vertically (Activity first)

---

## Focus Page (`/focus`)

### Current Problems
- Timer exists among a crowd — no commanding presence
- Tag selector and mode controls are not clearly a "control panel"
- Session history list has no visual rhythm — it's a dump of entries
- YouTube music player integration has no dedicated zone

### Redesigned Layout

```
┌──────────────────────────────────────────────────────────────┐
│  TIMER STAGE  (centered, full width, ~40% of viewport height)│
│                                                              │
│           POMODORO MODE  ·  FOCUS PHASE  3/8                │  ← Mode + context strip
│                                                              │
│                    47 : 23                                   │  ← Timer: huge mono
│                                                              │
│           [━━━━━━━━━━━━━━━━░░░░░░░] 61%                     │  ← Progress bar (Pomo only)
│                                                              │
│     [● Deep Work ▾]    [▶ Start]  [⟳ Reset]  [⚙ Settings]  │  ← Control strip
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  SECONDARY BAR                                               │
│  [🎵 Lo-fi Radio ▾]              [Mode: Standard / Pomo ⇄]  │
├──────────────────────────────────────────────────────────────┤
│  SESSION LOG                                                 │
│  Today — 3h 42m total                                        │
│  ──────────────────────────────────────────────────          │
│  14:32  ●Deep Work   1h 20m   [•••]                          │
│  13:00  ●Admin       0h 45m   [•••]                          │
│  ──────────────────────────────────────────────────          │
│  Yesterday — 5h 10m                                          │
│  ...                                                         │
└──────────────────────────────────────────────────────────────┘
```

**Timer Stage**:
- Background: the timer zone has a subtly different background from the page — `bg-card` with a soft `border-b`, not a card. It spans the full page width.
- Padding: `py-12` top/bottom, content centered
- Mode strip: `text-xs font-semibold uppercase tracking-widest text-muted-foreground` — e.g., `STANDARD MODE` or `POMODORO · FOCUS · SESSION 3 OF 8`
- Timer display: `text-8xl font-mono font-semibold tracking-tighter` on desktop, `text-6xl` on mobile. Full foreground color — no muted timer.
- Progress bar (Pomodoro only): `w-full max-w-md mx-auto`, styled as a minimal track with filled portion matching primary color
- Control strip: `flex items-center justify-center gap-3 mt-6`
  - Tag selector: styled as a pill button `[● Tag Name ▾]` with the tag color dot
  - Start/Pause: primary button with icon + label
  - Reset: ghost/outline button, icon only on mobile
  - Settings (Pomo): ghost icon button

**Secondary Bar**:
- Thin `border-t border-b` divider, `py-3 px-6`
- Left: Music player control — collapsed to `[🎵 Track Name ▾]` pill button. Expands to show play/pause + volume inline.
- Right: Mode toggle — a two-state toggle `[Standard] [Pomodoro]` with pill-style selection
- This keeps clutter out of the timer stage

**Session Log**:
- Section header with date label left and total time right, `text-sm font-semibold`
- `border-t` below header
- Each session row: `grid grid-cols-[auto_1fr_auto_auto]` — time | tag chip | duration | actions menu
  - Time: `text-xs text-muted-foreground font-mono` — `14:32`
  - Tag chip: small colored pill with label
  - Duration: `text-sm font-mono font-medium`
  - Actions `[•••]`: icon-only dropdown (Edit, Delete)
- Date group separator: `text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-6 mb-2`
- Rows have `hover:bg-accent/40` — no cards, just rows with a separator
- Max visible before "Load more": 20 entries

**PiP Mode**:
- Entry point: a small `[⤢ PiP]` icon button in the top-right of the timer stage
- The PiP overlay itself: minimal — timer, tag, start/pause button only

---

## Calendar Page (`/calendar`)

### Current Problems
- react-big-calendar is dropped in with minimal framing
- The tag legend is positioned below the calendar without integration
- No stats for the visible time period
- No filtering capability

### Redesigned Layout

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER                                                      │
│  [← March 2026 →]    [Day] [Week] [Month]    [Today]        │
├───────────────┬──────────────────────────────────────────────┤
│  FILTER PANEL │  CALENDAR                                    │
│  (1/5 width)  │  (4/5 width)                                 │
│               │                                              │
│  Tags         │  [react-big-calendar — week view default]    │
│  ✓ Deep Work  │                                              │
│  ✓ Admin      │                                              │
│  ✓ Learning   │                                              │
│               │                                              │
│  ─────────    │                                              │
│  This Week    │                                              │
│  12h 40m      │                                              │
│  ─────────    │                                              │
│  Sessions: 8  │                                              │
│  Avg: 1h 35m  │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

**Header Bar**:
- `flex items-center justify-between py-4 mb-4 border-b`
- Date navigation: `← [Month Year] →` with icon buttons. Month/Year in `text-xl font-semibold`
- View controls: segmented control `[Day | Week | Month]` — styled as a tab group, not 3 separate buttons
- Today button: ghost pill button

**Filter Panel (left 1/5)**:
- `border-r pr-4` separator from calendar
- "Tags" section header: `text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2`
- Each tag: `flex items-center gap-2 py-1.5 text-sm cursor-pointer` with a colored square checkbox + tag name. Click toggles visibility of that tag's events.
- Divider then Period Stats:
  - "This Week / Month" (adapts to view)
  - Total hours: `text-2xl font-mono font-semibold`
  - Sessions count and average: `text-xs text-muted-foreground`
- On mobile: filter panel becomes a popover accessed from a filter button in the header

**Calendar Area**:
- Custom CSS overrides for react-big-calendar to match the design system:
  - Event tiles: `rounded-md`, tag color as background with `0.9 opacity`, white text
  - Time column: `font-mono text-xs text-muted-foreground`
  - Today column: subtle `bg-accent/20` highlight
  - Remove all default blue highlights and replace with primary color
  - Header row (day names): `text-xs font-semibold uppercase tracking-widest text-muted-foreground`
- Event click: opens an edit sheet/dialog (existing EditFocusSession component, better positioned)

---

## Projects Page (`/projects`)

### Current Problems
- Cards have no sense of project health or progress at a glance
- No header stats to understand the portfolio at a glance
- Create button is just floating
- Project detail page: milestone/issue hierarchy has no visual depth

### Redesigned Projects List Layout

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER                                                      │
│  Projects                [3 Active] [1 Scheduled] [2 Closed] │
├──────────────────────────────────────────────────────────────┤
│  CONTROLS                                                    │
│  [Filter: All ▾]  [Sort: Recent ▾]              [+ New Project]│
├──────────────────────────────────────────────────────────────┤
│  PROJECT GRID                                                │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ ● ACTIVE         │  │ ● ACTIVE         │                 │
│  │                  │  │                  │                 │
│  │ Project Alpha    │  │ BIT Focus        │                 │
│  │ v2.1.0           │  │ v0.15.5          │                 │
│  │                  │  │                  │                 │
│  │ [████████░░] 80% │  │ [██████░░░░] 60% │                 │
│  │ 3/4 milestones   │  │ 6/10 milestones  │                 │
│  │                  │  │                  │                 │
│  │ 12 open issues   │  │ 24 open issues   │                 │
│  └──────────────────┘  └──────────────────┘                 │
└──────────────────────────────────────────────────────────────┘
```

**Header**:
- Page title `text-2xl font-semibold` left
- Status count chips right: `[● 3 Active]` `[○ 1 Scheduled]` `[✕ 2 Closed]` — pill buttons that filter the grid

**Controls Bar**:
- `flex items-center gap-3 py-3 border-b mb-6`
- Filter dropdown: `[All Projects ▾]` — by status
- Sort dropdown: `[Recent ▾]`
- Spacer (flex-grow)
- New Project button: primary, right-aligned

**Project Card redesign**:
- `border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer`
- Top row: status badge `text-xs uppercase font-semibold` colored dot + text
- Project title: `text-lg font-semibold mt-2` — the largest text on the card
- Version: `text-xs font-mono text-muted-foreground`
- Progress bar: thin `h-1.5 rounded-full bg-muted` with filled `bg-primary` portion. Shows milestone completion ratio.
- Below bar: `text-xs text-muted-foreground` — `X/Y milestones complete`
- Footer: `border-t mt-4 pt-4 text-xs text-muted-foreground` — open issue count + quick links (if budget: earnings)
- Status colors: Active = `text-emerald-500`, Scheduled = `text-amber-500`, Closed = `text-muted-foreground`

**Grid**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5`

---

### Redesigned Project Detail Page (`/projects/[id]`)

```
┌──────────────────────────────────────────────────────────────┐
│  BREADCRUMB + ACTIONS                                        │
│  Projects / Project Alpha        [Edit] [Notes ▾] [Copy ▾]  │
├──────────────────────────────────────────────────────────────┤
│  PROJECT META STRIP                                          │
│  ● ACTIVE   v2.1.0   $4,200 earned   3/4 milestones done    │
├──────────────────────────────────────────────────────────────┤
│  MILESTONES                                                  │
│                                                              │
│  ▼  Milestone 1 — UI Overhaul              [████░░░░] 75%   │
│     ○ Design mockups          Open  Due Mar 25   [•••]      │
│     ✓ Set up components       Done              [•••]      │
│     ○ Implement pages         Open  Due Apr 1   [•••]      │
│     [+ Add Issue]                                           │
│                                                              │
│  ▶  Milestone 2 — Backend                  [░░░░░░░░]  0%  │
│     (collapsed)                                              │
│                                                              │
│  [+ Add Milestone]                                           │
└──────────────────────────────────────────────────────────────┘
```

**Breadcrumb + Actions**:
- Left: `Projects` (link, `text-muted-foreground hover:text-foreground`) ` / ` `Project Name` (`text-foreground font-semibold`)
- Right: `[Edit]` ghost button, `[Notes]` ghost button (opens sheet), `[⬡ Copy]` ghost button

**Project Meta Strip**:
- `flex items-center gap-6 py-3 border-b border-t text-sm`
- Status badge, version `font-mono`, earnings (if configured), milestone progress text
- This is a scannable summary — all on one horizontal line

**Milestones**:
- Each milestone is an **accordion** row
- Collapsed header: `flex items-center gap-3 py-3 border-b cursor-pointer hover:bg-accent/30`
  - Left: collapse chevron `▶/▼`
  - Milestone title `text-sm font-semibold`
  - Spacer
  - Completion text `text-xs text-muted-foreground`
  - Progress bar `w-24 h-1.5`
  - Status badge
- Expanded: issues appear below the header in an indented list (`pl-8`)
- **Issue row**: `grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 py-2 border-b border-dashed`
  - Status toggle: `○` (open) or `✓` (done) — clickable, instantly toggles
  - Issue title: `text-sm` — inline editable on click
  - Label chip: `text-xs rounded-full px-2 py-0.5`
  - Due date: `text-xs font-mono text-muted-foreground`
  - Actions `[•••]`: dropdown (Edit description, Delete)
- Add Issue: `text-xs text-muted-foreground hover:text-foreground` link at bottom of expanded milestone
- Add Milestone: outlined dashed button at the very bottom of the list

---

## Rewards Page (`/rewards`)

### Current Problems
- Doesn't feel like a "shop" — no sense of spending/economy
- Points balance is a small badge in the topbar (not prominent on this page)
- Discounts are buried
- Items are displayed without clear category browsing

### Redesigned Layout

```
┌──────────────────────────────────────────────────────────────┐
│  BALANCE HEADER                                              │
│  Your Balance                                                │
│  ⬡ 2,480 points                    [+ Add Points]           │
│                                                              │
│  [🏷 ACTIVE DISCOUNT: -20% on Breaks until 5:00 PM]         │
├──────────────────────────────────────────────────────────────┤
│  CATEGORY TABS + ADD BUTTON                                  │
│  [All] [Breaks] [Gaming] [Treats] [Others]    [+ Add Item]   │
├──────────────────────────────────────────────────────────────┤
│  ITEMS GRID                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ 🎮               │  │ ☕               │                 │
│  │ Gaming Session   │  │ Coffee Break     │                 │
│  │ 30-min Apex      │  │ 15 minutes       │                 │
│  │                  │  │                  │                 │
│  │ ⬡ 150 pts        │  │ ⬡ 50 pts         │                 │
│  │ [Redeem]         │  │ [Redeem]         │                 │
│  └──────────────────┘  └──────────────────┘                 │
└──────────────────────────────────────────────────────────────┘
```

**Balance Header**:
- `py-8 border-b`
- Label: `text-xs font-semibold uppercase tracking-widest text-muted-foreground`
- Points value: `text-5xl font-mono font-semibold` — dominant on the page
- Small `[+ Add Points]` ghost button right of the balance (opens "Loan" / "Add" dialog)
- **Active Discounts Banner** (conditional): full-width pill below balance, `bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm`. Shows active discount name, amount, and expiry. Click expands to manage discounts.

**Category Tabs**:
- `flex gap-2 py-3 border-b` — pill/chip style tabs. Active: `bg-primary text-primary-foreground`. Inactive: `border text-muted-foreground hover:text-foreground`.
- `[+ Add Item]` right-aligned (always visible)

**Item Card redesign**:
- `border rounded-xl p-5 flex flex-col`
- Emoji: `text-4xl mb-3` — large, top of card
- Item title: `text-base font-semibold`
- Description: `text-sm text-muted-foreground line-clamp-2 flex-grow`
- Footer: `flex items-center justify-between border-t mt-4 pt-4`
  - Left: Cost as `⬡ X pts` in `text-sm font-mono font-semibold`. If discount active: show strikethrough original + discounted price in accent color.
  - Right: `[Redeem]` primary button (small)
- Hover: `hover:shadow-md transition-shadow`
- Edit/Delete: `[•••]` absolute top-right of card, appears on hover

**Redeem Confirmation Dialog**:
- Clear: item name, original cost, applied discount (if any), final cost
- Single confirm button, cancel link
- On success: toast with remaining balance

**Discounts Management**:
- Accessible from the discounts banner or a `[Manage Discounts]` link
- Sheet from the right: shows all discounts with active/inactive toggle, remaining uses, and delete option
- Create discount: title, percentage, expiry, usage limit

---

## Cross-Page Consistency Standards

### Spacing & Layout
- Page content always starts with a `mb-6` or `mb-8` header section (title + subtitle or title + actions)
- Sections within a page are separated by `mb-8` or `border-t mt-8 pt-8`
- Consistent card padding: `p-5` for content cards, `p-4` for compact cards

### Buttons
- Primary action per page: filled primary button, right-side of header area
- Secondary / utility actions: ghost or outline, grouped by function
- Destructive actions: always in a dropdown, never primary, require confirmation dialog
- Icon-only buttons: always have `title` attribute for accessibility, `size-9` touch target

### Empty States
- When a section has no data: centered message with a relevant icon (`opacity-40`), `text-sm text-muted-foreground` description, and a clear primary action button to add the first item. No raw "No items found" text.

### Loading States
- Skeleton components match the exact shape of the loaded content
- No full-page spinners — use skeleton at component level

### Dialogs & Sheets
- All create/edit dialogs: consistent header (`DialogTitle` + optional `DialogDescription`), scrollable content area, sticky footer with Cancel + Action
- Sheets (drawers): used for contextual side panels only (Notes, filter expansion). Width: `w-96` on desktop.

### Mobile Considerations
- All `grid-cols-2` and `grid-cols-3` collapse to `grid-cols-1` below `md`
- Sidebar collapses to bottom navigation or hamburger sheet
- TopBar shows only the page title + hamburger on mobile (utilities collapse to a "more" menu)
- Timer on Focus page remains full-width and large on mobile
- Touch targets minimum `44px`

---

## Implementation Priority

1. **Shell (Sidebar + TopBar)** — Affects every page, do this first. Establishes the spatial frame.
2. **Focus Page** — Primary use case. Timer stage redesign delivers immediate impact.
3. **Home Page** — Stats row + two-column layout. Most visible on open.
4. **Projects List + Detail** — Most complex; accordion milestone/issue structure.
5. **Rewards Page** — Balance header + category tabs are quick wins.
6. **Calendar Page** — CSS overrides for react-big-calendar + filter panel.
