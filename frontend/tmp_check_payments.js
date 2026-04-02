import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPayments() {
  console.log("Fetching payments for exactly 2026-03-30 00:00:00 to 01:00:00");
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, payment_method, status, shift_session_id, parent_payment_id, created_at, card_last_4, concept")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching", error);
    return;
  }
  
  const bbvaPayments = data.filter(p => true);
  console.log(`Found ${data.length} total payments.`);
  console.table(bbvaPayments);
}

checkPayments();
