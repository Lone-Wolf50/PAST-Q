-- Create table for Hugging Face Inference API configuration
CREATE TABLE IF NOT EXISTS upsa_hf_config (
    id INT PRIMARY KEY DEFAULT 1,
    hf_api_key TEXT NOT NULL,
    model_names TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_row CHECK (id = 1) -- Enforces a single configuration row
);

-- Insert a default row with placeholders for the API Key and models list
INSERT INTO upsa_hf_config (id, hf_api_key, model_names)
VALUES (
    1, 
    'your_hugging_face_api_key_here', 
    'meta-llama/Llama-3.3-70B-Instruct, Qwen/Qwen2.5-72B-Instruct, deepseek-ai/DeepSeek-V3, mistralai/Mistral-7B-Instruct-v0.3'
)
ON CONFLICT (id) DO UPDATE 
SET updated_at = CURRENT_TIMESTAMP;
