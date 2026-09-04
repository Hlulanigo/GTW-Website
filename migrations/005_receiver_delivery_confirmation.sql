ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_by VARCHAR REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS delivery_confirmation_method TEXT,
  ADD COLUMN IF NOT EXISTS delivery_confirmation_notes TEXT;