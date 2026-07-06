-- SQL Migration: Run this in your Supabase SQL Editor

-- 1. Create table for storing verified questions
CREATE TABLE IF NOT EXISTS upsa_paper_questions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id    UUID NOT NULL REFERENCES upsa_papers(id) ON DELETE CASCADE,
    question_no INT NOT NULL,              -- ordering: 1, 2, 3...
    body        TEXT NOT NULL,             -- the question text
    sub_parts   JSONB DEFAULT '[]',        -- optional sub-parts: [{label: "a", text: "..."}]
    marks       INT,                       -- marks allocated (if visible on paper)
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paper_id, question_no)
);

-- 2. Enable Row Level Security (RLS)
-- With no policies defined, all direct client-side/anonymous reads/writes are blocked.
-- Our backend server will still be able to access the table fully because it uses the service_role key.
ALTER TABLE upsa_paper_questions ENABLE ROW LEVEL SECURITY;

-- 3. Add columns to upsa_papers to track scan/verification state
ALTER TABLE upsa_papers ADD COLUMN IF NOT EXISTS questions_verified BOOLEAN DEFAULT false;
ALTER TABLE upsa_papers ADD COLUMN IF NOT EXISTS questions_verified_at TIMESTAMPTZ;

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_paper_questions_paper ON upsa_paper_questions(paper_id);
