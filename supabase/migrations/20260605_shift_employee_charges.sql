-- Migration: Create shift_employee_charges table
-- Tracks employee consumptions (breakfasts, personal items, etc.)
-- with support for discounts and multiple payment methods.

CREATE TABLE IF NOT EXISTS shift_employee_charges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_session_id UUID NOT NULL REFERENCES shift_sessions(id) ON DELETE CASCADE,
    registered_by UUID NOT NULL REFERENCES employees(id),
    charged_to UUID NOT NULL REFERENCES employees(id),
    charge_type TEXT NOT NULL CHECK (charge_type IN ('BREAKFAST', 'LUNCH', 'CONSUMPTION', 'PRODUCT', 'OTHER')),
    description TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    subtotal NUMERIC(10, 2) NOT NULL GENERATED ALWAYS AS (unit_price * quantity) STORED,
    discount_type TEXT CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT', 'FULL') OR discount_type IS NULL),
    discount_value NUMERIC(10, 2) DEFAULT 0,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
    payment_method TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'DEDUCCION_NOMINA', 'COURTESY')),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_employee_charges_session ON shift_employee_charges(shift_session_id);
CREATE INDEX IF NOT EXISTS idx_employee_charges_charged_to ON shift_employee_charges(charged_to);
CREATE INDEX IF NOT EXISTS idx_employee_charges_created ON shift_employee_charges(created_at DESC);

-- Enable RLS
ALTER TABLE shift_employee_charges ENABLE ROW LEVEL SECURITY;

-- RLS Policies: authenticated users can read/insert (receptionist registers, admin reviews)
CREATE POLICY "authenticated_read_employee_charges"
    ON shift_employee_charges FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_employee_charges"
    ON shift_employee_charges FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_employee_charges"
    ON shift_employee_charges FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE shift_employee_charges IS 'Tracks employee consumptions/charges during shifts (breakfasts, products, etc.) with discount support';
