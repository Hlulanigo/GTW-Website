-- Production Performance Indexes
-- Run this before deploying: psql $DATABASE_URL < migrations/001_add_indexes.sql

-- Parcels indexes
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_sender_id ON parcels(sender_id);
CREATE INDEX IF NOT EXISTS idx_parcels_transporter_id ON parcels(transporter_id);
CREATE INDEX IF NOT EXISTS idx_parcels_pickup_date ON parcels(pickup_date);
CREATE INDEX IF NOT EXISTS idx_parcels_created_at ON parcels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parcels_expires_at ON parcels(expires_at);

-- Routes indexes
CREATE INDEX IF NOT EXISTS idx_routes_carrier_id ON routes(carrier_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_departure_date ON routes(departure_date);
CREATE INDEX IF NOT EXISTS idx_routes_created_at ON routes(created_at DESC);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_sender_id ON payments(sender_id);
CREATE INDEX IF NOT EXISTS idx_payments_carrier_id ON payments(carrier_id);
CREATE INDEX IF NOT EXISTS idx_payments_parcel_id ON payments(parcel_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(paystack_reference);

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_participant1 ON conversations(participant1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant2 ON conversations(participant2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_parcel ON conversations(parcel_id);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_parcel_id ON reviews(parcel_id);

-- Push tokens indexes
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_parcels_status_pickup ON parcels(status, pickup_date);
CREATE INDEX IF NOT EXISTS idx_routes_status_departure ON routes(status, departure_date);

ANALYZE parcels;
ANALYZE routes;
ANALYZE payments;
ANALYZE conversations;
ANALYZE messages;
ANALYZE subscriptions;
ANALYZE users;
ANALYZE reviews;
ANALYZE push_tokens;