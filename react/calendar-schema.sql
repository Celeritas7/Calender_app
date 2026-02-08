-- ═══════════════════════════════════════════════════════════════
-- CALENDAR APP - DATABASE SCHEMA
-- Compatible with: MySQL / PostgreSQL / SQLite
-- ═══════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------
-- 1. USERS TABLE
-- ---------------------------------------------------------------
CREATE TABLE users (
    user_id         INT PRIMARY KEY AUTO_INCREMENT,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100),
    theme_pref      INT DEFAULT -1,          -- -1 = auto (daily rotation), 0-6 = fixed theme
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------
-- 2. CALENDAR ENTRIES TABLE (marks, notes, goals)
-- ---------------------------------------------------------------
CREATE TABLE calendar_entries (
    entry_id        INT PRIMARY KEY AUTO_INCREMENT,
    user_id         INT NOT NULL,
    entry_date      DATE NOT NULL,
    is_marked       BOOLEAN DEFAULT FALSE,   -- the ✕ mark on the day
    mark_color      VARCHAR(10) DEFAULT 'red', -- red|pink|teal|cyan|orange|purple|yellow
    is_goal         BOOLEAN DEFAULT FALSE,   -- ⭐ goal achieved flag
    note            TEXT,                     -- short note shown on calendar cell
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_date (user_id, entry_date)
);

-- ---------------------------------------------------------------
-- 3. DIARY ENTRIES TABLE (personal diary / journal)
-- ---------------------------------------------------------------
CREATE TABLE diary_entries (
    diary_id        INT PRIMARY KEY AUTO_INCREMENT,
    user_id         INT NOT NULL,
    entry_date      DATE NOT NULL,
    content         TEXT NOT NULL,            -- diary text content
    mood            VARCHAR(20),             -- optional: happy|sad|neutral|excited|stressed
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_diary_date (user_id, entry_date)
);

-- ---------------------------------------------------------------
-- 4. THEMES TABLE (optional - store custom themes)
-- ---------------------------------------------------------------
CREATE TABLE themes (
    theme_id        INT PRIMARY KEY AUTO_INCREMENT,
    theme_name      VARCHAR(50) NOT NULL,
    emoji           VARCHAR(10),
    bg_gradient     VARCHAR(255),
    card_bg         VARCHAR(20),
    accent_color    VARCHAR(20),
    header_font     VARCHAR(100),
    body_font       VARCHAR(100),
    is_default      BOOLEAN DEFAULT FALSE
);

-- Pre-populate with the 7 built-in themes
INSERT INTO themes (theme_name, emoji, accent_color, is_default) VALUES
('Parchment Journal', '📜', '#d63031', TRUE),
('Midnight Tokyo',    '🌃', '#ff2d95', TRUE),
('Forest Morning',    '🌿', '#2e7d32', TRUE),
('Ocean Breeze',      '🌊', '#0277bd', TRUE),
('Sunset Amber',      '🌅', '#e65100', TRUE),
('Lavender Dusk',     '🪻', '#7b1fa2', TRUE),
('Carbon Night',      '🖤', '#ff6b35', TRUE);


-- ═══════════════════════════════════════════════════════════════
-- INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX idx_cal_user_date ON calendar_entries(user_id, entry_date);
CREATE INDEX idx_diary_user_date ON diary_entries(user_id, entry_date);
CREATE INDEX idx_cal_date_range ON calendar_entries(entry_date);


-- ═══════════════════════════════════════════════════════════════
-- COMMON QUERIES (copy-paste ready for your backend)
-- ═══════════════════════════════════════════════════════════════

-- ✅ Get all entries for a specific month
-- Replace :user_id, :year, :month with actual values
SELECT
    ce.entry_date,
    ce.is_marked,
    ce.mark_color,
    ce.is_goal,
    ce.note,
    de.content AS diary_content,
    de.mood
FROM calendar_entries ce
LEFT JOIN diary_entries de
    ON ce.user_id = de.user_id AND ce.entry_date = de.entry_date
WHERE ce.user_id = :user_id
  AND YEAR(ce.entry_date)  = :year
  AND MONTH(ce.entry_date) = :month
ORDER BY ce.entry_date;


-- ✅ Insert or Update a calendar entry (UPSERT)
INSERT INTO calendar_entries (user_id, entry_date, is_marked, mark_color, is_goal, note)
VALUES (:user_id, :date, :is_marked, :mark_color, :is_goal, :note)
ON DUPLICATE KEY UPDATE
    is_marked  = VALUES(is_marked),
    mark_color = VALUES(mark_color),
    is_goal    = VALUES(is_goal),
    note       = VALUES(note),
    updated_at = CURRENT_TIMESTAMP;


-- ✅ Insert or Update a diary entry (UPSERT)
INSERT INTO diary_entries (user_id, entry_date, content, mood)
VALUES (:user_id, :date, :content, :mood)
ON DUPLICATE KEY UPDATE
    content    = VALUES(content),
    mood       = VALUES(mood),
    updated_at = CURRENT_TIMESTAMP;


-- ✅ Delete a calendar entry
DELETE FROM calendar_entries
WHERE user_id = :user_id AND entry_date = :date;


-- ✅ Delete a diary entry
DELETE FROM diary_entries
WHERE user_id = :user_id AND entry_date = :date;


-- ✅ Get monthly stats (for the footer)
SELECT
    COUNT(CASE WHEN ce.is_marked = TRUE THEN 1 END) AS marked_count,
    COUNT(CASE WHEN ce.is_goal = TRUE THEN 1 END)   AS goal_count,
    COUNT(de.diary_id)                                AS diary_count
FROM calendar_entries ce
LEFT JOIN diary_entries de
    ON ce.user_id = de.user_id AND ce.entry_date = de.entry_date
WHERE ce.user_id = :user_id
  AND YEAR(ce.entry_date)  = :year
  AND MONTH(ce.entry_date) = :month;


-- ✅ Get all diary entries for a user (journal view)
SELECT entry_date, content, mood, created_at
FROM diary_entries
WHERE user_id = :user_id
ORDER BY entry_date DESC
LIMIT 30;


-- ✅ Search notes and diary by keyword
SELECT
    ce.entry_date,
    ce.note,
    de.content AS diary_content
FROM calendar_entries ce
LEFT JOIN diary_entries de
    ON ce.user_id = de.user_id AND ce.entry_date = de.entry_date
WHERE ce.user_id = :user_id
  AND (ce.note LIKE CONCAT('%', :keyword, '%')
       OR de.content LIKE CONCAT('%', :keyword, '%'))
ORDER BY ce.entry_date DESC;


-- ✅ Get goal achievement streak
SELECT entry_date
FROM calendar_entries
WHERE user_id = :user_id
  AND is_goal = TRUE
ORDER BY entry_date DESC;


-- ✅ Update user theme preference
UPDATE users
SET theme_pref = :theme_id
WHERE user_id = :user_id;


-- ═══════════════════════════════════════════════════════════════
-- POSTGRESQL ALTERNATIVE UPSERT SYNTAX
-- (Use these if you're on PostgreSQL instead of MySQL)
-- ═══════════════════════════════════════════════════════════════

-- INSERT INTO calendar_entries (user_id, entry_date, is_marked, mark_color, is_goal, note)
-- VALUES (:user_id, :date, :is_marked, :mark_color, :is_goal, :note)
-- ON CONFLICT (user_id, entry_date) DO UPDATE SET
--     is_marked  = EXCLUDED.is_marked,
--     mark_color = EXCLUDED.mark_color,
--     is_goal    = EXCLUDED.is_goal,
--     note       = EXCLUDED.note,
--     updated_at = CURRENT_TIMESTAMP;

-- INSERT INTO diary_entries (user_id, entry_date, content, mood)
-- VALUES (:user_id, :date, :content, :mood)
-- ON CONFLICT (user_id, entry_date) DO UPDATE SET
--     content    = EXCLUDED.content,
--     mood       = EXCLUDED.mood,
--     updated_at = CURRENT_TIMESTAMP;
