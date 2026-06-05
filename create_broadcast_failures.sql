-- ============================================================
-- broadcast_failures table
-- Stores failed email deliveries per broadcast run so they
-- can be retried from the Admin Broadcast UI.
-- Run this script once in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS broadcast_failures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id  UUID NOT NULL,
  email         TEXT NOT NULL,
  error_reason  TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by broadcast_id
CREATE INDEX IF NOT EXISTS idx_broadcast_failures_broadcast_id
  ON broadcast_failures (broadcast_id);

-- Enable Row Level Security
ALTER TABLE broadcast_failures ENABLE ROW LEVEL SECURITY;

-- Only the service role (backend) can read/write
CREATE POLICY "broadcast_failures_service_all"
  ON broadcast_failures FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
