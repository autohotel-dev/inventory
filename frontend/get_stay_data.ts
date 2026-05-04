import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('room_stays')
    .select(`
      id,
      sales_orders (
        id,
        shift_sessions (
          employees ( id, first_name, last_name )
        )
      )
    `)
    .limit(1);

  console.log(JSON.stringify({ data, error }, null, 2));
}
run();
