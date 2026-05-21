const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'frontend/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT pg_get_functiondef(p.oid) 
      FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'public' AND p.proname = 'get_income_report';
    `
  });

  if (error) {
    console.error("Error executing query:", error);
    // Let's try to query via information_schema or direct query if execute_sql doesn't exist
    console.log("Retrying with a direct select if execute_sql is not available...");
    // Since we cannot run raw sql via standard api easily unless there is an RPC, we will try to look for execute_sql.
  } else {
    console.log("Function Definition:");
    console.log(data);
  }
}

main();
