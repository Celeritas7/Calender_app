-- ═══════════════════════════════════════════════════════════════
-- CALENDAR APP — Schema (No Auth version)
--
-- IMPORTANT: If you already ran the old schema, run this first:
--   DROP TABLE IF EXISTS calendar_app_entries CASCADE;
--   DROP TABLE IF EXISTS calendar_app_diary CASCADE;
--   DROP TABLE IF EXISTS calendar_app_preferences CASCADE;
--
-- Then paste and run everything below.
-- ═══════════════════════════════════════════════════════════════

-- 1. Calendar entries (marks, goals, notes)
CREATE TABLE calendar_app_entries (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     TEXT NOT NULL DEFAULT 'default-user',
    entry_date  DATE NOT NULL,
    is_marked   BOOLEAN DEFAULT FALSE,
    mark_color  VARCHAR(10) DEFAULT 'red',
    is_goal     BOOLEAN DEFAULT FALSE,
    note        TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, entry_date)
);

-- 2. Diary entries
CREATE TABLE calendar_app_diary (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     TEXT NOT NULL DEFAULT 'default-user',
    entry_date  DATE NOT NULL,
    content     TEXT NOT NULL,
    mood        VARCHAR(20),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, entry_date)
);

-- 3. User preferences (theme)
CREATE TABLE calendar_app_preferences (
    user_id     TEXT PRIMARY KEY DEFAULT 'default-user',
    theme_pref  INT DEFAULT -1,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX idx_calapp_entries_user_date ON calendar_app_entries(user_id, entry_date);
CREATE INDEX idx_calapp_diary_user_date   ON calendar_app_diary(user_id, entry_date);

-- 5. Auto-update trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cal   BEFORE UPDATE ON calendar_app_entries   FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_diary BEFORE UPDATE ON calendar_app_diary     FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_prefs BEFORE UPDATE ON calendar_app_preferences FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 6. NO RLS — open access (no login required)
--    RLS is disabled by default, so we don't need to do anything.
--    The anon key can read/write freely.
