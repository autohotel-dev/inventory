-- Add tip_amount column to payments table
ALTER TABLE public.payments
ADD COLUMN tip_amount NUMERIC(10, 2) DEFAULT 0;

COMMENT ON COLUMN public.payments.tip_amount IS 'Monto de propina incluido en el pago';
