-- Add printer IP configuration columns to system_config
-- These allow managing printer IPs from the Settings UI instead of .env files

ALTER TABLE system_config
ADD COLUMN IF NOT EXISTS thermal_printer_ip TEXT DEFAULT '192.168.0.106',
ADD COLUMN IF NOT EXISTS thermal_printer_port INTEGER DEFAULT 9100,
ADD COLUMN IF NOT EXISTS hp_printer_ip TEXT DEFAULT '192.168.0.108',
ADD COLUMN IF NOT EXISTS hp_printer_port INTEGER DEFAULT 9100;

-- Update existing row with defaults
UPDATE system_config
SET 
    thermal_printer_ip = COALESCE(thermal_printer_ip, '192.168.0.106'),
    thermal_printer_port = COALESCE(thermal_printer_port, 9100),
    hp_printer_ip = COALESCE(hp_printer_ip, '192.168.0.108'),
    hp_printer_port = COALESCE(hp_printer_port, 9100);
