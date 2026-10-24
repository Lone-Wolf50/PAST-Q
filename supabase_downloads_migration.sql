-- ============================================================
-- Downloads Panel — Migration
-- Tracks papers downloaded by each user for the in-app panel
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS upsa_user_downloads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES upsa_users(id) ON DELETE CASCADE,
  paper_id      UUID NOT NULL REFERENCES upsa_papers(id) ON DELETE CASCADE,
  paper_title   TEXT,
  subject_name  TEXT,
  subject_code  TEXT,
  year          TEXT,
  semester      TEXT,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_download UNIQUE (user_id, paper_id)
);

ALTER TABLE upsa_user_downloads ENABLE ROW LEVEL SECURITY;

-- Users can only see their own downloads
CREATE POLICY "downloads_select_own"
  ON upsa_user_downloads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "downloads_write_service"
  ON upsa_user_downloads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Performance index
CREATE INDEX IF NOT EXISTS idx_user_downloads_user ON upsa_user_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_downloads_paper ON upsa_user_downloads(paper_id);
