import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'frontend/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!);
async function run() {
  const { data, error } = await supabase
    .from("shift_closings")
    .select("id, period_start, period_end, total_cash, total_card_bbva, total_card_getnet, total_sales, total_transactions, counted_cash, cash_difference, notes, status, employee_id, shift_session_id, employees(first_name, last_name), shift_sessions(shift_definitions(name))")
    .limit(1);
  console.log("Error:", JSON.stringify(error, null, 2));
}
run();
