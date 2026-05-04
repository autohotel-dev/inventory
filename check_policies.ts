import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'frontend/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'shift_closings' });
  if (error) {
    // If RPC doesn't exist, try querying pg_policies directly
    const { data: policies, error: polErr } = await supabase.from('pg_policies').select('*').eq('tablename', 'shift_closings');
    console.log("Policies:", policies, polErr);
  } else {
    console.log("Policies:", data);
  }
}
run();
