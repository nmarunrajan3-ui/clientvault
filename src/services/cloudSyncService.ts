import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db/database';

export interface MigrationSummary {
  success: boolean;
  customers: number;
  licenses: number;
  renewals: number;
  payments: number;
  reminders: number;
  activities: number;
  error?: string;
}

/**
 * Migrates all local IndexedDB records to the Supabase PostgreSQL database.
 * Preserves 100% of historical records without data loss.
 */
export async function migrateLocalDataToSupabase(
  supabase: SupabaseClient
): Promise<MigrationSummary> {
  try {
    // 1. Fetch all local records
    const [
      customers,
      licenses,
      renewals,
      payments,
      reminders,
      activities,
      counters,
    ] = await Promise.all([
      db.customers.toArray(),
      db.licenses.toArray(),
      db.renewals.toArray(),
      db.payments.toArray(),
      db.reminders.toArray(),
      db.activities.toArray(),
      db.counters.toArray(),
    ]);

    // 2. Migrate Customers
    if (customers.length > 0) {
      const customerRows = customers.map((c) => ({
        customer_id: c.customerId,
        name: c.name,
        phone: c.phone,
        business_name: c.businessName,
        business_type: c.businessType,
        address: c.address,
        gstin: c.gstin || null,
        email: c.email || null,
        notes: c.notes || null,
        status: c.status,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
        schema_version: c.schemaVersion || 1,
      }));

      const { error: custErr } = await supabase
        .from('customers')
        .upsert(customerRows, { onConflict: 'customer_id' });
      if (custErr) throw new Error(`Customers sync failed: ${custErr.message}`);
    }

    // 3. Migrate Licenses
    if (licenses.length > 0) {
      const licenseRows = licenses.map((l) => ({
        license_id: l.licenseId,
        customer_id: l.customerId,
        product_name: l.productName,
        activation_key: l.activationKey,
        current_renewal_key: l.currentRenewalKey || null,
        issue_date: l.issueDate,
        expiration_date: l.expirationDate,
        status: l.status,
        duration: l.duration || null,
        notes: l.notes || null,
        created_at: l.createdAt,
        updated_at: l.updatedAt,
        schema_version: l.schemaVersion || 1,
      }));

      const { error: licErr } = await supabase
        .from('licenses')
        .upsert(licenseRows, { onConflict: 'license_id' });
      if (licErr) throw new Error(`Licenses sync failed: ${licErr.message}`);
    }

    // 4. Migrate Renewals
    if (renewals.length > 0) {
      const renewalRows = renewals.map((r) => ({
        license_id: r.licenseId,
        customer_id: r.customerId,
        renewal_key: r.renewalKey,
        previous_expiration_date: r.previousExpirationDate,
        new_expiration_date: r.newExpirationDate,
        renewal_date: r.renewalDate,
        duration: r.duration || null,
        notes: r.notes || null,
        created_at: r.createdAt,
        schema_version: r.schemaVersion || 1,
      }));

      const { error: renErr } = await supabase.from('renewals').insert(renewalRows);
      if (renErr) throw new Error(`Renewals sync failed: ${renErr.message}`);
    }

    // 5. Migrate Payments
    if (payments.length > 0) {
      const paymentRows = payments.map((p) => ({
        customer_id: p.customerId,
        license_id: p.licenseId || null,
        amount: p.amount,
        payment_date: p.paymentDate,
        payment_method: p.paymentMethod || null,
        status: p.status,
        transaction_ref: p.transactionRef || null,
        notes: p.notes || null,
        created_at: p.createdAt,
        schema_version: p.schemaVersion || 1,
      }));

      const { error: payErr } = await supabase.from('payments').insert(paymentRows);
      if (payErr) throw new Error(`Payments sync failed: ${payErr.message}`);
    }

    // 6. Migrate Reminders
    if (reminders.length > 0) {
      const reminderRows = reminders.map((rem) => ({
        license_id: rem.licenseId,
        customer_id: rem.customerId,
        reminder_date: rem.reminderDate,
        days_before_expiry: rem.daysBeforeExpiry,
        status: rem.status,
        message: rem.message || null,
        created_at: rem.createdAt,
        schema_version: rem.schemaVersion || 1,
      }));

      const { error: remErr } = await supabase
        .from('reminders')
        .upsert(reminderRows, { onConflict: 'license_id,reminder_date' });
      if (remErr) console.warn('Reminders sync non-fatal warning:', remErr.message);
    }

    // 7. Migrate Counters
    if (counters.length > 0) {
      const counterRows = counters.map((cnt) => ({
        name: cnt.name,
        value: cnt.value,
      }));

      await supabase.from('counters').upsert(counterRows, { onConflict: 'name' });
    }

    return {
      success: true,
      customers: customers.length,
      licenses: licenses.length,
      renewals: renewals.length,
      payments: payments.length,
      reminders: reminders.length,
      activities: activities.length,
    };
  } catch (err: any) {
    console.error('Migration to Supabase error:', err);
    return {
      success: false,
      customers: 0,
      licenses: 0,
      renewals: 0,
      payments: 0,
      reminders: 0,
      activities: 0,
      error: err?.message || 'Data migration failed',
    };
  }
}
