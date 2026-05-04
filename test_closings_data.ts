import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'frontend/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!);
async function run() {
  const { data, error } = await supabase
    .from("shift_closings")
    .select("id, period_start, period_end, status")
    .limit(5);
  console.log("Closings count:", data?.length);
  console.log("Closings:", data);
  console.log("Error:", error);
}
run();
