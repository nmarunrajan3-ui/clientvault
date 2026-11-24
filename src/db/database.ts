import Dexie, { type EntityTable } from 'dexie';
import type {
  Customer, License, Renewal, Payment, Reminder, Notification, Activity, Setting, Counter,
} from '../types/models';

class ClientVaultDB extends Dexie {
  customers!: EntityTable<Customer, 'id'>;
  licenses!: EntityTable<License, 'id'>;
  renewals!: EntityTable<Renewal, 'id'>;
  payments!: EntityTable<Payment, 'id'>;
  reminders!: EntityTable<Reminder, 'id'>;
  notifications!: EntityTable<Notification, 'id'>;
  activities!: EntityTable<Activity, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  counters!: EntityTable<Counter, 'name'>;

  constructor() {
    super('ClientVaultDB');
    this.version(1).stores({
      customers: '++id, &customerId, name, businessName, phone, gstin, email, status, createdAt',
      licenses: '++id, &licenseId, customerId, productName, status, expirationDate, createdAt',
      renewals: '++id, licenseId, customerId, renewalDate',
      payments: '++id, customerId, licenseId, paymentDate, status',
      reminders: '++id, licenseId, customerId, reminderDate, status, [licenseId+reminderDate]',
      notifications: '++id, type, isRead, createdAt, relatedId',
      activities: '++id, customerId, type, createdAt',
      settings: 'key',
      counters: 'name',
    });
  }
}

export const db = new ClientVaultDB();

export async function initializeDatabase(): Promise<void> {
  const customerCounter = await db.counters.get('customer');
  if (!customerCounter) {
    await db.counters.put({ name: 'customer', value: 0 });
  }
  const licenseCounter = await db.counters.get('license');
  if (!licenseCounter) {
    await db.counters.put({ name: 'license', value: 0 });
  }

  const defaultSettings: Array<{ key: string; value: unknown }> = [
    { key: 'theme', value: 'system' },
    { key: 'timezone', value: 'Asia/Kolkata' },
    { key: 'desktopNotifications', value: false },
    { key: 'reminderIntervals', value: [30, 15, 7, 3, 0] },
    { key: 'currency', value: 'INR' },
    { key: 'dateFormat', value: 'DD/MM/YYYY' },
    { key: 'appLock', value: false },
    { key: 'backupReminder', value: true },
    { key: 'lastBackupDate', value: null },
    { key: 'schemaVersion', value: 1 },
  ];

  for (const setting of defaultSettings) {
    const existing = await db.settings.get(setting.key);
    if (!existing) {
      await db.settings.put(setting as Setting);
    }
  }
}

export async function generateCustomerId(): Promise<string> {
  return await db.transaction('rw', db.counters, async () => {
    const counter = await db.counters.get('customer');
    const nextValue = (counter?.value ?? 0) + 1;
    await db.counters.put({ name: 'customer', value: nextValue });
    return `CUS-${String(nextValue).padStart(6, '0')}`;
  });
}

export async function generateLicenseId(): Promise<string> {
  return await db.transaction('rw', db.counters, async () => {
    const counter = await db.counters.get('license');
    const nextValue = (counter?.value ?? 0) + 1;
    await db.counters.put({ name: 'license', value: nextValue });
    return `LIC-${String(nextValue).padStart(6, '0')}`;
  });
}
