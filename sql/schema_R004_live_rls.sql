-- ═══════════════════════════════════════════════════════════════
-- CALENDAR APP — Schema R004 (matches the live database, Oct 2026)
--
-- Supersedes R000–R003. Written from the live project's catalog, so it
-- describes what is actually deployed: UUID user ids from Supabase Auth,
-- row-level security on every table, one "own_rows" policy per table.
--
-- Safe to re-run: no DROP statements, everything is IF NOT EXISTS or
-- CREATE OR REPLACE. calendar_app_sukkiri's akatsuki_sukkiri_shred trigger
-- belongs to the Akatsuki hub SQL and is not recreated here.
-- ═══════════════════════════════════════════════════════════════

-- 1. Calendar entries (marks, goals, notes)
CREATE TABLE IF NOT EXISTS calendar_app_entries (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL,
    entry_date  DATE NOT NULL,
    is_marked   BOOLEAN DEFAULT FALSE,
    mark_color  VARCHAR(10) DEFAULT 'red',
    is_goal     BOOLEAN DEFAULT FALSE,
    note        TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, entry_date)
);

-- 2. Diary entries (content is line-encoded: +good / ~neutral / -bad)
CREATE TABLE IF NOT EXISTS calendar_app_diary (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL,
    entry_date  DATE NOT NULL,
    content     TEXT NOT NULL,
    mood        VARCHAR(20),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, entry_date)
);

-- 3. User preferences (theme_pref: -1 = daily rotation, else theme index)
CREATE TABLE IF NOT EXISTS calendar_app_preferences (
    user_id     UUID PRIMARY KEY,
    theme_pref  INT DEFAULT -1,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Birthdays (year 1900 = year unknown; repeats annually by month+day)
CREATE TABLE IF NOT EXISTS calendar_app_birthdays (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL,
    person_name TEXT NOT NULL,
    birth_date  DATE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Sukkiri settings (legacy single-row payload; live data now flows through akatsuki_state)
CREATE TABLE IF NOT EXISTS calendar_app_sukkiri (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_calapp_entries_user_date ON calendar_app_entries (user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_calapp_diary_user_date   ON calendar_app_diary   (user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_calapp_bdays_user        ON calendar_app_birthdays (user_id);

-- 7. updated_at trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cal   ON calendar_app_entries;
DROP TRIGGER IF EXISTS trg_diary ON calendar_app_diary;
DROP TRIGGER IF EXISTS trg_prefs ON calendar_app_preferences;
DROP TRIGGER IF EXISTS trg_bdays ON calendar_app_birthdays;
CREATE TRIGGER trg_cal   BEFORE UPDATE ON calendar_app_entries     FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_diary BEFORE UPDATE ON calendar_app_diary       FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_prefs BEFORE UPDATE ON calendar_app_preferences FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_bdays BEFORE UPDATE ON calendar_app_birthdays   FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 8. Row-level security — each signed-in user sees and writes only their own rows
ALTER TABLE calendar_app_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_app_diary       ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_app_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_app_birthdays   ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_app_sukkiri     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_rows ON calendar_app_entries;
DROP POLICY IF EXISTS own_rows ON calendar_app_diary;
DROP POLICY IF EXISTS own_rows ON calendar_app_preferences;
DROP POLICY IF EXISTS own_rows ON calendar_app_birthdays;
DROP POLICY IF EXISTS own_rows ON calendar_app_sukkiri;
CREATE POLICY own_rows ON calendar_app_entries     FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY own_rows ON calendar_app_diary       FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY own_rows ON calendar_app_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY own_rows ON calendar_app_birthdays   FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY own_rows ON calendar_app_sukkiri     FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
