import { db, initializeDatabase, generateCustomerId, generateLicenseId } from '../db/database';
import type {
  Customer, License, Renewal, Payment, Reminder, Notification, Activity, Setting,
} from '../types/models';
import type {
  IRepository, ICustomerRepository, ILicenseRepository, IRenewalRepository,
  IPaymentRepository, IReminderRepository, INotificationRepository,
  IActivityRepository, ISettingsRepository, SearchQuery, PaginatedResult,
} from '../types/repository';

class LocalCustomerRepository implements ICustomerRepository {
  async create(customer: Omit<Customer, 'id'>): Promise<Customer> {
    const id = await db.customers.add(customer as Customer);
    return { ...customer, id } as Customer;
  }

  async getById(customerId: string): Promise<Customer | undefined> {
    return db.customers.where('customerId').equals(customerId).first();
  }

  async getAll(query?: SearchQuery): Promise<PaginatedResult<Customer>> {
    let collection = db.customers.orderBy('createdAt');
    if (query?.status) {
      collection = db.customers.where('status').equals(query.status).reverse();
    }
    const total = await collection.count();
    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 50;
    const data = await collection.reverse().offset(offset).limit(limit).toArray();
    return { data, total, limit, offset };
  }

  async update(customerId: string, data: Partial<Customer>): Promise<Customer> {
    const existing = await this.getById(customerId);
    if (!existing) throw new Error(`Customer ${customerId} not found`);
    await db.customers.update(existing.id!, { ...data, updatedAt: new Date().toISOString() });
    return { ...existing, ...data, updatedAt: new Date().toISOString() };
  }

  async archive(customerId: string): Promise<void> {
    const existing = await this.getById(customerId);
    if (!existing) throw new Error(`Customer ${customerId} not found`);
    await db.customers.update(existing.id!, { status: 'archived', updatedAt: new Date().toISOString() });
  }

  async restore(customerId: string): Promise<void> {
    const existing = await this.getById(customerId);
    if (!existing) throw new Error(`Customer ${customerId} not found`);
    await db.customers.update(existing.id!, { status: 'active', updatedAt: new Date().toISOString() });
  }

  async search(searchTerm: string): Promise<Customer[]> {
    const term = searchTerm.toLowerCase();
    return db.customers.filter((c) =>
      Boolean(
        c.name.toLowerCase().includes(term) ||
        c.businessName.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.customerId.toLowerCase().includes(term) ||
        (c.gstin && c.gstin.toLowerCase().includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term))
      )
    ).toArray();
  }

  async count(status?: string): Promise<number> {
    if (status) {
      return db.customers.where('status').equals(status).count();
    }
    return db.customers.count();
  }

  async checkDuplicateGstin(gstin: string, excludeId?: string): Promise<Customer | undefined> {
    if (!gstin) return undefined;
    const match = await db.customers.where('gstin').equals(gstin).first();
    if (match && excludeId && match.customerId === excludeId) return undefined;
    return match;
  }

  async checkDuplicatePhone(phone: string, excludeId?: string): Promise<Customer | undefined> {
    if (!phone) return undefined;
    const match = await db.customers.where('phone').equals(phone).first();
    if (match && excludeId && match.customerId === excludeId) return undefined;
    return match;
  }
}

class LocalLicenseRepository implements ILicenseRepository {
  async create(license: Omit<License, 'id'>): Promise<License> {
    const id = await db.licenses.add(license as License);
    return { ...license, id } as License;
  }

  async getById(licenseId: string): Promise<License | undefined> {
    return db.licenses.where('licenseId').equals(licenseId).first();
  }

  async getByCustomer(customerId: string): Promise<License[]> {
    return db.licenses.where('customerId').equals(customerId).toArray();
  }

  async getAll(query?: SearchQuery): Promise<PaginatedResult<License>> {
    let collection = db.licenses.orderBy('createdAt');
    if (query?.status) {
      collection = db.licenses.where('status').equals(query.status);
    }
    const total = await collection.count();
    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 50;
    const data = await collection.reverse().offset(offset).limit(limit).toArray();
    return { data, total, limit, offset };
  }

  async update(licenseId: string, data: Partial<License>): Promise<License> {
    const existing = await this.getById(licenseId);
    if (!existing) throw new Error(`License ${licenseId} not found`);
    await db.licenses.update(existing.id!, { ...data, updatedAt: new Date().toISOString() });
    return { ...existing, ...data, updatedAt: new Date().toISOString() };
  }

  async getExpiring(daysAhead: number): Promise<License[]> {
    const now = new Date();
    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    return db.licenses
      .where('expirationDate')
      .between(now.toISOString(), future.toISOString())
      .and((l) => l.status !== 'revoked')
      .toArray();
  }

  async getExpired(): Promise<License[]> {
    const now = new Date().toISOString();
    return db.licenses
      .where('expirationDate')
      .below(now)
      .and((l) => l.status !== 'revoked')
      .toArray();
  }

  async count(status?: string): Promise<number> {
    if (status) {
      return db.licenses.where('status').equals(status).count();
    }
    return db.licenses.count();
  }

  async countByCustomer(customerId: string): Promise<Record<string, number>> {
    const licenses = await this.getByCustomer(customerId);
    const counts: Record<string, number> = { total: licenses.length, active: 0, expiring_soon: 0, urgent: 0, expired: 0, revoked: 0 };
    for (const lic of licenses) {
      counts[lic.status] = (counts[lic.status] || 0) + 1;
    }
    return counts;
  }
}

class LocalRenewalRepository implements IRenewalRepository {
  async create(renewal: Omit<Renewal, 'id'>): Promise<Renewal> {
    const id = await db.renewals.add(renewal as Renewal);
    return { ...renewal, id } as Renewal;
  }

  async getByLicense(licenseId: string): Promise<Renewal[]> {
    return db.renewals.where('licenseId').equals(licenseId).reverse().sortBy('renewalDate');
  }

  async getByCustomer(customerId: string): Promise<Renewal[]> {
    return db.renewals.where('customerId').equals(customerId).reverse().sortBy('renewalDate');
  }

  async getRecent(limit = 10): Promise<Renewal[]> {
    return db.renewals.orderBy('renewalDate').reverse().limit(limit).toArray();
  }
}

class LocalPaymentRepository implements IPaymentRepository {
  async create(payment: Omit<Payment, 'id'>): Promise<Payment> {
    const id = await db.payments.add(payment as Payment);
    return { ...payment, id } as Payment;
  }

  async getByCustomer(customerId: string): Promise<Payment[]> {
    return db.payments.where('customerId').equals(customerId).toArray();
  }

  async getByLicense(licenseId: string): Promise<Payment[]> {
    return db.payments.where('licenseId').equals(licenseId).toArray();
  }

  async getAll(query?: SearchQuery): Promise<PaginatedResult<Payment>> {
    const total = await db.payments.count();
    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 50;
    const data = await db.payments.orderBy('paymentDate').reverse().offset(offset).limit(limit).toArray();
    return { data, total, limit, offset };
  }

  async update(id: number, data: Partial<Payment>): Promise<Payment> {
    await db.payments.update(id, data);
    const updated = await db.payments.get(id);
    if (!updated) throw new Error(`Payment ${id} not found`);
    return updated;
  }

  async getSummary(): Promise<{ total: number; paid: number; outstanding: number }> {
    const payments = await db.payments.toArray();
    let paid = 0;
    let total = 0;
    for (const p of payments) {
      total += p.amount;
      if (p.status === 'paid') paid += p.amount;
    }
    return { total, paid, outstanding: total - paid };
  }
}

class LocalReminderRepository implements IReminderRepository {
  async create(reminder: Omit<Reminder, 'id'>): Promise<Reminder> {
    const id = await db.reminders.add(reminder as Reminder);
    return { ...reminder, id } as Reminder;
  }

  async getByLicense(licenseId: string): Promise<Reminder[]> {
    return db.reminders.where('licenseId').equals(licenseId).toArray();
  }

  async getByDate(date: string): Promise<Reminder[]> {
    return db.reminders.where('reminderDate').equals(date).toArray();
  }

  async getUpcoming(days: number): Promise<Reminder[]> {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return db.reminders
      .where('reminderDate')
      .between(now.toISOString().split('T')[0], future.toISOString().split('T')[0])
      .toArray();
  }

  async getPending(): Promise<Reminder[]> {
    return db.reminders.where('status').equals('pending').toArray();
  }

  async update(id: number, data: Partial<Reminder>): Promise<Reminder> {
    await db.reminders.update(id, data);
    const updated = await db.reminders.get(id);
    if (!updated) throw new Error(`Reminder ${id} not found`);
    return updated;
  }

  async deleteByLicense(licenseId: string): Promise<void> {
    await db.reminders.where('licenseId').equals(licenseId).delete();
  }

  async exists(licenseId: string, reminderDate: string): Promise<boolean> {
    const count = await db.reminders.where('[licenseId+reminderDate]').equals([licenseId, reminderDate]).count();
    return count > 0;
  }
}

class LocalNotificationRepository implements INotificationRepository {
  async create(notification: Omit<Notification, 'id'>): Promise<Notification> {
    const id = await db.notifications.add(notification as Notification);
    return { ...notification, id } as Notification;
  }

  async getAll(limit = 50): Promise<Notification[]> {
    return db.notifications.orderBy('createdAt').reverse().limit(limit).toArray();
  }

  async getUnread(): Promise<Notification[]> {
    return db.notifications.where('isRead').equals(0).reverse().sortBy('createdAt');
  }

  async getUnreadCount(): Promise<number> {
    return db.notifications.where('isRead').equals(0).count();
  }

  async markAsRead(id: number): Promise<void> {
    await db.notifications.update(id, { isRead: 1 });
  }

  async markAllAsRead(): Promise<void> {
    await db.notifications.where('isRead').equals(0).modify({ isRead: 1 });
  }

  async dismiss(id: number): Promise<void> {
    await db.notifications.delete(id);
  }
}

class LocalActivityRepository implements IActivityRepository {
  async create(activity: Omit<Activity, 'id'>): Promise<Activity> {
    const id = await db.activities.add(activity as Activity);
    return { ...activity, id } as Activity;
  }

  async getAll(limit = 100): Promise<Activity[]> {
    return db.activities.orderBy('createdAt').reverse().limit(limit).toArray();
  }

  async getByCustomer(customerId: string, limit = 50): Promise<Activity[]> {
    return db.activities.where('customerId').equals(customerId).reverse().sortBy('createdAt');
  }

  async getRecent(limit = 10): Promise<Activity[]> {
    return db.activities.orderBy('createdAt').reverse().limit(limit).toArray();
  }
}

class LocalSettingsRepository implements ISettingsRepository {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const setting = await db.settings.get(key);
    return setting?.value as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await db.settings.put({ key, value });
  }

  async getAll(): Promise<Record<string, unknown>> {
    const settings = await db.settings.toArray();
    const result: Record<string, unknown> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }
}

export class LocalRepository implements IRepository {
  customers = new LocalCustomerRepository();
  licenses = new LocalLicenseRepository();
  renewals = new LocalRenewalRepository();
  payments = new LocalPaymentRepository();
  reminders = new LocalReminderRepository();
  notifications = new LocalNotificationRepository();
  activities = new LocalActivityRepository();
  settings = new LocalSettingsRepository();

  async initialize(): Promise<void> {
    await initializeDatabase();
  }
}

export { generateCustomerId, generateLicenseId };
