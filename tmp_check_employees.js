const url = "https://plblcxppezsfxwqgbnrn.supabase.co/rest/v1/employees?select=id,first_name,role,role_id,is_active,deleted_at";
const rolesUrl = "https://plblcxppezsfxwqgbnrn.supabase.co/rest/v1/roles?select=*";

async function run() {
  const headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYmxjeHBwZXpzZnh3cWdibnJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA3MzU4NSwiZXhwIjoyMDc1NjQ5NTg1fQ.fuxbbycUhtUEjQEEr01aWXB7uq_-13W-tSjFk3TCpMU",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYmxjeHBwZXpzZnh3cWdibnJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA3MzU4NSwiZXhwIjoyMDc1NjQ5NTg1fQ.fuxbbycUhtUEjQEEr01aWXB7uq_-13W-tSjFk3TCpMU"
  };

  try {
    const rolesRes = await fetch(rolesUrl, { headers });
    const roles = await rolesRes.json();
    console.log("ROLES:");
    console.log(roles);

    const empRes = await fetch(url, { headers });
    const emps = await empRes.json();
    console.log("EMPLOYEES:");
    console.log(emps);
    
    // Test the RPC
    const rpcUrl = "https://plblcxppezsfxwqgbnrn.supabase.co/rest/v1/rpc/get_cochero_performance_kpis";
    const rpcRes = await fetch(rpcUrl, { 
      method: 'POST',
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_start_date: "2020-01-01", p_end_date: "2030-01-01" })
    });
    const rpcData = await rpcRes.json();
    console.log("RPC RESULT:");
    console.log(rpcData);

  } catch (e) {
    console.error(e);
  }
}
run();
