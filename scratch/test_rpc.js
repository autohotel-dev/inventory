const url = 'https://plblcxppezsfxwqgbnrn.supabase.co/rest/v1/rpc/get_income_report';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYmxjeHBwZXpzZnh3cWdibnJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNzM1ODUsImV4cCI6MjA3NTY0OTU4NX0.nWDC1RWVGO3QZnZK8kmnMyZlgTaInZrIe4gA71Gyh7s';

async function test() {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_report_type: 'shift',
        p_shift_id: '97cdf8dc-cc83-4db2-8d8c-e3c50c83576a',
        p_start_date: null,
        p_end_date: null,
        p_payment_method_filter: 'all',
        p_room_filter: 'all',
        p_status_filter: 'all',
        p_page: 1,
        p_page_size: 50
      })
    });
    const rpcResult = await response.json();
    console.log("RPC Status:", response.status);
    console.log("RPC keys:", Object.keys(rpcResult));
    
    // Exact mapping from use-income-report.ts
    const processedEntries = (rpcResult?.entries || []).map((e) => ({
        no: Number(e.no),
        time: e.time || '',
        vehicle_plate: e.vehicle_plate || '',
        room_number: e.room_number || '',
        room_price: Number(e.room_price) || 0,
        extra: Number(e.extra) || 0,
        consumption: Number(e.consumption) || 0,
        total: Number(e.total) || 0,
        payment_method: e.payment_method || 'PENDIENTE',
        card_type: e.card_type,
        card_last_4: e.card_last_4,
        terminal_code: e.terminal_code,
        stay_status: e.stay_status,
        checkout_valet_name: e.checkout_valet_name || '—',
        receptionist_name: e.receptionist_name || '—',
        shift_name: e.shift_name || '—',
        payments: (e.payments || []).map((p) => ({
            payment_method: p.payment_method,
            amount: Number(p.amount) || 0,
            card_type: p.card_type,
            card_last_4: p.card_last_4,
            terminal_code: p.terminal_code,
        })),
    }));

    console.log("Processed entries length:", processedEntries.length);
    console.log("First processed entry:", processedEntries[0]);
  } catch (err) {
    console.error("Mapping error:", err);
  }
}

test();
