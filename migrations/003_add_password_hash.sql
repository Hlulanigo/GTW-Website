-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN password_hash text NOT NULL DEFAULT '';

-- Remove the default after applying it to existing rows
ALTER TABLE users ALTER COLUMN password_hash DROP DEFAULT;

-- Create index on password_hash for performance (if needed)
CREATE INDEX idx_users_email ON users(email);
