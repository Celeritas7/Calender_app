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

## Phase 2 — Phone layout — ✅ done

**Goal:** the app fits a 360–430 px screen with no sideways scroll.

- Top bar: wrap to two rows under 600 px, or move print / theme / install / sign-out into a "⋯" menu.
- Touch targets ≥ 44 px on phone (icon buttons, nav arrows, mood buttons, chips).
- Garbage cards → one horizontal strip (today highlighted, rest scroll) or a single line.
- Month title smaller with the year beside it; the lone ▾ becomes part of the title button.
- Calendar grid visible without scrolling on a 844 px-tall phone.

**Result:** no horizontal scroll at 320 / 360 / 390 / 430 px (was 47 px over at 390).
Grid top moved from y=435 to y=190 on phone (whole month visible on an 844 px screen) and
from ~474 to 194 on desktop, where the garbage cards now sit four across. Every visible
phone control is ≥ 44 px. ⋯ menu holds Birthdays, Weekly Focus tasks, Theme, Print,
Install (when offered) and Sign out; their dropdowns open as full-width sheets.

**Design review (`design-critique`, with touch-target and reflow checks) — done.**
No blocking findings. Applied: garbage strip shows exactly today + tomorrow with a fade
on the right edge while more cards are off-screen (the third card used to show as a
cut-off sliver). Deferred:
- Day editor: 44 px Sukkiri buttons make each cleaning block ~130 px tall → Phase 4
  (one-row buttons, sticky Save).
- Print panel checkbox rows are 28 px tall → Phase 4 (print panel sections).
- Sukkiri settings chips (weekday / week / icon) are dense → Phase 4.
- "Weekly Focus tasks" menu item opens display settings, not a list → rename in Phase 5.
- Desktop toolbar stays 34 px (pointer input; passes WCAG 2.5.8).

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

## Phase 7 — Weather → Health (via Akatsuki) — hub R046 live 2026-10-24 · Calendar side ✅ done

**Request (owner's words, condensed):** publish daily forecast data to Akatsuki so Health Log
and Setu can use it — date, location, min/max temperature, humidity, pressure, precipitation,
and a change summary vs the previous days. Use the current location from Akatsuki (home:
Minami-Urawa; weekdays: Ageo). Window ≥ 3–5 days ahead, refreshed daily. Flag
season-transition periods so Health Log can warn early. Show a small "health-risk weather"
marker on calendar days Health Log has flagged. **Standing rule: highlight *every* period
when people tend to get sick, not only season transitions** (see the list below).

### What already exists (checked in the live hub, 2026-10-23)

- Hub source `weather` (Open-Meteo) runs hourly: "here" (newest visit ≤ 2 h) + pinned places
  every 3 h, 7 days each, into `akatsuki_cache` → view `akatsuki_weather`
  (`key, label, place_id, class, now, days, fetched_at, expires_at`). Day fields today:
  `date, code, tmax_c, tmin_c, precip_mm, precip_prob_pct` — **no humidity, no pressure,
  no change summary, no risk flags.**
- Vocab `weather.now` (R044): hub → apps, *"Read, never publish"*. It replaced the old
  `forecast` kind; route `weather → cal forecast` is **retired**.
- Proposed routes `hub → cal weather.now` and `hub → setu weather.now` — not yet live.
- Places: `home` has coordinates (35.842, 139.6695). `office` has **no coordinates**; area
  `Ageo office` (35.955, 139.576) does. `minami-urawa` place has no coordinates; area `南浦和` does.
- Monthly climate normals (ERA5, 10 years) exist only for HND/NRT/overseas points — none for home.
- Health Log has tables (`healthlog_symptoms`, …) but **is not registered in `akatsuki_apps`**
  and publishes nothing yet. Route `setu → healthlog comfort.spots` already mentions
  "risky weather is coming", so Health Log is the intended consumer.
- The calendar fetches its own Open-Meteo forecast for a hard-coded point in **Chiba**
  (35.79, 140.06) — the wrong place for Minami-Urawa / Ageo.

### Design (follows the hub's "read, never publish" rule)

The hub owns weather; apps read it. So the calendar does **not** publish forecasts — the hub
job is extended and every app reads `akatsuki_weather`.

1. **Hub (Akatsuki repo / Edge Function `weather` source)**
   - Add `relative_humidity_2m_mean/min`, `pressure_msl_mean` (and 24 h pressure change),
     `apparent_temperature_max`, `wind_gusts_10m_max`, `uv_index_max` to the daily fetch.
   - Keep 7 days ahead + 2 past days (`past_days=2`) so day-to-day change can be computed.
   - Add per-day `change` (Δ tmax, Δ tmin, Δ pressure, Δ humidity vs previous day, plus a
     one-line summary such as "−6 °C overnight low, pressure −9 hPa").
   - Add per-day `risk: [{id, level, reason}]` from the rules below, and a top-level
     `season: {id, label, from, to}` for the active sickness-prone period.
   - Location: `key=here` already follows the phone. For planning ahead, pin both
     `place:home` and `place:office`; give `office` the Ageo office area's coordinates.
     "Where am I that day" = weekday → office, otherwise home, unless `here` says otherwise.
   - Add a climate point for home so monthly normals exist ("colder than normal for the week").
   - Bump `weather.now` vocab to v2 with the new optional fields (additive, no breaking change).
2. **Health Log** — register in `akatsuki_apps`; read `akatsuki_weather`; show early warnings;
   write the days it flags as risky (proposed kind `health.risk_day` {date, level, reasons[]}
   on `healthlog → cal`, or a hub doc the calendar can read).
3. **Calendar (this repo)**
   - Replace `loadWeather()`'s direct Open-Meteo call with a read of `akatsuki_weather`
     (route `hub → cal weather.now` goes live); keep Open-Meteo only as an offline fallback,
     pointed at home, not Chiba.
   - Show the `season` band and per-day `risk` from the hub in the weather view / day editor.
   - Show a small "health-risk weather" marker on days Health Log flagged.
4. **Setu** — reads the same `akatsuki_weather` rows; nothing to publish.

### Sickness-prone periods to flag (Saitama / Kantō) — standing rule: flag all of them

Seasonal windows (shown as a `season` band; dates are typical, tune with climate normals):

| Period | Typical window | Why people get sick |
|---|---|---|
| Late winter → spring swing (寒暖差) | late Feb – Apr | big day-to-day and day-night swings; colds, fatigue |
| Cedar / cypress pollen (花粉) | Feb – May | hay fever, sinus and sleep problems |
| May fatigue (五月病) + swings | May | swings after Golden Week, low energy |
| Rainy season (梅雨) | early Jun – mid Jul | low pressure → headaches (気象病), damp, food poisoning, mould |
| Heat (熱中症 / 夏バテ) | mid Jul – Aug | heatstroke, dehydration, AC chill, poor sleep |
| Lingering heat + typhoons (残暑・台風) | Sep | heat plus sharp pressure drops |
| Autumn swing (秋の寒暖差) + autumn pollen | late Sep – Nov | swings, ragweed pollen, dry air begins |
| Dry cold / flu season (乾燥・インフル) | Dec – Feb | humidity < 40 %, flu and colds, heat shock (ヒートショック) |

Day-level triggers (any season):
- Daily max or min changes ≥ 5 °C from the previous day (≥ 7 °C = high).
- Day–night range ≥ 10 °C.
- Pressure falls ≥ 6 hPa in 24 h (≥ 10 hPa = high) — weather-pain / headache days.
- Mean humidity < 40 % (dry: flu, throat) or ≥ 80 % with ≥ 25 °C (muggy).
- Apparent max ≥ 31 °C (heat caution) / ≥ 35 °C (danger); min ≥ 25 °C (tropical night).
- First days ≥ 3 °C below the monthly normal (first cold snap).
- Typhoon / heavy rain days (code ≥ 95 or precip ≥ 30 mm).

### Outcome (2026-10-24)

**Hub (R046, done by Akatsuki):** `akatsuki_weather` now carries `rh_mean_pct, rh_min_pct,
pressure_hpa_mean` (surface), `pressure_d24_hpa, feels_max_c, gust_max_ms, wind_max_ms,
uv_max, change{d_tmax_c,d_tmin_c,d_pressure_hpa,d_rh_mean_pct,summary},
risk[{id,level,reason}]` per day, a top-level `seasons[]` array (periods overlap), and a
`key=plan` row: today → here, Mon–Fri → office (Ageo, pinned), Sat/Sun → home. Risk ids:
temp_swing, day_night, pressure_fall, dry, muggy, heat, tropical_night, cold_snap, storm.
Seasons: dry_flu, cedar_pollen, spring_swings, gogatsu, tsuyu, heat, zansho, autumn.

**Calendar (this repo):**
- `loadWeather()` reads `akatsuki_weather` key `plan` (fallback `place:home`) filtered by
  `user_id`. No second fetch when signed in; a missing row shows no forecast.
- Preview mode (no hub access) falls back to Open-Meteo at Minami-Urawa station
  (public coordinates — the old point was in Chiba; the home pin is never put in this
  public repo).
- Grid: health-risk badge on the weather icon (amber watch / red high, reasons in its
  label); weather view badges the big icon and counts flagged days.
- Season band above the grid lists every hub season overlapping the month on screen.
- Day editor: temps, where (Here / Office / Home), humidity, pressure and change, the
  hub's change summary, each risk with its level, and the seasons covering that day.
- Open-Meteo CC BY 4.0 attribution shown under the grid (was missing).
- Tests: `tests/phase7.test.js`. Screenshot fixture: `tools/fixtures/weather-plan.json`.

**Design review — done.** Fixed: amber badge contrast (`#c77c02`, ≥ 3:1 on all themes),
risk rows no longer solid colour bars. Deferred: legend for the "!" badge in normal view
(Phase 5), badge brushing the first chip on busy days (Phase 3), small editor text in the
handwriting theme (Phase 5).

**Still open (hub / owner):**
- 🔴 **Privacy:** `akatsuki_weather` is owned by `postgres` without `security_invoker`, and
  `anon` has SELECT. Verified as role `anon`: it returns the `here`, `place:office` and
  `plan` rows, i.e. where the owner is right now and the weekday plan, to anyone holding
  the public anon key (it is committed in this repo). The table itself correctly denies
  anon. Fix in the hub: `alter view akatsuki_weather set (security_invoker = on);
  revoke select on akatsuki_weather from anon;`
- Location rule ignores holidays and away-days. Away-days already reach the hub
  (`calapp_sukkiri` → `away` path in `akatsuki_state`), so the hub can read them now;
  Japanese holidays could come from the same nager.at source the Calendar uses.
- Route `hub → cal weather.now` can be flipped to live once this branch is deployed.
- Optional (owner decision): Health Log's personal, symptom-based marker as
  `health.risk_day {date, level}` on `healthlog → cal`.

### Open questions before building (answered in R046)

- Which repo holds the hub's Edge Functions and SQL (R0xx files)? The hub changes live there.
- Does the "weekdays → Ageo" rule need exceptions (holidays, away days, leave)? Proposed:
  holidays and calendar away-days count as home.
- Should Health Log flags reach the calendar as a stream kind (`health.risk_day`) or a doc?

---

## Reference

Findings numbered in this file refer to the three review passes in the session
`claude/ui-ease-review-9nl0f3` (ease-of-use review, visual review, deep review).
