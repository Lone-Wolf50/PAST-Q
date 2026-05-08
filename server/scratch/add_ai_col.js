require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_query: 'ALTER TABLE upsa_users ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT true;' 
  });
  
  if (error) {
    console.error('Error:', error);
    // If rpc fails, try a direct query if the library allows (supabase-js doesn't support raw SQL easily without RPC)
    console.log('Falling back to a simple select to check if column exists...');
    const { data: users, error: selectError } = await supabase.from('upsa_users').select('ai_enabled').limit(1);
    if (selectError) {
      console.log('Column ai_enabled does not exist yet.');
    } else {
      console.log('Column ai_enabled already exists.');
    }
  } else {
    console.log('Success:', data);
  }
}

run();
