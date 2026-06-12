-- ================================================================
-- Create shift_employee_charges table
-- Tracks internal employee consumptions (breakfasts, products, etc.)
-- ================================================================

CREATE TABLE IF NOT EXISTS shift_employee_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_session_id UUID NOT NULL REFERENCES shift_sessions(id) ON DELETE CASCADE,
    registered_by UUID NOT NULL REFERENCES employees(id),
    charged_to UUID NOT NULL REFERENCES employees(id),
    charge_type TEXT NOT NULL CHECK (charge_type IN ('BREAKFAST', 'LUNCH', 'CONSUMPTION', 'PRODUCT', 'OTHER')),
    description TEXT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    discount_type TEXT CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT', 'FULL')),
    discount_value NUMERIC(10,2) DEFAULT 0 CHECK (discount_value >= 0),
    discount_amount NUMERIC(10,2) DEFAULT 0 CHECK (discount_amount >= 0),
    total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'DEDUCCION_NOMINA', 'COURTESY')),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_shift_employee_charges_session ON shift_employee_charges(shift_session_id);
CREATE INDEX IF NOT EXISTS idx_shift_employee_charges_charged_to ON shift_employee_charges(charged_to);
CREATE INDEX IF NOT EXISTS idx_shift_employee_charges_status ON shift_employee_charges(status);

-- RLS policies
ALTER TABLE shift_employee_charges ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read charges
CREATE POLICY "Authenticated users can read employee charges"
    ON shift_employee_charges FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert charges
CREATE POLICY "Authenticated users can insert employee charges"
    ON shift_employee_charges FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update charges
CREATE POLICY "Authenticated users can update employee charges"
    ON shift_employee_charges FOR UPDATE
    TO authenticated
    USING (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_shift_employee_charges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_shift_employee_charges_updated_at
    BEFORE UPDATE ON shift_employee_charges
    FOR EACH ROW
    EXECUTE FUNCTION update_shift_employee_charges_updated_at();
