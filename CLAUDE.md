# My Calendar — notes for Claude

Static PWA (no build step): `index.html`, `css/styles.css`, `js/*.js`, Supabase backend,
part of the Akatsuki app ecosystem (hub tables `akatsuki_*`).

- Work plan and status: `PHASES.md` (one phase per session, each design-reviewed).
- Tests: `npm test`. Screenshots for design review: `npm run shots -- <label>`
  (before set: `tools/baseline/`).
- Live schema: `sql/schema_R004_live_rls.sql` (R000–R003 are superseded — never run them).

## Standing rules from the owner

- **Health and weather:** whenever weather, seasons or health come up, flag *every* period
  when people tend to get sick — season transitions, pollen, rainy season, heat, typhoons,
  dry/flu season, big temperature or pressure swings — not only the case being discussed.
  The working list and thresholds are in `PHASES.md` → Phase 7.
- **Akatsuki:** the hub owns shared data such as weather (`akatsuki_weather`, "read, never
  publish"). Apps read hub views; don't add per-app copies of hub-owned data.
