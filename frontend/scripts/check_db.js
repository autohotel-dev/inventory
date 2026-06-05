const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://plblcxppezsfxwqgbnrn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYmxjeHBwZXpzZnh3cWdibnJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA3MzU4NSwiZXhwIjoyMDc1NjQ5NTg1fQ.fuxbbycUhtUEjQEEr01aWXB7uq_-13W-tSjFk3TCpMU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    const { data, error } = await supabase.from('sensors').select('id, name, device_id, status, last_seen, is_open');
    if (error) {
        console.error(error);
        return;
    }
    console.log(`Found ${data.length} sensors in DB.`);
    console.log("First 5 sensors:");
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
    const online = data.filter(s => s.status === 'ONLINE').length;
    const offline = data.filter(s => s.status === 'OFFLINE').length;
    
    // Check last_seen times
    const staleCount = data.filter(s => {
        if (!s.last_seen) return true;
        return (Date.now() - new Date(s.last_seen).getTime()) > (24 * 3600 * 1000);
    }).length;
    
    console.log(`Summary: ONLINE=${online}, OFFLINE=${offline}, STALE (no signal > 24h)=${staleCount}`);
}

check();
