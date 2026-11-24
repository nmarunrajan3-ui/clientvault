-- ====================================================================
-- CLIENTVAULT SUPABASE POSTGRESQL SCHEMA (PHASE B / ONLINE VERSION)
-- Run this script in your Supabase Project -> SQL Editor to initialize
-- all tables, indexes, and Row Level Security policies.
-- ====================================================================

-- 1. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    customer_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    business_name TEXT NOT NULL,
    business_type TEXT NOT NULL,
    address TEXT NOT NULL,
    gstin TEXT,
    email TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    schema_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_business_name ON customers(business_name);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- 2. LICENSES TABLE
CREATE TABLE IF NOT EXISTS licenses (
    id BIGSERIAL PRIMARY KEY,
    license_id TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    activation_key TEXT NOT NULL,
    current_renewal_key TEXT,
    issue_date DATE NOT NULL,
    expiration_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expiring_soon', 'urgent', 'expired', 'revoked')),
    duration INT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    schema_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_licenses_license_id ON licenses(license_id);
CREATE INDEX IF NOT EXISTS idx_licenses_customer_id ON licenses(customer_id);
CREATE INDEX IF NOT EXISTS idx_licenses_product_name ON licenses(product_name);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_expiration_date ON licenses(expiration_date);

-- 3. RENEWALS TABLE (Historical preservation of every key)
CREATE TABLE IF NOT EXISTS renewals (
    id BIGSERIAL PRIMARY KEY,
    license_id TEXT NOT NULL REFERENCES licenses(license_id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    renewal_key TEXT NOT NULL,
    previous_expiration_date DATE NOT NULL,
    new_expiration_date DATE NOT NULL,
    renewal_date DATE NOT NULL,
    duration INT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    schema_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_renewals_license_id ON renewals(license_id);
CREATE INDEX IF NOT EXISTS idx_renewals_customer_id ON renewals(customer_id);
CREATE INDEX IF NOT EXISTS idx_renewals_created_at ON renewals(created_at);

-- 4. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    license_id TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method TEXT,
    status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'partially_paid', 'unpaid')),
    transaction_ref TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    schema_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_license_id ON payments(license_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 5. REMINDERS TABLE
CREATE TABLE IF NOT EXISTS reminders (
    id BIGSERIAL PRIMARY KEY,
    license_id TEXT NOT NULL REFERENCES licenses(license_id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    reminder_date DATE NOT NULL,
    days_before_expiry INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'dismissed')),
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    schema_version INT NOT NULL DEFAULT 1,
    UNIQUE (license_id, reminder_date)
);

CREATE INDEX IF NOT EXISTS idx_reminders_reminder_date ON reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);

-- 6. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INT NOT NULL DEFAULT 0,
    related_id TEXT,
    related_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    schema_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- 7. ACTIVITIES AUDIT TABLE
CREATE TABLE IF NOT EXISTS activities (
    id BIGSERIAL PRIMARY KEY,
    customer_id TEXT,
    license_id TEXT,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    schema_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_activities_customer_id ON activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);

-- 8. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- 9. COUNTERS TABLE (Sequential ID generation)
CREATE TABLE IF NOT EXISTS counters (
    name TEXT PRIMARY KEY,
    value BIGINT NOT NULL DEFAULT 0
);

-- Seed initial counters if not present
INSERT INTO counters (name, value) VALUES ('customer', 0) ON CONFLICT (name) DO NOTHING;
INSERT INTO counters (name, value) VALUES ('license', 0) ON CONFLICT (name) DO NOTHING;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;

-- Allow full access for anon/authenticated API keys (Single-tenant freelancer access)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow all for anon on customers" ON customers;
    CREATE POLICY "Allow all for anon on customers" ON customers FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all for anon on licenses" ON licenses;
    CREATE POLICY "Allow all for anon on licenses" ON licenses FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all for anon on renewals" ON renewals;
    CREATE POLICY "Allow all for anon on renewals" ON renewals FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all for anon on payments" ON payments;
    CREATE POLICY "Allow all for anon on payments" ON payments FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all for anon on reminders" ON reminders;
    CREATE POLICY "Allow all for anon on reminders" ON reminders FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all for anon on notifications" ON notifications;
    CREATE POLICY "Allow all for anon on notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all for anon on activities" ON activities;
    CREATE POLICY "Allow all for anon on activities" ON activities FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all for anon on settings" ON settings;
    CREATE POLICY "Allow all for anon on settings" ON settings FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all for anon on counters" ON counters;
    CREATE POLICY "Allow all for anon on counters" ON counters FOR ALL USING (true) WITH CHECK (true);
END $$;
