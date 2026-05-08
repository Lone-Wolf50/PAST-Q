-- Table to store AI-generated insights for past papers
CREATE TABLE IF NOT EXISTS upsa_paper_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES upsa_papers(id) ON DELETE CASCADE,
  summary TEXT,
  topics JSONB DEFAULT '[]',
  hardest_question TEXT,
  exam_tips TEXT,
  difficulty TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by paper_id
CREATE INDEX IF NOT EXISTS idx_paper_insights_paper_id ON upsa_paper_insights(paper_id);

-- Enable Row Level Security
ALTER TABLE upsa_paper_insights ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users (Students) can READ insights
CREATE POLICY "Students can view paper insights" 
ON upsa_paper_insights FOR SELECT 
TO authenticated 
USING (true);

-- Note: Admin/Backend modifications are handled via Service Role Key (bypasses RLS)
