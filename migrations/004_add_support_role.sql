-- Migration: Add 'support' role to user_role enum
-- Description: Adds support staff role for customer service team

-- First, we need to alter the enum type to add 'support'
-- This requires a multi-step process in PostgreSQL

-- Step 1: Add the new value to the enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'support';

-- Step 2: Update any existing test data or default support accounts if needed
-- (This is optional and depends on your data)

-- Note: In PostgreSQL, you cannot remove or reorder enum values easily.
-- The new 'support' value will be added to the end of the enum list.
-- The enum order will be: 'user', 'admin', 'support'

COMMENT ON TYPE user_role IS 'User roles: user (regular user), support (customer support staff), admin (administrator)';
