-- Migration: Clean recreate employee_movements table
-- This will drop everything and recreate from scratch

-- Drop only employee_movements specific objects (don't drop shared functions)
DROP TRIGGER IF EXISTS log_payment_trigger ON payments;
DROP TRIGGER IF EXISTS log_room_stay_check_in_trigger ON room_stays;
DROP TRIGGER IF EXISTS update_employee_movements_updated_at ON employee_movements;
DROP FUNCTION IF EXISTS log_payment();
DROP FUNCTION IF EXISTS log_room_stay_check_in();
DROP FUNCTION IF EXISTS log_employee_movement(UUID);
DROP FUNCTION IF EXISTS get_employee_daily_performance(UUID, DATE);
DROP FUNCTION IF EXISTS get_employee_real_time_stats(UUID);
DROP VIEW IF EXISTS employee_performance_view;
DROP VIEW IF EXISTS today_employee_performance;
DROP TABLE IF EXISTS employee_movements;

-- Create employee_movements table
CREATE TABLE employee_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_session_id UUID REFERENCES shift_sessions(id) ON DELETE SET NULL,
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('check_in', 'check_out', 'payment', 'extra_hour', 'extra_person', 'renewal', 'cancellation', 'modification')),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('room_stay', 'payment', 'room', 'service')),
  entity_id UUID NOT NULL,
  amount DECIMAL(10,2),
  quantity INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  
  -- Constraints
  CONSTRAINT employee_movements_amount_check CHECK (amount >= 0),
  CONSTRAINT employee_movements_quantity_check CHECK (quantity > 0)
);

-- Create indexes for performance
CREATE INDEX idx_employee_movements_employee_id ON employee_movements(employee_id);
CREATE INDEX idx_employee_movements_shift_session_id ON employee_movements(shift_session_id);
CREATE INDEX idx_employee_movements_movement_type ON employee_movements(movement_type);
CREATE INDEX idx_employee_movements_entity_type ON employee_movements(entity_type);
CREATE INDEX idx_employee_movements_created_at ON employee_movements(created_at);
CREATE INDEX idx_employee_movements_status ON employee_movements(status);
CREATE INDEX idx_employee_movements_employee_date ON employee_movements(employee_id, created_at);

-- Add RLS (Row Level Security)
ALTER TABLE employee_movements ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Employees can view their own movements" ON employee_movements
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM employees 
      WHERE id = employee_movements.employee_id
    )
  );

CREATE POLICY "Admins can view all movements" ON employee_movements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert movements" ON employee_movements
  FOR INSERT WITH CHECK (true);

-- Create function to log employee movements
CREATE OR REPLACE FUNCTION log_employee_movement(
  p_employee_id UUID,
  p_shift_session_id UUID DEFAULT NULL,
  p_movement_type VARCHAR(50) DEFAULT NULL,
  p_entity_type VARCHAR(50) DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_amount DECIMAL(10,2) DEFAULT NULL,
  p_quantity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  movement_id UUID;
BEGIN
  IF p_employee_id IS NULL OR p_movement_type IS NULL OR p_entity_type IS NULL OR p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Employee ID, movement type, entity type, and entity ID are required';
  END IF;
  
  INSERT INTO employee_movements (
    employee_id,
    shift_session_id,
    movement_type,
    entity_type,
    entity_id,
    amount,
    quantity,
    metadata
  )
  VALUES (
    p_employee_id,
    p_shift_session_id,
    p_movement_type,
    p_entity_type,
    p_entity_id,
    p_amount,
    p_quantity,
    p_metadata
  )
  RETURNING id INTO movement_id;
  
  RETURN movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update updated_at (using existing shared function)
CREATE TRIGGER update_employee_movements_updated_at
  BEFORE UPDATE ON employee_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create view for employee performance analytics
CREATE OR REPLACE VIEW employee_performance_view AS
SELECT 
  e.id as employee_id,
  e.first_name,
  e.last_name,
  e.role,
  COUNT(CASE WHEN em.movement_type = 'check_in' THEN 1 END) as check_ins_count,
  COUNT(CASE WHEN em.movement_type = 'check_out' THEN 1 END) as check_outs_count,
  COUNT(CASE WHEN em.movement_type = 'payment' THEN 1 END) as payments_count,
  COALESCE(SUM(CASE WHEN em.movement_type = 'payment' THEN em.amount END), 0) as total_revenue,
  COALESCE(AVG(CASE WHEN em.movement_type = 'payment' THEN em.amount END), 0) as avg_payment_amount,
  COUNT(CASE WHEN em.movement_type = 'extra_hour' THEN 1 END) as extra_hours_count,
  COUNT(CASE WHEN em.movement_type = 'extra_person' THEN 1 END) as extra_persons_count,
  COUNT(CASE WHEN em.movement_type = 'renewal' THEN 1 END) as renewals_count,
  DATE(em.created_at) as activity_date
FROM employees e
LEFT JOIN employee_movements em ON e.id = em.employee_id
WHERE e.deleted_at IS NULL
GROUP BY e.id, e.first_name, e.last_name, e.role, DATE(em.created_at);

-- Create function to get employee daily performance
CREATE OR REPLACE FUNCTION get_employee_daily_performance(p_employee_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
  check_ins INTEGER,
  check_outs INTEGER,
  payments_count INTEGER,
  total_revenue DECIMAL(10,2),
  avg_payment_amount DECIMAL(10,2),
  extra_hours INTEGER,
  extra_persons INTEGER,
  renewals INTEGER,
  total_movements INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(CASE WHEN em.movement_type = 'check_in' THEN 1 END)::INTEGER as check_ins,
    COUNT(CASE WHEN em.movement_type = 'check_out' THEN 1 END)::INTEGER as check_outs,
    COUNT(CASE WHEN em.movement_type = 'payment' THEN 1 END)::INTEGER as payments_count,
    COALESCE(SUM(CASE WHEN em.movement_type = 'payment' THEN em.amount END), 0)::DECIMAL(10,2) as total_revenue,
    COALESCE(AVG(CASE WHEN em.movement_type = 'payment' THEN em.amount END), 0)::DECIMAL(10,2) as avg_payment_amount,
    COUNT(CASE WHEN em.movement_type = 'extra_hour' THEN 1 END)::INTEGER as extra_hours,
    COUNT(CASE WHEN em.movement_type = 'extra_person' THEN 1 END)::INTEGER as extra_persons,
    COUNT(CASE WHEN em.movement_type = 'renewal' THEN 1 END)::INTEGER as renewals,
    COUNT(*)::INTEGER as total_movements
  FROM employee_movements em
  WHERE em.employee_id = p_employee_id
    AND DATE(em.created_at) = p_date
    AND em.status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log room stay check-in automatically
CREATE OR REPLACE FUNCTION log_room_stay_check_in()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar movimiento del valet (si existe)
  IF NEW.valet_employee_id IS NOT NULL THEN
    INSERT INTO employee_movements (
      employee_id,
      shift_session_id,
      movement_type,
      entity_type,
      entity_id,
      metadata
    )
    VALUES (
      NEW.valet_employee_id,
      NEW.shift_session_id,
      'check_in',
      'room_stay',
      NEW.id,
      jsonb_build_object(
        'room_number', (SELECT number FROM rooms WHERE id = NEW.room_id),
        'check_in_time', NEW.check_in_at,
        'status', NEW.status,
        'role', 'valet'
      )
    );
  END IF;
  
  -- Registrar movimiento de la recepcionista (siempre que hay check-in)
  -- Buscar recepcionista activo en el momento del check-in
  INSERT INTO employee_movements (
    employee_id,
    shift_session_id,
    movement_type,
    entity_type,
    entity_id,
    metadata
  )
  SELECT 
    e.id,
    NEW.shift_session_id,
    'check_in',
    'room_stay',
    NEW.id,
    jsonb_build_object(
      'room_number', (SELECT number FROM rooms WHERE id = NEW.room_id),
      'check_in_time', NEW.check_in_at,
      'status', NEW.status,
      'role', 'receptionist'
    )
  FROM employees e
  WHERE e.role = 'receptionist'
    AND e.deleted_at IS NULL
  LIMIT 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for room_stays
CREATE TRIGGER log_room_stay_check_in_trigger
  AFTER INSERT ON room_stays
  FOR EACH ROW
  EXECUTE FUNCTION log_room_stay_check_in();

-- Create function to log payment automatically
CREATE OR REPLACE FUNCTION log_payment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO employee_movements (
    employee_id,
    shift_session_id,
    movement_type,
    entity_type,
    entity_id,
    amount,
    quantity,
    metadata
  )
  VALUES (
    NEW.collected_by,
    NEW.shift_session_id,
    'payment',
    'payment',
    NEW.id,
    NEW.amount,
    1,
    jsonb_build_object(
      'payment_method', NEW.payment_method,
      'status', NEW.status,
      'created_at', NEW.created_at
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payments
CREATE TRIGGER log_payment_trigger
  AFTER INSERT ON payments
  FOR EACH ROW
  WHEN (NEW.status = 'PAGADO')
  EXECUTE FUNCTION log_payment();

-- Comments
COMMENT ON TABLE employee_movements IS 'Detailed tracking of all employee activities and movements';
COMMENT ON COLUMN employee_movements.movement_type IS 'Type of movement: check_in, check_out, payment, extra_hour, extra_person, renewal, cancellation, modification';
COMMENT ON COLUMN employee_movements.entity_type IS 'Type of entity affected: room_stay, payment, room, service';
COMMENT ON COLUMN employee_movements.metadata IS 'Additional context data in JSON format';
