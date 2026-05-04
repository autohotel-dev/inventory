import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'frontend/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase
    .from("shift_closings")
    .select("id, shift_sessions!inner(id)")
    .limit(1);
  console.log("Error shift_sessions:", JSON.stringify(error, null, 2));

  const { data: d2, error: e2 } = await supabase
    .from("shift_closings")
    .select("id, employees!shift_closings_employee_id_fkey(first_name)")
    .limit(1);
  console.log("Error employees:", JSON.stringify(e2, null, 2));
}
run();
