-- ═══════════════════════════════════════════════════════════════
-- CALENDAR APP — Supabase Schema
-- Paste this into Supabase SQL Editor and click Run
-- ═══════════════════════════════════════════════════════════════

-- 1. Calendar entries (marks, goals, notes)
CREATE TABLE calendar_app_entries (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL DEFAULT auth.uid(),
    entry_date  DATE NOT NULL,
    is_marked   BOOLEAN DEFAULT FALSE,
    mark_color  VARCHAR(10) DEFAULT 'red',
    is_goal     BOOLEAN DEFAULT FALSE,
    note        TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, entry_date)
);

-- 2. Diary entries (personal journal)
CREATE TABLE calendar_app_diary (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL DEFAULT auth.uid(),
    entry_date  DATE NOT NULL,
    content     TEXT NOT NULL,
    mood        VARCHAR(20),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, entry_date)
);

-- 3. User preferences (theme)
CREATE TABLE calendar_app_preferences (
    user_id     UUID PRIMARY KEY DEFAULT auth.uid(),
    theme_pref  INT DEFAULT -1,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX idx_calapp_entries_user_date ON calendar_app_entries(user_id, entry_date);
CREATE INDEX idx_calapp_diary_user_date  ON calendar_app_diary(user_id, entry_date);

-- 5. Auto-update trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cal   BEFORE UPDATE ON calendar_app_entries  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_diary BEFORE UPDATE ON calendar_app_diary     FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_prefs BEFORE UPDATE ON calendar_app_preferences  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 6. Row Level Security — users can ONLY access their own data
ALTER TABLE calendar_app_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_app_diary    ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_app_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_cal_select" ON calendar_app_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_cal_insert" ON calendar_app_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_cal_update" ON calendar_app_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_cal_delete" ON calendar_app_entries FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own_diary_select" ON calendar_app_diary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_diary_insert" ON calendar_app_diary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_diary_update" ON calendar_app_diary FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_diary_delete" ON calendar_app_diary FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own_prefs_select" ON calendar_app_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_prefs_insert" ON calendar_app_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_prefs_update" ON calendar_app_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
