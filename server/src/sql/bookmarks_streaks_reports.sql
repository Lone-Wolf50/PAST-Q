-- ─── Bookmarks (premium users only) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS upsa_bookmarks (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES upsa_users(id) ON DELETE CASCADE,
  paper_id   UUID        NOT NULL REFERENCES upsa_papers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, paper_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id  ON upsa_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_paper_id ON upsa_bookmarks(paper_id);

-- ─── Content / Paper reports (all users) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS upsa_paper_reports (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        REFERENCES upsa_users(id) ON DELETE SET NULL,
  paper_id   UUID        NOT NULL REFERENCES upsa_papers(id) ON DELETE CASCADE,
  reason     TEXT        NOT NULL,   -- 'blurry_pdf' | 'missing_pages' | 'wrong_paper' | 'other'
  details    TEXT,                   -- optional free-text from student
  status     TEXT        DEFAULT 'pending',  -- 'pending' | 'resolved' | 'dismissed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_paper_id ON upsa_paper_reports(paper_id);
CREATE INDEX IF NOT EXISTS idx_reports_status   ON upsa_paper_reports(status);

-- ─── Streak columns on upsa_users ───────────────────────────────────────────
ALTER TABLE upsa_users
  ADD COLUMN IF NOT EXISTS streak_count     INT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_last_date DATE;
