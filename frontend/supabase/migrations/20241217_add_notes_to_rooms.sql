-- Add notes column to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS notes TEXT;
