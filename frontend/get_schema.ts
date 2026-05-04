import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
async function run() {
  const { data, error } = await supabase.from('sales_orders').select('*').limit(5);
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
  } else {
    console.log("No data or error:", error);
  }
}
run();
