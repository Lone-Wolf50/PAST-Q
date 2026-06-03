-- ============================================================
-- PASTY Quiz System - Supabase Schema Migration
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. Patch upsa_subjects: add unique constraint on name
--    (safe to run even if it already exists)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'upsa_subjects_name_key'
  ) THEN
    ALTER TABLE upsa_subjects ADD CONSTRAINT upsa_subjects_name_key UNIQUE (name);
  END IF;
END $$;

-- ============================================================
-- 3. Patch upsa_users: add quiz-related columns
-- ============================================================
ALTER TABLE upsa_users ADD COLUMN IF NOT EXISTS total_points    INT DEFAULT 0;
ALTER TABLE upsa_users ADD COLUMN IF NOT EXISTS username         TEXT;
ALTER TABLE upsa_users ADD COLUMN IF NOT EXISTS last_login_at   TIMESTAMP WITH TIME ZONE;
ALTER TABLE upsa_users ADD COLUMN IF NOT EXISTS login_streak     INT DEFAULT 0;

-- Backfill username for any existing rows
UPDATE upsa_users
SET username = COALESCE(full_name, split_part(email, '@', 1))
WHERE username IS NULL;

-- ============================================================
-- 4. upsa_questions
-- ============================================================
CREATE TABLE IF NOT EXISTS upsa_questions (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    body               TEXT NOT NULL,
    category           TEXT NOT NULL REFERENCES upsa_subjects(name) ON UPDATE CASCADE,
    difficulty         TEXT NOT NULL,
    correct_answer     TEXT NOT NULL,
    options            JSONB NOT NULL,
    time_limit_seconds INT NOT NULL DEFAULT 30,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE upsa_questions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read questions (via API calls)
CREATE POLICY "questions_select_authenticated"
  ON upsa_questions FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update/delete (backend only)
CREATE POLICY "questions_write_service"
  ON upsa_questions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 5. upsa_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS upsa_sessions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID REFERENCES upsa_users(id) ON DELETE CASCADE,
    subject          TEXT REFERENCES upsa_subjects(name) ON UPDATE CASCADE,
    started_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    questions_shown  JSONB NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE upsa_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "sessions_select_own"
  ON upsa_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "sessions_write_service"
  ON upsa_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 6. upsa_submissions
-- ============================================================
CREATE TABLE IF NOT EXISTS upsa_submissions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID REFERENCES upsa_users(id) ON DELETE CASCADE,
    question_id      UUID REFERENCES upsa_questions(id) ON DELETE CASCADE,
    submitted_answer TEXT NOT NULL,
    time_taken_ms    INT NOT NULL,
    is_correct       BOOLEAN NOT NULL,
    points_awarded   NUMERIC NOT NULL,
    submitted_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE upsa_submissions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own submissions
CREATE POLICY "submissions_select_own"
  ON upsa_submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "submissions_write_service"
  ON upsa_submissions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 7. upsa_user_badges
-- ============================================================
CREATE TABLE IF NOT EXISTS upsa_user_badges (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID REFERENCES upsa_users(id) ON DELETE CASCADE,
    badge_slug TEXT NOT NULL,
    earned_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_badge UNIQUE (user_id, badge_slug)
);

ALTER TABLE upsa_user_badges ENABLE ROW LEVEL SECURITY;

-- Users can see their own badges
CREATE POLICY "badges_select_own"
  ON upsa_user_badges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "badges_write_service"
  ON upsa_user_badges FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 8. upsa_leaderboard_snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS upsa_leaderboard_snapshots (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID REFERENCES upsa_users(id) ON DELETE CASCADE,
    period     TEXT NOT NULL,
    score      NUMERIC NOT NULL,
    rank       INT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE upsa_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

-- Leaderboard is public — any authenticated user can read all rows
CREATE POLICY "leaderboard_select_authenticated"
  ON upsa_leaderboard_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "leaderboard_write_service"
  ON upsa_leaderboard_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 9. Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_submissions_user_id   ON upsa_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_question   ON upsa_submissions(question_id);
CREATE INDEX IF NOT EXISTS idx_badges_user_id         ON upsa_user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period     ON upsa_leaderboard_snapshots(period, score DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id       ON upsa_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_category     ON upsa_questions(category);
