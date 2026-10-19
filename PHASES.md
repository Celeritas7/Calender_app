# My Calendar — development phases

Each phase is one Claude Code session of work, built on its own branch, reviewed by a
Claude design review before it is merged. Phases are ordered so that no phase has to
re-do work from an earlier one.

## Review loop (every phase)

1. **Build** — Claude Code implements the phase as one commit (on a branch named for the
   phase where the session allows; otherwise on the session's branch), runs `npm test`
   and `npm run shots -- phase-N` (→ `tools/shots/phase-N/`, git-ignored) at 1280 px and
   390 px across five themes (Newsprint 0, Terminal Green 2, Solar Flare 6, Parchment 7,
   Midnight Tokyo 8), and commits.
2. **Design review** — Claude design receives the before (`tools/baseline/`, or the
   previous phase's set) and after screenshots and this
   phase's checklist, runs the named skill, and returns findings ranked
   blocking / should-fix / nice-to-have.
3. **Fix & re-review** — Claude Code fixes blocking and should-fix items, re-shoots,
   design confirms.
4. **Accept** — one PR per phase with before/after screenshots; merge.

Done criteria for every phase: no horizontal scroll at 360 px; no console errors in
guest mode; unit tests pass; no blocking design findings open.

---

## Phase 0 — Foundation (no visible change) — ✅ done

**Goal:** make later phases reviewable and safe.

- Remove from git: `Temp/`, `Attempt/`, `js/New folder/`, `.claude/decoded/`; fix `.gitignore` so `sql/` is tracked and the junk is not.
- Pin `@supabase/supabase-js` to an exact version in `index.html` and `sw.js`.
- Add `sql/schema_R004_rls.sql` that matches the live database (RLS enabled, per-user policies); mark R003 as superseded.
- Add `tools/screenshots.js` (Playwright) and commit baseline PNGs under `tools/baseline/`.
  The script serves the repo, runs guest mode with a stubbed Supabase client, pins the
  clock to 19 Oct 2026 and reports horizontal overflow + page errors per viewport.
- Add unit tests (`npm test`, Node's built-in runner; `tests/harness.js` loads the browser scripts into a vm) for `encodeDiary`/`decodeDiary`, `diaryOverallMood`, `skOccurrences`, `skGarbageOn`, `calcAge`, `firstDay`, `daysIn`.

**Design review:** none. Baseline screenshots are handed to design as the reference set.

---

## Phase 1 — Behaviour bugs — ✅ done

**Goal:** fix every confirmed bug without changing layout.

| # | Bug | Where |
|---|---|---|
| 1 | Reopening a diary entry overwrites the cursor line's mood with "good" | `openModal` → `setDiaryMood('good')`, `diaryPreviewUpdate` |
| 2 | ← → change month while typing in inputs / print slider / Sukkiri overlay | keydown handler `js/app.js:584` |
| 3 | Enter in the password field does not sign in | login markup — wrap in `<form>` |
| 4 | Escape does not exit bulk mode; always calls `closePicker()` → `loadAndRender()` | `js/app.js:757`, `544` |
| 5 | Guest mode: adding a birthday shows a raw JS error | `addBday` reads `data[0]` from the stub |
| 6 | "31 February" accepted, raw Postgres error shown | validate day-per-month in `addBday` |
| 7 | "Edit in Sukkiri" links to `http://localhost:8091` | `SK_APP_URL` → config or hide when unreachable |
| 8 | Holiday names flip to Japanese when online | `refreshHolidays` use `h.name` |
| 9 | `birthdays = {}` on sign-out | set `[]` |

Regression tests for all nine live in `tests/phase1.test.js`. Screenshots are
byte-identical to `tools/baseline/` (behaviour-only phase). Notes:

- The Sukkiri link uses `localStorage.calapp_sukkiri_url` if set; the localhost dev server
  when the calendar runs on localhost; `<origin>/Sukkiri/` (the Celeritas7/Sukkiri Pages
  site) when the calendar runs on github.io; otherwise plain text.
- Bug 3 also gives password managers a real `<form>` to work with.

**Design review (`ux-copy`) — done.** No blocking findings. Applied:
- Missing-fields message names only what is missing ("Add a month", "Add a day and month").
- Save/delete failures show "Not saved / Not deleted — check your connection and try again";
  raw Supabase/Postgres errors go to the console only.
- "Edit these in the Sukkiri app" → "Change these in the Sukkiri app".
Kept as-is: the year-range and "{Month} has only {n} days" messages.

---

## Phase 2 — Phone layout

**Goal:** the app fits a 360–430 px screen with no sideways scroll.

- Top bar: wrap to two rows under 600 px, or move print / theme / install / sign-out into a "⋯" menu.
- Touch targets ≥ 44 px on phone (icon buttons, nav arrows, mood buttons, chips).
- Garbage cards → one horizontal strip (today highlighted, rest scroll) or a single line.
- Month title smaller with the year beside it; the lone ▾ becomes part of the title button.
- Calendar grid visible without scrolling on a 844 px-tall phone.

**Design review:** `design-critique` at 390 px; `accessibility-review` for touch targets and reflow.

---

## Phase 3 — Calendar grid visuals

**Goal:** the grid reads clearly in every theme.

- Today: filled circle / ring behind the date using the theme's `--today-bg`; drop the green pulsing dot.
- Weekend: Saturday and Sunday numbers stay in `--wknd`; cleaning days show colour via chip and underline only.
- Chips: ≥ 10 px text, 2–3 px gap below the date, dots-only mode below 480 px.
- Holiday tag ≥ 9 px; show both holiday and birthday when they coincide.
- Garbage watermark opacity set per theme (light vs dark).
- Nav arrows as visible buttons placed next to the title.

**Design review:** `design-critique` across the five reference themes; `accessibility-review` for contrast (weekend red on pink, Terminal Green card text, Parchment body text).

---

## Phase 4 — Editors and dialogs

**Goal:** no lost edits, keyboard-usable dialogs.

- Day editor: unsaved-changes guard on Escape / ✕ / backdrop; Save button pinned to the bottom; `role="dialog"`, focus trap, focus returned on close.
- Selected cleaning option uses a neutral highlight, not red; buttons on one row.
- Birthday form: equal field heights, one row on desktop, stacked on phone; full "Year (optional)" placeholder.
- Print panel: three labelled sections (This month / Multi-month A3 / Task sheet), each with its own button; panel anchored under the 🖨️ button.
- Sukkiri settings: debounce cloud sync (~500 ms); update chips in place instead of re-rendering the whole overlay.
- "Loading…" toast only if the fetch takes longer than 300 ms.
- Month picker: closing on outside tap applies the change; add a "Go" button.

**Design review:** `accessibility-review` (keyboard, focus, roles); `ux-copy` for dialog labels and the discard prompt.

---

## Phase 5 — Icons, labels, themes

**Goal:** one visual language across the app.

- Replace emoji toolbar icons with one line-icon set coloured by theme; `aria-label` on every icon button; text labels on wide screens; a clearer bulk-mark icon.
- Fixed default theme; "daily rotation" becomes opt-in; `prefers-color-scheme` auto option.
- Load only the active theme's font families (or self-host a subset).
- Contrast fixes: Terminal Green card text, Parchment body font at small sizes.
- Bulk-mark colours get names/tooltips.

**Design review:** `design-system` audit (icon and token consistency); full-app `design-critique`.

---

## Phase 6 — New features (one sub-phase each, any order)

Design reviews a mock-up **before** build, then `design-critique` after.

- **6a Today panel** — today's garbage, cleaning phase, weather, tasks and diary prompt in one card.
- **6b Year heat-map** — 12 × 31 grid of marks and goals.
- **6c Diary timeline & search** — list view across months, text search.
- **6d Swipe navigation** — swipe between months on phone; long-press for bulk mode.
- **6e Reminders** — evening-before garbage notification and cleaning-phase reminder via service worker push.
- **6f Data hygiene** — sign-out clears the local mirror; export diary/month to Markdown or PDF.

---

## Reference

Findings numbered in this file refer to the three review passes in the session
`claude/ui-ease-review-9nl0f3` (ease-of-use review, visual review, deep review).
