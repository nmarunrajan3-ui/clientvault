import { useState } from 'react';
import { Copy, Check, X, Database, Terminal } from 'lucide-react';

interface SqlSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SUPABASE_SQL_SCRIPT = `-- ====================================================================
-- CLIENTVAULT SUPABASE POSTGRESQL SCHEMA
-- Paste this script into your Supabase Project -> SQL Editor
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

-- 8. SETTINGS & COUNTERS
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value BIGINT NOT NULL DEFAULT 0);
INSERT INTO counters (name, value) VALUES ('customer', 0) ON CONFLICT (name) DO NOTHING;
INSERT INTO counters (name, value) VALUES ('license', 0) ON CONFLICT (name) DO NOTHING;

-- 9. ROW LEVEL SECURITY
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow anon all customers" ON customers;
    CREATE POLICY "Allow anon all customers" ON customers FOR ALL USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow anon all licenses" ON licenses;
    CREATE POLICY "Allow anon all licenses" ON licenses FOR ALL USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow anon all renewals" ON renewals;
    CREATE POLICY "Allow anon all renewals" ON renewals FOR ALL USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow anon all payments" ON payments;
    CREATE POLICY "Allow anon all payments" ON payments FOR ALL USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow anon all reminders" ON reminders;
    CREATE POLICY "Allow anon all reminders" ON reminders FOR ALL USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow anon all notifications" ON notifications;
    CREATE POLICY "Allow anon all notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow anon all activities" ON activities;
    CREATE POLICY "Allow anon all activities" ON activities FOR ALL USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow anon all settings" ON settings;
    CREATE POLICY "Allow anon all settings" ON settings FOR ALL USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow anon all counters" ON counters;
    CREATE POLICY "Allow anon all counters" ON counters FOR ALL USING (true) WITH CHECK (true);
END $$;
`;

export function SqlSchemaModal({ isOpen, onClose }: SqlSchemaModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="card max-w-2xl w-full p-6 space-y-4 shadow-apple-xl border border-border-light dark:border-border-dark flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-2 border-b border-border-light dark:border-border-dark">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-apple bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center">
              <Database size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                Supabase PostgreSQL Schema Script
              </h3>
              <p className="text-2xs text-text-tertiary">
                Copy and run this in your free Supabase project SQL Editor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-1 text-text-tertiary hover:text-text-primary dark:hover:text-text-dark-primary"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center justify-between bg-surface-secondary dark:bg-surface-dark-tertiary p-2 rounded-apple text-xs">
          <div className="flex items-center gap-2 text-text-secondary dark:text-text-dark-secondary">
            <Terminal size={14} className="text-primary-500" />
            <span>9 Tables, Foreign Keys, Indexes & RLS Policies</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="btn-primary text-xs px-3 py-1 flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check size={13} />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy SQL Script</span>
              </>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-900 text-gray-100 p-4 rounded-apple font-mono text-[11px] leading-relaxed select-all">
          <pre>{SUPABASE_SQL_SCRIPT}</pre>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border-light dark:border-border-dark text-xs text-text-tertiary">
          <span>Run once in Supabase &rarr; SQL Editor &rarr; New Query &rarr; Run</span>
          <button onClick={onClose} className="btn-secondary text-xs px-3 py-1.5">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
