const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function addAiColumn() {
  console.log('Attempting to add ai_enabled column...');
  // Since we can't run raw SQL easily without RPC, we'll try to use a dummy update
  // to see if the column exists, and if not, we'll have to ask the user.
  // Actually, I'll try to use a common RPC name for SQL if it exists.
  
  const { data, error } = await supabase.from('upsa_users').select('ai_enabled').limit(1);
  
  if (error) {
    console.log('Column ai_enabled DOES NOT exist. Please run the SQL in Supabase dashboard:');
    console.log('ALTER TABLE upsa_users ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT true;');
  } else {
    console.log('Column ai_enabled ALREADY exists.');
  }
}

addAiColumn();
