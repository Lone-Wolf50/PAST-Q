
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInsights() {
  const { data: insights, error } = await supabase
    .from('upsa_paper_insights')
    .select('*, upsa_papers(title)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching insights:', error);
    return;
  }

  console.log('Recent Insights:');
  console.log(JSON.stringify(insights, null, 2));

  const { data: notifications, error: nextError } = await supabase
    .from('upsa_admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (nextError) {
    console.error('Error fetching notifications:', nextError);
    return;
  }

  console.log('\nRecent Admin Notifications:');
  console.log(JSON.stringify(notifications, null, 2));
}

checkInsights();
