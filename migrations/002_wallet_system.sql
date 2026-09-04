-- Add transaction type and status enums
DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('credit', 'debit');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) UNIQUE,
  balance INTEGER DEFAULT 0 NOT NULL,
  currency TEXT DEFAULT 'NGN' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id VARCHAR NOT NULL REFERENCES wallets(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  type transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  status transaction_status DEFAULT 'completed' NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  parcel_id VARCHAR REFERENCES parcels(id),
  paystack_reference TEXT,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_parcel_id ON wallet_transactions(parcel_id);

-- Create wallets for existing users
INSERT INTO wallets (user_id, balance, currency)
SELECT id, 0, 'NGN'
FROM users
WHERE id NOT IN (SELECT user_id FROM wallets);
