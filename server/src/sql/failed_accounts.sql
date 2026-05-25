-- Run this once in the Supabase SQL Editor.
CREATE TABLE IF NOT EXISTS upsa_failed_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    full_name TEXT,
    reason TEXT,
    failed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for sorting by failure time
CREATE INDEX IF NOT EXISTS idx_failed_accounts_failed_at ON upsa_failed_accounts(failed_at DESC);

-- Enable Row Level Security (RLS) to secure emails and names from public API access.
-- Because the Node.js backend uses the service_role key, it will bypass RLS.
-- Leaving RLS enabled with NO policies blocks all anon/authenticated client-side access.
ALTER TABLE upsa_failed_accounts ENABLE ROW LEVEL SECURITY;
