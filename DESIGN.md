# DESIGN.md

The visual language BIT Focus is built in, and the process for changing it.

Read this before touching UI. It is a description of decisions already made, not a
wishlist — when something in the app contradicts it, the app is wrong and should be
brought in line.

---

## Process: ask before building

**Any redesign or new surface starts with questions, not code.**

Structural choices are the user's to make. Before writing a component, ask 2–4
questions covering the axes that would change the work materially:

- **Purpose** — what job does this screen do? Act, review, or both?
- **Content** — what stays, what goes, what is redundant with something else?
- **Structure** — flat or grouped, one column or two, what leads?
- **Behaviour** — what changes while something is running or loading?

Rules for asking:

- Ground every option in what the code actually does now. Read the file first, name
  the real problems ("the mode toggle sits in a bar below the timer it governs"),
  and let the options address those.
- Mark one option `(Recommended)` and put it first. Having a view is part of the job.
- Do not ask about things with an obvious default, or things the codebase already
  answers. Those are decisions to make and mention, not questions to raise.
- Never ask about aesthetics that this document already settles.

After the answers come back, state the plan in a sentence and build it. Do not
re-ask.

**Then verify.** Run `npx tsc --noEmit` and `pnpm lint` before reporting done, and
say plainly what was left out and why.

---

## The language: soft workspace

The app is used for long, quiet sessions. The interface should be comfortable to sit
inside for two hours, not demand attention. That means layered surfaces and generous
rounding, not hairlines and hard edges.

Three ideas carry it:

1. **Wells, not borders.** Grouping is shown with a soft filled container, not a line
   around things.
2. **One button style per surface.** A surface picks a single button shape and varies
   only its state. Mixing `outline`, `ghost`, and `secondary` in one row is the
   failure mode this replaced.
3. **Colour means state.** Fills carry meaning — active, running, break, past goal.
   Nothing is coloured for decoration.

### Surfaces

| Level | Use | Classes |
| --- | --- | --- |
| Page | Background behind everything | inherit `bg-background` |
| Panel | A section of content | `rounded-2xl border bg-card p-5 shadow-xs` |
| Well | Grouping inside a panel | `rounded-xl bg-muted/60 p-1` (or `bg-muted/40` for read-only) |
| Row | An item in a list | `rounded-lg px-2 py-2 hover:bg-muted/50` |

Sidebar surfaces use the `sidebar-*` tokens instead: `bg-sidebar-accent/50` for
wells, `bg-sidebar-accent` on hover.

Radius steps down with size: `rounded-2xl` panels → `rounded-xl` wells → `rounded-lg`
controls and rows. Never `rounded-none`, never a raw square corner on an interactive
element.

Depth is `shadow-xs` on panels and lifted states only. No `shadow-lg`, no glows except
the one behind the timer ring.

### Typography

- **Numbers are mono.** Durations, counts, times, versions, years — `font-mono` with
  `tabular-nums` anywhere a value updates in place.
- **Headline number** — `font-mono text-4xl font-semibold tracking-tight` (the Home
  today total, the timer clock at `text-6xl`).
- **Panel title** — `text-sm font-semibold tracking-tight`, with an optional
  `text-xs text-muted-foreground` subtitle beneath.
- **Micro-caps** — `text-[11px] font-medium uppercase tracking-[0.1em]
  text-muted-foreground` for section eyebrows and group labels. Used sparingly; when
  every label is micro-caps, nothing leads.
- **Body and controls** — `text-sm`. Secondary detail `text-xs`.

### Colour

Everything comes from theme tokens. There are 15 themes and several are not `.dark`,
so:

- **Never use a `dark:` variant for colour.** It only fires under `.dark` and silently
  misses Amethyst, Blue Night, AMOLED, Nord, Ember, and the rest. Pick a value that
  works on both grounds (`emerald-600`, not `emerald-500`/`emerald-400` pairs).
- Charts and data use `--chart-1` … `--chart-5`.
- Destructive uses the `destructive` token, which every theme defines.
- Success has no token; use `emerald-600` at `/12` background.

Semantic fills:

| Meaning | Fill |
| --- | --- |
| Active / selected | `bg-primary/12` with `text-primary` icon |
| Pressed / toggled on | `bg-muted` (or `bg-background shadow-xs` inside a well) |
| Positive change | `bg-emerald-600/12 text-emerald-600` |
| Negative change | `bg-destructive/12 text-destructive` |
| Focus phase | `var(--primary)` |
| Break phase | `var(--chart-2)` |
| Past your goal | `#10b981` |

Tag colours are user data. Fill at `+"24"` alpha for a soft pill, use the full colour
for dots and bars, and flip label contrast with `getTagColor`'s second return value.

### Controls

Within one surface, every control shares height, radius, padding, and type size. Only
the primary action is filled.

The focus dock is the reference implementation — `DOCK_BUTTON_BASE` in
[`app/focus/page.tsx`](app/focus/page.tsx):

```
h-10 rounded-lg px-3 text-sm font-medium, icon then label, gap-2
```

with exactly three states: quiet (`text-muted-foreground`, `hover:bg-muted/60`),
active (`bg-muted`), primary (`bg-primary text-primary-foreground`). Icon-only
variants are square on the same base (`w-10 justify-center px-0`).

Icon buttons inside a well are `size-9 rounded-lg`, lifting to `bg-background
shadow-xs` when active.

Separation between control groups is a hairline `h-6 w-px bg-border`, hidden below
`sm` where rows wrap.

### Motion

Restrained and purposeful:

- Colour and state: `transition-colors duration-150`.
- Something receding or returning: `duration-500` (the session log dimming while the
  timer runs).
- Ring progress: `duration-700 ease-out`.
- Panels appearing: `motion-safe:animate-in motion-safe:fade-in
  motion-safe:slide-in-from-bottom-1 motion-safe:duration-200`.

Always gate movement behind `motion-safe:`. Never animate layout size on a scrolling
container — a hover scale inside `overflow-x-auto` clips.

### Structure

- **Zones over piles.** A page with two jobs gets two zones and a labelled seam
  between them (`text-xs uppercase tracking-[0.14em]` heading + `h-px flex-1
  bg-border`). Home splits "now" from "review" this way.
- **One lead element per zone.** One big number, one ring, one primary button. If
  three things are the same size, nothing is important.
- **No card inside a card.** A component dropped into a panel renders no card, border,
  or title of its own — the page owns the framing. `FocusHeatmap` is the pattern.
- **Recede, don't hide.** While a session runs the log drops to `opacity-40` and
  returns on hover. Still clickable.
- **Empty states do two things:** name what is missing in `text-sm font-medium`, then
  say how to fix it in `text-xs text-muted-foreground`. Set them in a
  `rounded-xl bg-muted/40` well, never centred grey text on nothing.

### Words

- Sentence case everywhere. "Manage points", not "Manage Points".
- Buttons say what happens: "Start focusing", "Throw away points", "Remove goal".
- Names come from the user's world, not the system's. "Session goal", not
  "goalMinutes config".
- Labels stay identical across the flow — the button that says Publish produces
  "Published".
- Never invent a metric to fill a slot. If there is no meaningful comparison, show
  the number alone. (The standard timer's ring sweeps hourly rather than pretending
  a target exists.)

---

## Anti-patterns

Things already removed. Do not reintroduce them.

- A `Card` rendered inside another card, each with its own title.
- `border-l-2 rounded-l-none` as an active indicator.
- Four adjacent buttons in three different variants at two heights.
- `dark:` colour pairs (breaks 13 of 15 themes).
- `CardDescription` used as a generic layout container.
- Identical uppercase micro-caps on every section, so nothing leads.
- A settings dialog asking a question the surface behind it already answered.
- Icon-only controls with no `title` or `aria-label`.
- A control placed far from the thing it controls.

---

## Quality floor

Non-negotiable on every surface:

- Responsive to mobile — groups wrap, dividers hide, tracks collapse.
- Keyboard reachable with a visible focus ring.
- `aria-label` on every icon-only control, `aria-pressed` on toggles.
- Wide content (tables, the heatmap grid) scrolls in its own container; the page body
  never scrolls sideways.
- Loading states are `Skeleton` shaped like the content, at the content's radius.
- `localStorage` reads and writes wrapped in `try`/`catch` — private mode throws.
