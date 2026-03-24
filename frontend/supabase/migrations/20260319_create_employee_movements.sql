-- Migration: Create employee_movements table for detailed activity tracking
-- This table will track every employee action with precise details

-- Create employee_movements table
CREATE TABLE IF NOT EXISTS employee_movements (
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

-- Create indexes for performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_employee_movements_employee_id ON employee_movements(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_movements_shift_session_id ON employee_movements(shift_session_id);
CREATE INDEX IF NOT EXISTS idx_employee_movements_movement_type ON employee_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_employee_movements_entity_type ON employee_movements(entity_type);
CREATE INDEX IF NOT EXISTS idx_employee_movements_created_at ON employee_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_employee_movements_status ON employee_movements(status);

-- Create composite index for common queries (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_employee_movements_employee_date ON employee_movements(employee_id, created_at);

-- Add RLS (Row Level Security)
ALTER TABLE employee_movements ENABLE ROW LEVEL SECURITY;

-- Create policy for employees to see their own movements (IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'employee_movements' 
        AND policyname = 'Employees can view their own movements'
    ) THEN
        CREATE POLICY "Employees can view their own movements" ON employee_movements
          FOR SELECT USING (
            auth.uid() IN (
              SELECT id FROM employees 
              WHERE id = employee_movements.employee_id
            )
          );
    END IF;
END $$;

-- Create policy for admins to view all movements (IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'employee_movements' 
        AND policyname = 'Admins can view all movements'
    ) THEN
        CREATE POLICY "Admins can view all movements" ON employee_movements
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM employees 
              WHERE id = auth.uid() AND role = 'admin'
            )
          );
    END IF;
END $$;

-- Create policy for system to insert movements (IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'employee_movements' 
        AND policyname = 'System can insert movements'
    ) THEN
        CREATE POLICY "System can insert movements" ON employee_movements
          FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- Create function to log employee movements automatically
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
  -- Validar parámetros requeridos
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

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employee_movements_updated_at
  BEFORE UPDATE ON employee_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create view for employee performance analytics (CREATE OR REPLACE is already idempotent)
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
  -- Log check-in movement
  INSERT INTO employee_movements (
    employee_id,
    shift_session_id,
    movement_type,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    COALESCE(NEW.valet_employee_id, NEW.checkout_valet_employee_id),
    NEW.shift_session_id,
    'check_in',
    'room_stay',
    NEW.id,
    jsonb_build_object(
      'room_number', (SELECT name FROM rooms WHERE id = NEW.room_id),
      'check_in_time', NEW.check_in_at,
      'guest_name', NEW.guest_name
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for room_stays (IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'log_room_stay_check_in_trigger'
    ) THEN
        CREATE TRIGGER log_room_stay_check_in_trigger
          AFTER INSERT ON room_stays
          FOR EACH ROW
          EXECUTE FUNCTION log_room_stay_check_in();
    END IF;
END $$;

-- Create function to log payment automatically
CREATE OR REPLACE FUNCTION log_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Log payment movement
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

-- Create trigger for payments (IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'log_payment_trigger'
    ) THEN
        CREATE TRIGGER log_payment_trigger
          AFTER INSERT ON payments
          FOR EACH ROW
          WHEN (NEW.status = 'PAGADO')
          EXECUTE FUNCTION log_payment();
    END IF;
END $$;

COMMENT ON TABLE employee_movements IS 'Detailed tracking of all employee activities and movements';
COMMENT ON COLUMN employee_movements.movement_type IS 'Type of movement: check_in, check_out, payment, extra_hour, extra_person, renewal, cancellation, modification';
COMMENT ON COLUMN employee_movements.entity_type IS 'Type of entity affected: room_stay, payment, room, service';
COMMENT ON COLUMN employee_movements.metadata IS 'Additional context data in JSON format';
