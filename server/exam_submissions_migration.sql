-- ============================================================================
-- Student Exam Paper Submissions  (run once in Supabase → SQL Editor)
-- ============================================================================
-- Premium rewards reuse the EXISTING temp-plan system on upsa_users
-- (original_plan + temp_plan_expires_at, auto-reverted by revertExpiredTempPlans),
-- so no new premium columns or crons are required.
-- ============================================================================

CREATE TABLE IF NOT EXISTS upsa_exam_submissions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_id         TEXT NOT NULL UNIQUE,                 -- 8-char code used in Telegram commands
    user_id          UUID NOT NULL REFERENCES upsa_users(id) ON DELETE CASCADE,
    user_email       TEXT NOT NULL,

    -- Final metadata (student input wins, AI fills the gaps)
    subject_name     TEXT,
    course_code      TEXT,
    year             TEXT,
    semester         TEXT,
    exam_type        TEXT,
    description      TEXT,                                 -- student's optional note

    -- Raw AI output (separate EXAM_UPLOAD_AI_KEY)
    ai_metadata      JSONB,
    ai_confidence    TEXT,

    -- File
    storage_path     TEXT NOT NULL,                        -- path inside the `student-uploads` bucket
    file_hash        TEXT NOT NULL,                        -- sha256 of the PDF (duplicate detection)
    file_size        INT,
    photo_count      INT NOT NULL DEFAULT 1,

    -- Review
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes      TEXT,                                 -- rejection reason
    premium_hours    INT NOT NULL DEFAULT 0,               -- hours actually granted on approval
    premium_plan     TEXT,                                 -- plan granted on approval
    submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exam_sub_user      ON upsa_exam_submissions(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_sub_status    ON upsa_exam_submissions(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_sub_file_hash ON upsa_exam_submissions(file_hash);

-- Lock the table down: only the backend (service role) may read/write it.
ALTER TABLE upsa_exam_submissions ENABLE ROW LEVEL SECURITY;

-- Lifetime counter shown to admins
ALTER TABLE upsa_users ADD COLUMN IF NOT EXISTS approved_submissions_count INT NOT NULL DEFAULT 0;
