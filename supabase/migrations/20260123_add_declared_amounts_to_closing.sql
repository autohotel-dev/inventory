-- Add columns for declared amounts (vouchers/transfers) to shift_closings
ALTER TABLE shift_closings
ADD COLUMN IF NOT EXISTS declared_card_bbva DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS declared_card_getnet DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS declared_transfer DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS card_difference_bbva DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS card_difference_getnet DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transfer_difference DECIMAL(10,2) DEFAULT 0;
