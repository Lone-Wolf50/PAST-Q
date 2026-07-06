-- ============================================================
-- cron_failures table
-- Stores failed email deliveries from the biweekly digest cron
-- so they can be reviewed and retried from the admin dashboard.
-- ============================================================

CREATE TABLE IF NOT EXISTS cron_failures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  user_type     TEXT NOT NULL, -- 'active' or 'inactive'
  error_reason  TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by email
CREATE INDEX IF NOT EXISTS idx_cron_failures_email
  ON cron_failures (email);

-- Enable Row Level Security
ALTER TABLE cron_failures ENABLE ROW LEVEL SECURITY;

-- Only the service role (backend) can read/write
CREATE POLICY "cron_failures_service_all"
  ON cron_failures FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
