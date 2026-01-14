-- Credits System Migration
-- Run this in your Supabase SQL Editor

-- ============================================
-- USER CREDITS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,
    lifetime_purchased INTEGER DEFAULT 0,
    lifetime_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_user ON user_credits(user_id);

-- ============================================
-- CREDIT TRANSACTIONS TABLE (Audit Log)
-- ============================================

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- positive = add, negative = deduct
    balance_after INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus')),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (using Clerk for auth)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON user_credits;
CREATE POLICY "Enable all access for authenticated users" ON user_credits 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Also allow public access for API routes using service role
DROP POLICY IF EXISTS "Public access for credits" ON user_credits;
CREATE POLICY "Public access for credits" ON user_credits 
    FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON credit_transactions;
CREATE POLICY "Enable all access for authenticated users" ON credit_transactions 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for transactions" ON credit_transactions;
CREATE POLICY "Public access for transactions" ON credit_transactions 
    FOR ALL TO public USING (true) WITH CHECK (true);

-- ============================================
-- HELPER FUNCTION: Auto-create credits for new users
-- ============================================

CREATE OR REPLACE FUNCTION create_user_credits()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_credits (user_id, balance)
    VALUES (NEW.id, 100) -- 100 welcome credits
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create credits when a user is created
DROP TRIGGER IF EXISTS on_user_created_credits ON users;
CREATE TRIGGER on_user_created_credits
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_credits();
