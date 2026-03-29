-- =====================================================
-- SISTEMA DE TURNOS, EMPLEADOS Y CORTES DE CAJA
-- =====================================================
-- Este script crea las tablas necesarias para:
-- 1. Gestión de empleados (recepcionistas)
-- 2. Definición de turnos (Mañana, Tarde, Noche)
-- 3. Calendario de horarios asignados
-- 4. Terminales de pago (BBVA, GETNET)
-- 5. Cortes de caja por turno

-- =====================================================
-- 0. FUNCIÓN PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 1. TABLA DE EMPLEADOS
-- =====================================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Vincula con usuario de Supabase Auth
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL DEFAULT 'receptionist' CHECK (role IN ('admin', 'receptionist', 'manager')),
  is_active BOOLEAN DEFAULT true,
  pin_code VARCHAR(6), -- PIN opcional para acceso rápido
  avatar_url TEXT,
  hired_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_employees_auth_user ON employees(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at 
  BEFORE UPDATE ON employees 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE employees IS 'Empleados del sistema (recepcionistas, administradores)';
COMMENT ON COLUMN employees.auth_user_id IS 'ID del usuario en Supabase Auth para vincular login';
COMMENT ON COLUMN employees.role IS 'Rol: admin (todo), manager (gestión), receptionist (operación)';
COMMENT ON COLUMN employees.pin_code IS 'PIN de 4-6 dígitos para acceso rápido opcional';

-- =====================================================
-- 2. TABLA DE DEFINICIÓN DE TURNOS
-- =====================================================
CREATE TABLE IF NOT EXISTS shift_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL, -- Mañana, Tarde, Noche
  code VARCHAR(20) UNIQUE NOT NULL, -- MORNING, AFTERNOON, NIGHT
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  crosses_midnight BOOLEAN DEFAULT false, -- true para turno nocturno
  color VARCHAR(7) DEFAULT '#3B82F6', -- Color para UI
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar turnos predefinidos
INSERT INTO shift_definitions (name, code, start_time, end_time, crosses_midnight, color) VALUES
  ('Mañana', 'MORNING', '06:00:00', '14:00:00', false, '#F59E0B'),
  ('Tarde', 'AFTERNOON', '14:00:00', '22:00:00', false, '#3B82F6'),
  ('Noche', 'NIGHT', '22:00:00', '06:00:00', true, '#8B5CF6')
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE shift_definitions IS 'Definición de los turnos disponibles';
COMMENT ON COLUMN shift_definitions.crosses_midnight IS 'Indica si el turno cruza la medianoche (ej: 22:00 a 06:00)';

-- =====================================================
-- 3. TABLA DE HORARIOS ASIGNADOS (CALENDARIO)
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_definition_id UUID NOT NULL REFERENCES shift_definitions(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL, -- Fecha específica del turno
  is_day_off BOOLEAN DEFAULT false, -- true = día de descanso
  notes TEXT, -- Notas opcionales
  created_by UUID REFERENCES employees(id), -- Quién asignó el turno
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Un empleado solo puede tener un turno por día
  UNIQUE(employee_id, schedule_date)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_schedules_employee ON employee_schedules(employee_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON employee_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedules_shift ON employee_schedules(shift_definition_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date_shift ON employee_schedules(schedule_date, shift_definition_id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_schedules_updated_at ON employee_schedules;
CREATE TRIGGER update_schedules_updated_at 
  BEFORE UPDATE ON employee_schedules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE employee_schedules IS 'Calendario de turnos asignados a cada empleado';
COMMENT ON COLUMN employee_schedules.is_day_off IS 'Marca el día como descanso para el empleado';

-- =====================================================
-- 4. TABLA DE TERMINALES DE PAGO
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL, -- BBVA, GETNET
  code VARCHAR(20) UNIQUE NOT NULL, -- BBVA, GETNET
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar terminales predefinidas
INSERT INTO payment_terminals (name, code, description) VALUES
  ('BBVA', 'BBVA', 'Terminal de pago BBVA Bancomer'),
  ('GETNET', 'GETNET', 'Terminal de pago Getnet Santander')
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE payment_terminals IS 'Terminales de pago disponibles para cobros con tarjeta';

-- =====================================================
-- 5. MODIFICAR TABLA DE PAGOS - Agregar terminal y empleado
-- =====================================================
-- Agregar columna para terminal de pago (solo aplica cuando payment_method = 'TARJETA')
ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES payment_terminals(id);

-- Agregar columna para código de terminal (alternativa más simple)
ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS terminal_code VARCHAR(20);

-- Agregar columna para empleado que procesó el pago
ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id);

-- Índices adicionales
CREATE INDEX IF NOT EXISTS idx_payments_terminal ON payments(terminal_id);
CREATE INDEX IF NOT EXISTS idx_payments_terminal_code ON payments(terminal_code);
CREATE INDEX IF NOT EXISTS idx_payments_employee ON payments(employee_id);

COMMENT ON COLUMN payments.terminal_id IS 'Terminal usada cuando el pago es con tarjeta (referencia UUID)';
COMMENT ON COLUMN payments.terminal_code IS 'Código de terminal: BBVA o GETNET';
COMMENT ON COLUMN payments.employee_id IS 'Empleado que procesó el pago';

-- =====================================================
-- 6. TABLA DE SESIONES DE TURNO (CLOCK IN/OUT)
-- =====================================================
CREATE TABLE IF NOT EXISTS shift_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_definition_id UUID NOT NULL REFERENCES shift_definitions(id),
  schedule_id UUID REFERENCES employee_schedules(id), -- Referencia al horario programado
  clock_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  clock_out_at TIMESTAMP WITH TIME ZONE, -- NULL si aún está activo
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_shift_sessions_employee ON shift_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_status ON shift_sessions(status);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_clock_in ON shift_sessions(clock_in_at);

COMMENT ON TABLE shift_sessions IS 'Registro de entrada/salida de empleados por turno';
COMMENT ON COLUMN shift_sessions.clock_in_at IS 'Hora real de entrada del empleado';
COMMENT ON COLUMN shift_sessions.clock_out_at IS 'Hora real de salida (NULL = turno activo)';

-- =====================================================
-- 7. TABLA DE CORTES DE CAJA
-- =====================================================
CREATE TABLE IF NOT EXISTS shift_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_session_id UUID NOT NULL REFERENCES shift_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  shift_definition_id UUID NOT NULL REFERENCES shift_definitions(id),
  
  -- Período del corte
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Totales calculados del sistema
  total_cash DECIMAL(12, 2) DEFAULT 0, -- Total en efectivo
  total_card_bbva DECIMAL(12, 2) DEFAULT 0, -- Total tarjeta BBVA
  total_card_getnet DECIMAL(12, 2) DEFAULT 0, -- Total tarjeta GETNET
  total_sales DECIMAL(12, 2) DEFAULT 0, -- Total de ventas
  total_transactions INTEGER DEFAULT 0, -- Número de transacciones
  
  -- Conteo físico del empleado
  counted_cash DECIMAL(12, 2), -- Efectivo contado físicamente
  cash_difference DECIMAL(12, 2), -- Diferencia (counted - expected)
  
  -- Desglose de billetes/monedas (opcional, JSON)
  cash_breakdown JSONB,
  
  -- Estado y notas
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reviewed')),
  notes TEXT,
  reviewed_by UUID REFERENCES employees(id), -- Admin que revisó
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_closings_session ON shift_closings(shift_session_id);
CREATE INDEX IF NOT EXISTS idx_closings_employee ON shift_closings(employee_id);
CREATE INDEX IF NOT EXISTS idx_closings_period ON shift_closings(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_closings_status ON shift_closings(status);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_closings_updated_at ON shift_closings;
CREATE TRIGGER update_closings_updated_at 
  BEFORE UPDATE ON shift_closings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE shift_closings IS 'Cortes de caja al final de cada turno';
COMMENT ON COLUMN shift_closings.cash_breakdown IS 'Desglose de billetes: {"1000": 2, "500": 5, "200": 3, ...}';
COMMENT ON COLUMN shift_closings.cash_difference IS 'Positivo = sobrante, Negativo = faltante';

-- =====================================================
-- 8. TABLA DE DETALLE DE TRANSACCIONES DEL CORTE
-- =====================================================
CREATE TABLE IF NOT EXISTS shift_closing_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_closing_id UUID NOT NULL REFERENCES shift_closings(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id),
  sales_order_id UUID REFERENCES sales_orders(id),
  amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  terminal_code VARCHAR(20), -- BBVA o GETNET si aplica
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_closing_details_closing ON shift_closing_details(shift_closing_id);
CREATE INDEX IF NOT EXISTS idx_closing_details_payment ON shift_closing_details(payment_id);

COMMENT ON TABLE shift_closing_details IS 'Detalle de cada transacción incluida en un corte de caja';

-- =====================================================
-- 9. HABILITAR RLS (Row Level Security)
-- =====================================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_closing_details ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Allow all on employees" ON employees;
DROP POLICY IF EXISTS "Allow all on shift_definitions" ON shift_definitions;
DROP POLICY IF EXISTS "Allow all on employee_schedules" ON employee_schedules;
DROP POLICY IF EXISTS "Allow all on payment_terminals" ON payment_terminals;
DROP POLICY IF EXISTS "Allow all on shift_sessions" ON shift_sessions;
DROP POLICY IF EXISTS "Allow all on shift_closings" ON shift_closings;
DROP POLICY IF EXISTS "Allow all on shift_closing_details" ON shift_closing_details;

-- Políticas básicas (permitir todo para usuarios autenticados)
CREATE POLICY "Allow all on employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on shift_definitions" ON shift_definitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on employee_schedules" ON employee_schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on payment_terminals" ON payment_terminals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on shift_sessions" ON shift_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on shift_closings" ON shift_closings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on shift_closing_details" ON shift_closing_details FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 10. FUNCIÓN PARA OBTENER TURNO ACTUAL
-- =====================================================
CREATE OR REPLACE FUNCTION get_current_shift()
RETURNS TABLE (
  shift_id UUID,
  shift_name VARCHAR(50),
  shift_code VARCHAR(20),
  start_time TIME,
  end_time TIME,
  color VARCHAR(7)
) AS $$
DECLARE
  current_time_val TIME := CURRENT_TIME;
BEGIN
  RETURN QUERY
  SELECT 
    sd.id,
    sd.name,
    sd.code,
    sd.start_time,
    sd.end_time,
    sd.color
  FROM shift_definitions sd
  WHERE sd.is_active = true
    AND (
      -- Turno normal (no cruza medianoche)
      (sd.crosses_midnight = false AND current_time_val >= sd.start_time AND current_time_val < sd.end_time)
      OR
      -- Turno nocturno (cruza medianoche)
      (sd.crosses_midnight = true AND (current_time_val >= sd.start_time OR current_time_val < sd.end_time))
    )
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_shift IS 'Retorna el turno activo según la hora actual';

-- =====================================================
-- 11. FUNCIÓN PARA OBTENER EMPLEADO EN TURNO ACTUAL
-- =====================================================
CREATE OR REPLACE FUNCTION get_current_shift_employee()
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  shift_name VARCHAR(50),
  shift_code VARCHAR(20),
  session_id UUID,
  clock_in_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    (e.first_name || ' ' || e.last_name)::TEXT,
    sd.name,
    sd.code,
    ss.id,
    ss.clock_in_at
  FROM shift_sessions ss
  JOIN employees e ON e.id = ss.employee_id
  JOIN shift_definitions sd ON sd.id = ss.shift_definition_id
  WHERE ss.status = 'active'
    AND ss.clock_out_at IS NULL
  ORDER BY ss.clock_in_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_shift_employee IS 'Retorna el empleado actualmente en turno';

-- =====================================================
-- 12. FUNCIÓN PARA CALCULAR TOTALES DE CORTE
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_shift_totals(
  p_employee_id UUID,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  total_cash DECIMAL(12, 2),
  total_card_bbva DECIMAL(12, 2),
  total_card_getnet DECIMAL(12, 2),
  total_sales DECIMAL(12, 2),
  total_transactions INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN p.payment_method = 'EFECTIVO' THEN p.amount ELSE 0 END), 0)::DECIMAL(12,2),
    COALESCE(SUM(CASE WHEN p.payment_method = 'TARJETA' AND pt.code = 'BBVA' THEN p.amount ELSE 0 END), 0)::DECIMAL(12,2),
    COALESCE(SUM(CASE WHEN p.payment_method = 'TARJETA' AND pt.code = 'GETNET' THEN p.amount ELSE 0 END), 0)::DECIMAL(12,2),
    COALESCE(SUM(p.amount), 0)::DECIMAL(12,2),
    COUNT(p.id)::INTEGER
  FROM payments p
  LEFT JOIN payment_terminals pt ON pt.id = p.terminal_id
  WHERE p.employee_id = p_employee_id
    AND p.created_at >= p_period_start
    AND p.created_at < p_period_end;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_shift_totals IS 'Calcula los totales de pagos para un período de turno';

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
