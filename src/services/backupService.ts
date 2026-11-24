import { db } from '../db/database';
import type { IRepository } from '../types/repository';
import type {
  Customer,
  License,
  Renewal,
  Payment,
  Reminder,
  Activity,
  Setting,
  Counter,
} from '../types/models';

export const CURRENT_SCHEMA_VERSION = 1;

export interface ClientVaultBackup {
  app: 'ClientVault';
  version: string;
  schemaVersion: number;
  exportedAt: string;
  metadata: {
    customersCount: number;
    licensesCount: number;
    renewalsCount: number;
    paymentsCount: number;
    remindersCount: number;
    activitiesCount: number;
  };
  data: {
    customers: Customer[];
    licenses: License[];
    renewals: Renewal[];
    payments: Payment[];
    reminders: Reminder[];
    activities: Activity[];
    settings: Setting[];
    counters: Counter[];
  };
}

export interface BackupValidationResult {
  isValid: boolean;
  error?: string;
  backup?: ClientVaultBackup;
}

/**
 * Creates a complete, versioned JSON backup object of all local database tables.
 */
export async function createFullBackupObject(repo: IRepository): Promise<ClientVaultBackup> {
  const [
    customers,
    licenses,
    renewals,
    payments,
    reminders,
    activities,
    settings,
    counters,
  ] = await Promise.all([
    db.customers.toArray(),
    db.licenses.toArray(),
    db.renewals.toArray(),
    db.payments.toArray(),
    db.reminders.toArray(),
    db.activities.toArray(),
    db.settings.toArray(),
    db.counters.toArray(),
  ]);

  const backup: ClientVaultBackup = {
    app: 'ClientVault',
    version: '1.0.0',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    metadata: {
      customersCount: customers.length,
      licensesCount: licenses.length,
      renewalsCount: renewals.length,
      paymentsCount: payments.length,
      remindersCount: reminders.length,
      activitiesCount: activities.length,
    },
    data: {
      customers,
      licenses,
      renewals,
      payments,
      reminders,
      activities,
      settings,
      counters,
    },
  };

  return backup;
}

/**
 * Downloads a backup object as a timestamped JSON file.
 */
export function downloadBackupFile(backup: ClientVaultBackup, filenamePrefix = 'clientvault-backup'): void {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${filenamePrefix}-${dateStr}.json`;

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validates a raw backup JSON string before attempting any restore.
 */
export function validateBackupString(rawJson: string): BackupValidationResult {
  try {
    const parsed = JSON.parse(rawJson);

    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'Backup file is not a valid JSON object.' };
    }

    if (parsed.app !== 'ClientVault') {
      return {
        isValid: false,
        error: 'Invalid backup file: Not a recognized ClientVault database archive.',
      };
    }

    if (!parsed.schemaVersion || parsed.schemaVersion > CURRENT_SCHEMA_VERSION) {
      return {
        isValid: false,
        error: `Unsupported schema version (${parsed.schemaVersion}). Please update ClientVault to restore this backup.`,
      };
    }

    if (!parsed.data || typeof parsed.data !== 'object') {
      return { isValid: false, error: 'Corrupted backup file: Missing database payload.' };
    }

    const { customers, licenses, renewals, payments, reminders } = parsed.data;

    if (!Array.isArray(customers) || !Array.isArray(licenses) || !Array.isArray(renewals)) {
      return { isValid: false, error: 'Corrupted backup file: Key tables are missing or not arrays.' };
    }

    return { isValid: true, backup: parsed as ClientVaultBackup };
  } catch (err) {
    return { isValid: false, error: 'Failed to parse JSON file. The file may be corrupted.' };
  }
}

/**
 * Safely restores the database from a validated backup.
 * Transactionally replaces records and updates counters to avoid collisions.
 */
export async function restoreDatabase(
  backup: ClientVaultBackup,
  repo: IRepository,
  createSafetySnapshot = true
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Safety snapshot before restore
    if (createSafetySnapshot) {
      const currentSnapshot = await createFullBackupObject(repo);
      downloadBackupFile(currentSnapshot, 'clientvault-pre-restore-safety-snapshot');
    }

    // 2. Perform restoration in a Dexie transaction across all tables
    await db.transaction(
      'rw',
      [
        db.customers,
        db.licenses,
        db.renewals,
        db.payments,
        db.reminders,
        db.activities,
        db.settings,
        db.counters,
      ],
      async () => {
        // Clear all current tables
        await Promise.all([
          db.customers.clear(),
          db.licenses.clear(),
          db.renewals.clear(),
          db.payments.clear(),
          db.reminders.clear(),
          db.activities.clear(),
          db.settings.clear(),
          db.counters.clear(),
        ]);

        // Bulk insert restored records
        if (backup.data.customers.length > 0) {
          await db.customers.bulkAdd(backup.data.customers);
        }
        if (backup.data.licenses.length > 0) {
          await db.licenses.bulkAdd(backup.data.licenses);
        }
        if (backup.data.renewals.length > 0) {
          await db.renewals.bulkAdd(backup.data.renewals);
        }
        if (backup.data.payments.length > 0) {
          await db.payments.bulkAdd(backup.data.payments);
        }
        if (backup.data.reminders.length > 0) {
          await db.reminders.bulkAdd(backup.data.reminders);
        }
        if (backup.data.activities && backup.data.activities.length > 0) {
          await db.activities.bulkAdd(backup.data.activities);
        }
        if (backup.data.settings && backup.data.settings.length > 0) {
          await db.settings.bulkAdd(backup.data.settings);
        }

        // Restore or re-calculate sequential counters so future IDs never collide
        let maxCustomerNum = 0;
        backup.data.customers.forEach((c) => {
          const match = c.customerId.match(/CUS-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxCustomerNum) maxCustomerNum = num;
          }
        });

        let maxLicenseNum = 0;
        backup.data.licenses.forEach((l) => {
          const match = l.licenseId.match(/LIC-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxLicenseNum) maxLicenseNum = num;
          }
        });

        await db.counters.put({ name: 'customer', value: maxCustomerNum });
        await db.counters.put({ name: 'license', value: maxLicenseNum });
      }
    );

    // 3. Log restore activity
    const now = new Date().toISOString();
    await repo.activities.create({
      type: 'backup_restored',
      description: `Restored database backup from ${new Date(
        backup.exportedAt
      ).toLocaleString()} (${backup.metadata.customersCount} customers, ${
        backup.metadata.licensesCount
      } licenses)`,
      createdAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Failed to restore database:', err);
    return { success: false, error: err?.message || 'Database restoration failed.' };
  }
}

/**
 * Export Payments to CSV (reporting only).
 */
export function exportPaymentsToCsv(payments: Payment[], customersMap: Record<string, Customer>): void {
  const headers = [
    'Payment ID',
    'Customer ID',
    'Customer Name',
    'Linked License ID',
    'Amount (INR)',
    'Payment Date',
    'Payment Method',
    'Status',
    'Transaction Ref / UTR',
    'Notes',
  ];

  const rows = payments.map((p) => {
    const cust = customersMap[p.customerId];
    return [
      p.id || '',
      p.customerId,
      cust?.name || '',
      p.licenseId || '',
      p.amount,
      new Date(p.paymentDate).toLocaleDateString(),
      p.paymentMethod || '',
      p.status,
      p.transactionRef || '',
      p.notes || '',
    ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`);
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'clientvault-payments-report.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
