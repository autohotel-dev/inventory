"""
Tuya Local Polling Script (Python/TinyTuya)
Comunicación persistente (PUSH) con Gateway Zigbee
Sincronización automática con Supabase y devices.json local.

Ejecutar con: python scripts/tuya-poll-local.py
"""

import tinytuya
import time
import json
import os
from datetime import datetime

# Supabase client (we'll use requests for simplicity)
import requests

# --- CONFIGURATION ---
HEARTBEAT_INTERVAL = 9
RECONNECT_DELAY = 5
DEVICES_JSON_PATH = os.path.join("C:\\tuya-tools", "devices.json")

# Load environment variables from .env.local
def load_env():
    env = {}
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
    try:
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    value = value.strip().strip('"').strip("'")
                    env[key.strip()] = value
    except FileNotFoundError:
        print(f"Warning: {env_path} not found")
    return env

env = load_env()

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or env.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('SUPABASE_SERVICE_ROLE_KEY')

# Global State
GATEWAY_CONFIG = {
    'id': 'eb752faeb525ac46057p0t',
    'key': '3{;8f0U4XLXwV#EY',
    'ip': '172.16.1.99',
    'version': '3.4'
}

# Mappings
# node_id_map: Maps Zigbee Node ID ('cid') -> Tuya Virtual ID ('device_id')
node_id_map = {} 

# db_sensors: Maps Tuya Virtual ID ('device_id') -> DB Sensor Info
db_sensors = {}

state_cache = {}

# --- HELPER FUNCTIONS ---

def load_local_devices_mapping():
    """Load devices.json to map Node IDs (cid) to Virtual IDs (device_id)"""
    global node_id_map
    try:
        if os.path.exists(DEVICES_JSON_PATH):
            with open(DEVICES_JSON_PATH, 'r', encoding='utf-8') as f:
                devices = json.load(f)
                count = 0
                for dev in devices:
                    # If it has a node_id, it interprets data via Gateway
                    if 'node_id' in dev and 'id' in dev:
                        node_id_map[dev['node_id']] = dev['id']
                        count += 1
                print(f"[Init] Loaded {count} sub-device mappings from devices.json")
        else:
            print(f"[Init] Warning: {DEVICES_JSON_PATH} not found. Sub-device mapping might fail.")
    except Exception as e:
        print(f"[Init] Error loading devices.json: {e}")

def supabase_request(method, endpoint, data=None):
    if not SUPABASE_URL or not SUPABASE_KEY: return None
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers)
        elif method == 'PATCH':
            response = requests.patch(url, headers=headers, json=data)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=data)
        
        if response.status_code in [200, 201]:
            return response.json() if response.content else None
    except Exception as e:
        print(f"[Supabase] Error: {e}")
        return None

def fetch_sensors_from_db():
    """Refresh sensor list from Supabase"""
    global db_sensors
    try:
        data = supabase_request('GET', 'sensors?select=id,device_id,name,is_open')
        if data:
            new_map = {}
            for s in data:
                if s.get('device_id'):
                    new_map[s['device_id']] = s
            
            # Log only if count changed
            if len(new_map) != len(db_sensors):
                print(f"[DB] Synced {len(new_map)} sensors from database.")
                print(f"[DB] Known IDs: {list(new_map.keys())}")
            
            db_sensors = new_map
    except Exception as e:
        print(f"[DB] Error fetching sensors: {e}")

def update_sensor_in_db(virtual_id, is_open):
    """Update sensor status in Supabase"""
    if virtual_id not in db_sensors:
        # Sensor detected but not in DB -> Optional: Auto-create? For now just ignore or log.
        print(f"[DB] Ignored update for unknown sensor ID: {virtual_id}")
        return

    sensor = db_sensors[virtual_id]
    
    # Optimistic update local cache
    sensor['is_open'] = is_open
    
    update_data = {
        'is_open': is_open,
        'last_seen': datetime.now().isoformat(),
        'status': 'ONLINE'
    }
    
    # Fire and forget (or await if async)
    supabase_request('PATCH', f'sensors?device_id=eq.{virtual_id}', update_data)
    
    status_str = 'OPEN' if is_open else 'CLOSED'
    print(f"[DB] {sensor.get('name', virtual_id)} -> {status_str}")
    
    # Log event
    log_sensor_event(sensor.get('id'), is_open)

def log_sensor_event(sensor_db_id, is_open):
    if not sensor_db_id: return
    event_data = {
        'sensor_id': sensor_db_id,
        'event_type': 'OPEN' if is_open else 'CLOSE',
        'payload': json.dumps({'source': 'local_push_v2'}),
        'timestamp': datetime.now().isoformat()
    }
    supabase_request('POST', 'sensor_events', event_data)

# --- PROCESSING ---
def process_data(data):
    """Process incoming data packet from Gateway"""
    global state_cache

    # 1. Extract payload
    payload = None
    if 'dps' in data:
        payload = data
    elif 'result' in data and 'dps' in data['result']:
        payload = data['result']
        
    if not payload: return

    dps = payload.get('dps', {})
    
    # Intenta obtener CID de varias ubicaciones posibles
    cid = payload.get('cid')
    if not cid and 'data' in data and isinstance(data['data'], dict):
        cid = data['data'].get('cid')
    
    # Debug log for analysis
    # print(f"[DEBUG] Processing: CID={cid} DPS={dps}")

    target_virtual_id = None

    # Strategy A: Use CID to map to Virtual ID
    if cid:
        if cid in node_id_map:
            target_virtual_id = node_id_map[cid]
        else:
            # New device not in json?
            pass
            
    # Strategy B: If no CID, usually it's the Gateway itself OR a direct-mapped sub-device
    # For now, if no CID, we check if it matches our known test sensor logic (Gateway spoofing)
    if not target_virtual_id:
        # Fallback for the test sensor if cid is missing but dps '101' is present
        # (This matches your previous successful test)
        if '101' in dps:
             # Assume it's the default door sensor if single
             # But careful with 50 sensors!
             # Ideally we should ALWAYS see CID for sub-devices.
             pass
    
    # If we still don't have a specific ID, but we have a known Hardcoded fallback from previous test
    if not target_virtual_id and '101' in dps:
        # HARDCODED FALLBACK for the specific test sensor `eb4f3a...`
        # ONLY if we can't find it via CID.
        # Check if we have that sensor in DB
        test_id = 'eb4f3a0f8e79e8e96fsovm'
        if test_id in db_sensors:
            target_virtual_id = test_id

    if not target_virtual_id:
        return

    # Process DPS for the target sensor
    # Adjust DPS codes if needed (101=Door, 103=Battery)
    if '101' in dps or 101 in dps:
        val = dps.get('101') if '101' in dps else dps.get(101)
        is_open = (val == True or str(val).lower() == 'true')
        
        cache_key = f"{target_virtual_id}_state"
        last_state = state_cache.get(cache_key)
        
        if last_state != val:
            state_cache[cache_key] = val
            sensor_name = db_sensors.get(target_virtual_id, {}).get('name', 'Unknown')
            print(f"*** [EVENTO] {sensor_name}: {'ABIERTO' if is_open else 'CERRADO'} ***")
            update_sensor_in_db(target_virtual_id, is_open)

def main():
    print("=" * 50)
    print("=== Tuya LOCAL SENSOR HUB (Auto-Sync) ===")
    print("=========================================")
    print(f"Gateway IP: {GATEWAY_CONFIG['ip']}")
    
    # 1. Load Mappings
    load_local_devices_mapping()
    
    # 2. Sync DB
    fetch_sensors_from_db()

    print("[INFO] Connecting to Gateway...")
    d = tinytuya.Device(
        dev_id=GATEWAY_CONFIG['id'],
        address=GATEWAY_CONFIG['ip'],
        local_key=GATEWAY_CONFIG['key'],
        version=float(GATEWAY_CONFIG['version'])
    )
    
    d.set_socketPersistent(True)
    d.set_socketRetryLimit(1)
    d.set_socketTimeout(HEARTBEAT_INTERVAL + 2) 

    print("[INFO] Listening... (Auto-refreshing DB every 60s)")

    last_heartbeat = time.time()
    last_db_refresh = time.time()

    while True:
        try:
            # Receive
            data = d.receive()
            if data:
                # DEBUG - Ver todo lo que entra
                # print(f"[RAW] {data}")
                process_data(data)
            
            now = time.time()
            
            # Heartbeat
            if now - last_heartbeat > HEARTBEAT_INTERVAL:
                d.send(d.generate_payload(tinytuya.DP_QUERY))
                last_heartbeat = now
                
            # DB Refresh
            if now - last_db_refresh > 60:
                fetch_sensors_from_db()
                last_db_refresh = now
                
        except KeyboardInterrupt:
            print("\n[STOP] Stopping...")
            break
        except Exception as e:
            # print(f"[Connection Error] {e}")
            time.sleep(1)
            try: d.set_socketPersistent(True) 
            except: pass

if __name__ == '__main__':
    main()
