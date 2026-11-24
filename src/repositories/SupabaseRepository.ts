import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Customer,
  License,
  Renewal,
  Payment,
  Reminder,
  Notification,
  Activity,
} from '../types/models';
import type {
  IRepository,
  ICustomerRepository,
  ILicenseRepository,
  IRenewalRepository,
  IPaymentRepository,
  IReminderRepository,
  INotificationRepository,
  IActivityRepository,
  ISettingsRepository,
  SearchQuery,
  PaginatedResult,
} from '../types/repository';

// Row mapping utilities
function mapCustomerFromRow(row: any): Customer {
  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    phone: row.phone,
    businessName: row.business_name,
    businessType: row.business_type,
    address: row.address,
    gstin: row.gstin || undefined,
    email: row.email || undefined,
    notes: row.notes || undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    schemaVersion: row.schema_version,
  };
}

function mapLicenseFromRow(row: any): License {
  return {
    id: row.id,
    licenseId: row.license_id,
    customerId: row.customer_id,
    productName: row.product_name,
    activationKey: row.activation_key,
    currentRenewalKey: row.current_renewal_key || undefined,
    issueDate: row.issue_date,
    expirationDate: row.expiration_date,
    status: row.status,
    duration: row.duration || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    schemaVersion: row.schema_version,
  };
}

function mapRenewalFromRow(row: any): Renewal {
  return {
    id: row.id,
    licenseId: row.license_id,
    customerId: row.customer_id,
    renewalKey: row.renewal_key,
    previousExpirationDate: row.previous_expiration_date,
    newExpirationDate: row.new_expiration_date,
    renewalDate: row.renewal_date,
    duration: row.duration || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    schemaVersion: row.schema_version,
  };
}

function mapPaymentFromRow(row: any): Payment {
  return {
    id: row.id,
    customerId: row.customer_id,
    licenseId: row.license_id || undefined,
    amount: Number(row.amount),
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method || undefined,
    status: row.status,
    transactionRef: row.transaction_ref || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    schemaVersion: row.schema_version,
  };
}

class SupabaseCustomerRepository implements ICustomerRepository {
  constructor(private client: SupabaseClient) {}

  async create(customer: Omit<Customer, 'id'>): Promise<Customer> {
    const { data, error } = await this.client
      .from('customers')
      .insert({
        customer_id: customer.customerId,
        name: customer.name,
        phone: customer.phone,
        business_name: customer.businessName,
        business_type: customer.businessType,
        address: customer.address,
        gstin: customer.gstin || null,
        email: customer.email || null,
        notes: customer.notes || null,
        status: customer.status,
        created_at: customer.createdAt,
        updated_at: customer.updatedAt,
        schema_version: customer.schemaVersion,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapCustomerFromRow(data);
  }

  async getById(customerId: string): Promise<Customer | undefined> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapCustomerFromRow(data) : undefined;
  }

  async getAll(query?: SearchQuery): Promise<PaginatedResult<Customer>> {
    let q = this.client.from('customers').select('*', { count: 'exact' });

    if (query?.status) {
      q = q.eq('status', query.status);
    }

    q = q.order('created_at', { ascending: false });

    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 50;
    q = q.range(offset, offset + limit - 1);

    const { data, count, error } = await q;
    if (error) throw new Error(error.message);

    return {
      data: (data || []).map(mapCustomerFromRow),
      total: count || 0,
      limit,
      offset,
    };
  }

  async update(customerId: string, patch: Partial<Customer>): Promise<Customer> {
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) updateData.name = patch.name;
    if (patch.phone !== undefined) updateData.phone = patch.phone;
    if (patch.businessName !== undefined) updateData.business_name = patch.businessName;
    if (patch.businessType !== undefined) updateData.business_type = patch.businessType;
    if (patch.address !== undefined) updateData.address = patch.address;
    if (patch.gstin !== undefined) updateData.gstin = patch.gstin || null;
    if (patch.email !== undefined) updateData.email = patch.email || null;
    if (patch.notes !== undefined) updateData.notes = patch.notes || null;
    if (patch.status !== undefined) updateData.status = patch.status;

    const { data, error } = await this.client
      .from('customers')
      .update(updateData)
      .eq('customer_id', customerId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapCustomerFromRow(data);
  }

  async archive(customerId: string): Promise<void> {
    await this.update(customerId, { status: 'archived' });
  }

  async restore(customerId: string): Promise<void> {
    await this.update(customerId, { status: 'active' });
  }

  async search(searchTerm: string): Promise<Customer[]> {
    const term = `%${searchTerm}%`;
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .or(
        `name.ilike.${term},business_name.ilike.${term},phone.ilike.${term},customer_id.ilike.${term},gstin.ilike.${term}`
      );

    if (error) throw new Error(error.message);
    return (data || []).map(mapCustomerFromRow);
  }

  async count(status?: string): Promise<number> {
    let q = this.client.from('customers').select('*', { count: 'exact', head: true });
    if (status) {
      q = q.eq('status', status);
    }
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count || 0;
  }

  async checkDuplicateGstin(gstin: string, excludeId?: string): Promise<Customer | undefined> {
    if (!gstin) return undefined;
    let q = this.client.from('customers').select('*').eq('gstin', gstin);
    if (excludeId) {
      q = q.neq('customer_id', excludeId);
    }
    const { data, error } = await q.maybeSingle();
    if (error) return undefined;
    return data ? mapCustomerFromRow(data) : undefined;
  }

  async checkDuplicatePhone(phone: string, excludeId?: string): Promise<Customer | undefined> {
    if (!phone) return undefined;
    let q = this.client.from('customers').select('*').eq('phone', phone);
    if (excludeId) {
      q = q.neq('customer_id', excludeId);
    }
    const { data, error } = await q.maybeSingle();
    if (error) return undefined;
    return data ? mapCustomerFromRow(data) : undefined;
  }
}

class SupabaseLicenseRepository implements ILicenseRepository {
  constructor(private client: SupabaseClient) {}

  async create(license: Omit<License, 'id'>): Promise<License> {
    const { data, error } = await this.client
      .from('licenses')
      .insert({
        license_id: license.licenseId,
        customer_id: license.customerId,
        product_name: license.productName,
        activation_key: license.activationKey,
        current_renewal_key: license.currentRenewalKey || null,
        issue_date: license.issueDate,
        expiration_date: license.expirationDate,
        status: license.status,
        duration: license.duration || null,
        notes: license.notes || null,
        created_at: license.createdAt,
        updated_at: license.updatedAt,
        schema_version: license.schemaVersion,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapLicenseFromRow(data);
  }

  async getById(licenseId: string): Promise<License | undefined> {
    const { data, error } = await this.client
      .from('licenses')
      .select('*')
      .eq('license_id', licenseId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapLicenseFromRow(data) : undefined;
  }

  async getByCustomer(customerId: string): Promise<License[]> {
    const { data, error } = await this.client
      .from('licenses')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapLicenseFromRow);
  }

  async getAll(query?: SearchQuery): Promise<PaginatedResult<License>> {
    let q = this.client.from('licenses').select('*', { count: 'exact' });

    if (query?.status) {
      q = q.eq('status', query.status);
    }

    q = q.order('created_at', { ascending: false });

    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 50;
    q = q.range(offset, offset + limit - 1);

    const { data, count, error } = await q;
    if (error) throw new Error(error.message);

    return {
      data: (data || []).map(mapLicenseFromRow),
      total: count || 0,
      limit,
      offset,
    };
  }

  async update(licenseId: string, patch: Partial<License>): Promise<License> {
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (patch.productName !== undefined) updateData.product_name = patch.productName;
    if (patch.activationKey !== undefined) updateData.activation_key = patch.activationKey;
    if (patch.currentRenewalKey !== undefined) updateData.current_renewal_key = patch.currentRenewalKey || null;
    if (patch.issueDate !== undefined) updateData.issue_date = patch.issueDate;
    if (patch.expirationDate !== undefined) updateData.expiration_date = patch.expirationDate;
    if (patch.status !== undefined) updateData.status = patch.status;
    if (patch.duration !== undefined) updateData.duration = patch.duration || null;
    if (patch.notes !== undefined) updateData.notes = patch.notes || null;

    const { data, error } = await this.client
      .from('licenses')
      .update(updateData)
      .eq('license_id', licenseId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapLicenseFromRow(data);
  }

  async getExpiring(daysAhead: number): Promise<License[]> {
    const now = new Date();
    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const { data, error } = await this.client
      .from('licenses')
      .select('*')
      .gte('expiration_date', now.toISOString().slice(0, 10))
      .lte('expiration_date', future.toISOString().slice(0, 10))
      .neq('status', 'revoked');

    if (error) throw new Error(error.message);
    return (data || []).map(mapLicenseFromRow);
  }

  async getExpired(): Promise<License[]> {
    const now = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.client
      .from('licenses')
      .select('*')
      .lt('expiration_date', now)
      .neq('status', 'revoked');

    if (error) throw new Error(error.message);
    return (data || []).map(mapLicenseFromRow);
  }

  async count(status?: string): Promise<number> {
    let q = this.client.from('licenses').select('*', { count: 'exact', head: true });
    if (status) {
      q = q.eq('status', status);
    }
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count || 0;
  }

  async countByCustomer(customerId: string): Promise<Record<string, number>> {
    const licenses = await this.getByCustomer(customerId);
    const counts: Record<string, number> = {
      total: licenses.length,
      active: 0,
      expiring_soon: 0,
      urgent: 0,
      expired: 0,
      revoked: 0,
    };
    for (const lic of licenses) {
      counts[lic.status] = (counts[lic.status] || 0) + 1;
    }
    return counts;
  }
}

class SupabaseRenewalRepository implements IRenewalRepository {
  constructor(private client: SupabaseClient) {}

  async create(renewal: Omit<Renewal, 'id'>): Promise<Renewal> {
    const { data, error } = await this.client
      .from('renewals')
      .insert({
        license_id: renewal.licenseId,
        customer_id: renewal.customerId,
        renewal_key: renewal.renewalKey,
        previous_expiration_date: renewal.previousExpirationDate,
        new_expiration_date: renewal.newExpirationDate,
        renewal_date: renewal.renewalDate,
        duration: renewal.duration || null,
        notes: renewal.notes || null,
        created_at: renewal.createdAt,
        schema_version: renewal.schemaVersion,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapRenewalFromRow(data);
  }

  async getByLicense(licenseId: string): Promise<Renewal[]> {
    const { data, error } = await this.client
      .from('renewals')
      .select('*')
      .eq('license_id', licenseId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapRenewalFromRow);
  }

  async getByCustomer(customerId: string): Promise<Renewal[]> {
    const { data, error } = await this.client
      .from('renewals')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapRenewalFromRow);
  }

  async getRecent(limit = 10): Promise<Renewal[]> {
    const { data, error } = await this.client
      .from('renewals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data || []).map(mapRenewalFromRow);
  }
}

class SupabasePaymentRepository implements IPaymentRepository {
  constructor(private client: SupabaseClient) {}

  async create(payment: Omit<Payment, 'id'>): Promise<Payment> {
    const { data, error } = await this.client
      .from('payments')
      .insert({
        customer_id: payment.customerId,
        license_id: payment.licenseId || null,
        amount: payment.amount,
        payment_date: payment.paymentDate,
        payment_method: payment.paymentMethod || null,
        status: payment.status,
        transaction_ref: payment.transactionRef || null,
        notes: payment.notes || null,
        created_at: payment.createdAt,
        schema_version: payment.schemaVersion,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapPaymentFromRow(data);
  }

  async getByCustomer(customerId: string): Promise<Payment[]> {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapPaymentFromRow);
  }

  async getByLicense(licenseId: string): Promise<Payment[]> {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('license_id', licenseId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapPaymentFromRow);
  }

  async getAll(query?: SearchQuery): Promise<PaginatedResult<Payment>> {
    let q = this.client.from('payments').select('*', { count: 'exact' });

    if (query?.status) {
      q = q.eq('status', query.status);
    }

    q = q.order('created_at', { ascending: false });
    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 50;
    q = q.range(offset, offset + limit - 1);

    const { data, count, error } = await q;
    if (error) throw new Error(error.message);

    return {
      data: (data || []).map(mapPaymentFromRow),
      total: count || 0,
      limit,
      offset,
    };
  }

  async update(id: number, patch: Partial<Payment>): Promise<Payment> {
    const updateData: Record<string, any> = {};
    if (patch.amount !== undefined) updateData.amount = patch.amount;
    if (patch.status !== undefined) updateData.status = patch.status;
    if (patch.paymentMethod !== undefined) updateData.payment_method = patch.paymentMethod || null;
    if (patch.transactionRef !== undefined) updateData.transaction_ref = patch.transactionRef || null;
    if (patch.notes !== undefined) updateData.notes = patch.notes || null;

    const { data, error } = await this.client
      .from('payments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapPaymentFromRow(data);
  }

  async getSummary(): Promise<{ total: number; paid: number; outstanding: number }> {
    const { data, error } = await this.client.from('payments').select('amount, status');
    if (error) throw new Error(error.message);

    let total = 0;
    let paid = 0;
    let outstanding = 0;

    for (const p of data || []) {
      const amt = Number(p.amount) || 0;
      total += amt;
      if (p.status === 'paid') paid += amt;
      else outstanding += amt;
    }

    return { total, paid, outstanding };
  }
}

class SupabaseReminderRepository implements IReminderRepository {
  constructor(private client: SupabaseClient) {}

  async create(reminder: Omit<Reminder, 'id'>): Promise<Reminder> {
    const { data, error } = await this.client
      .from('reminders')
      .insert({
        license_id: reminder.licenseId,
        customer_id: reminder.customerId,
        reminder_date: reminder.reminderDate,
        days_before_expiry: reminder.daysBeforeExpiry,
        status: reminder.status,
        message: reminder.message || null,
        created_at: reminder.createdAt,
        schema_version: reminder.schemaVersion,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return {
      id: data.id,
      licenseId: data.license_id,
      customerId: data.customer_id,
      reminderDate: data.reminder_date,
      daysBeforeExpiry: data.days_before_expiry,
      status: data.status,
      message: data.message || undefined,
      createdAt: data.created_at,
      schemaVersion: data.schema_version,
    };
  }

  async getByLicense(licenseId: string): Promise<Reminder[]> {
    const { data, error } = await this.client
      .from('reminders')
      .select('*')
      .eq('license_id', licenseId);
    if (error) throw new Error(error.message);
    return (data || []).map((r) => ({
      id: r.id,
      licenseId: r.license_id,
      customerId: r.customer_id,
      reminderDate: r.reminder_date,
      daysBeforeExpiry: r.days_before_expiry,
      status: r.status,
      message: r.message || undefined,
      createdAt: r.created_at,
      schemaVersion: r.schema_version,
    }));
  }

  async getByDate(date: string): Promise<Reminder[]> {
    const { data, error } = await this.client
      .from('reminders')
      .select('*')
      .eq('reminder_date', date);
    if (error) throw new Error(error.message);
    return (data || []).map((r) => ({
      id: r.id,
      licenseId: r.license_id,
      customerId: r.customer_id,
      reminderDate: r.reminder_date,
      daysBeforeExpiry: r.days_before_expiry,
      status: r.status,
      message: r.message || undefined,
      createdAt: r.created_at,
      schemaVersion: r.schema_version,
    }));
  }

  async getUpcoming(days: number): Promise<Reminder[]> {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const { data, error } = await this.client
      .from('reminders')
      .select('*')
      .gte('reminder_date', now.toISOString().slice(0, 10))
      .lte('reminder_date', future.toISOString().slice(0, 10))
      .eq('status', 'pending');

    if (error) throw new Error(error.message);
    return (data || []).map((r) => ({
      id: r.id,
      licenseId: r.license_id,
      customerId: r.customer_id,
      reminderDate: r.reminder_date,
      daysBeforeExpiry: r.days_before_expiry,
      status: r.status,
      message: r.message || undefined,
      createdAt: r.created_at,
      schemaVersion: r.schema_version,
    }));
  }

  async getPending(): Promise<Reminder[]> {
    const { data, error } = await this.client
      .from('reminders')
      .select('*')
      .eq('status', 'pending');
    if (error) throw new Error(error.message);
    return (data || []).map((r) => ({
      id: r.id,
      licenseId: r.license_id,
      customerId: r.customer_id,
      reminderDate: r.reminder_date,
      daysBeforeExpiry: r.days_before_expiry,
      status: r.status,
      message: r.message || undefined,
      createdAt: r.created_at,
      schemaVersion: r.schema_version,
    }));
  }

  async update(id: number, patch: Partial<Reminder>): Promise<Reminder> {
    const updateData: Record<string, any> = {};
    if (patch.status !== undefined) updateData.status = patch.status;
    if (patch.message !== undefined) updateData.message = patch.message || null;

    const { data, error } = await this.client
      .from('reminders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return {
      id: data.id,
      licenseId: data.license_id,
      customerId: data.customer_id,
      reminderDate: data.reminder_date,
      daysBeforeExpiry: data.days_before_expiry,
      status: data.status,
      message: data.message || undefined,
      createdAt: data.created_at,
      schemaVersion: data.schema_version,
    };
  }

  async deleteByLicense(licenseId: string): Promise<void> {
    const { error } = await this.client.from('reminders').delete().eq('license_id', licenseId);
    if (error) throw new Error(error.message);
  }

  async exists(licenseId: string, reminderDate: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('reminders')
      .select('id')
      .eq('license_id', licenseId)
      .eq('reminder_date', reminderDate)
      .maybeSingle();

    if (error) return false;
    return Boolean(data);
  }
}

class SupabaseNotificationRepository implements INotificationRepository {
  constructor(private client: SupabaseClient) {}

  async create(notification: Omit<Notification, 'id'>): Promise<Notification> {
    const { data, error } = await this.client
      .from('notifications')
      .insert({
        type: notification.type,
        title: notification.title,
        message: notification.message,
        is_read: notification.isRead,
        related_id: notification.relatedId || null,
        related_type: notification.relatedType || null,
        created_at: notification.createdAt,
        schema_version: notification.schemaVersion,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return {
      id: data.id,
      type: data.type,
      title: data.title,
      message: data.message,
      isRead: data.is_read,
      relatedId: data.related_id || undefined,
      relatedType: data.related_type || undefined,
      createdAt: data.created_at,
      schemaVersion: data.schema_version,
    };
  }

  async getAll(limit = 50): Promise<Notification[]> {
    const { data, error } = await this.client
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data || []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.is_read,
      relatedId: n.related_id || undefined,
      relatedType: n.related_type || undefined,
      createdAt: n.created_at,
      schemaVersion: n.schema_version,
    }));
  }

  async getUnread(): Promise<Notification[]> {
    const { data, error } = await this.client
      .from('notifications')
      .select('*')
      .eq('is_read', 0)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.is_read,
      relatedId: n.related_id || undefined,
      relatedType: n.related_type || undefined,
      createdAt: n.created_at,
      schemaVersion: n.schema_version,
    }));
  }

  async getUnreadCount(): Promise<number> {
    const { count, error } = await this.client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', 0);

    if (error) throw new Error(error.message);
    return count || 0;
  }

  async markAsRead(id: number): Promise<void> {
    const { error } = await this.client
      .from('notifications')
      .update({ is_read: 1 })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async markAllAsRead(): Promise<void> {
    const { error } = await this.client
      .from('notifications')
      .update({ is_read: 1 })
      .eq('is_read', 0);
    if (error) throw new Error(error.message);
  }

  async dismiss(id: number): Promise<void> {
    const { error } = await this.client.from('notifications').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}

class SupabaseActivityRepository implements IActivityRepository {
  constructor(private client: SupabaseClient) {}

  async create(activity: Omit<Activity, 'id'>): Promise<Activity> {
    const { data, error } = await this.client
      .from('activities')
      .insert({
        customer_id: activity.customerId || null,
        license_id: activity.licenseId || null,
        type: activity.type,
        description: activity.description,
        metadata: activity.metadata || null,
        created_at: activity.createdAt,
        schema_version: activity.schemaVersion,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return {
      id: data.id,
      customerId: data.customer_id || undefined,
      licenseId: data.license_id || undefined,
      type: data.type,
      description: data.description,
      metadata: data.metadata || undefined,
      createdAt: data.created_at,
      schemaVersion: data.schema_version,
    };
  }

  async getAll(limit = 100): Promise<Activity[]> {
    const { data, error } = await this.client
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data || []).map((a) => ({
      id: a.id,
      customerId: a.customer_id || undefined,
      licenseId: a.license_id || undefined,
      type: a.type,
      description: a.description,
      metadata: a.metadata || undefined,
      createdAt: a.created_at,
      schemaVersion: a.schema_version,
    }));
  }

  async getByCustomer(customerId: string, limit = 50): Promise<Activity[]> {
    const { data, error } = await this.client
      .from('activities')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data || []).map((a) => ({
      id: a.id,
      customerId: a.customer_id || undefined,
      licenseId: a.license_id || undefined,
      type: a.type,
      description: a.description,
      metadata: a.metadata || undefined,
      createdAt: a.created_at,
      schemaVersion: a.schema_version,
    }));
  }

  async getRecent(limit = 10): Promise<Activity[]> {
    return this.getAll(limit);
  }
}

class SupabaseSettingsRepository implements ISettingsRepository {
  constructor(private client: SupabaseClient) {}

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const { data, error } = await this.client
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error || !data) return undefined;
    return data.value as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    const { error } = await this.client
      .from('settings')
      .upsert({ key, value: value as any });
    if (error) throw new Error(error.message);
  }

  async getAll(): Promise<Record<string, unknown>> {
    const { data, error } = await this.client.from('settings').select('*');
    if (error) return {};
    const result: Record<string, unknown> = {};
    for (const row of data || []) {
      result[row.key] = row.value;
    }
    return result;
  }
}

export class SupabaseRepository implements IRepository {
  customers: ICustomerRepository;
  licenses: ILicenseRepository;
  renewals: IRenewalRepository;
  payments: IPaymentRepository;
  reminders: IReminderRepository;
  notifications: INotificationRepository;
  activities: IActivityRepository;
  settings: ISettingsRepository;

  constructor(client: SupabaseClient) {
    this.customers = new SupabaseCustomerRepository(client);
    this.licenses = new SupabaseLicenseRepository(client);
    this.renewals = new SupabaseRenewalRepository(client);
    this.payments = new SupabasePaymentRepository(client);
    this.reminders = new SupabaseReminderRepository(client);
    this.notifications = new SupabaseNotificationRepository(client);
    this.activities = new SupabaseActivityRepository(client);
    this.settings = new SupabaseSettingsRepository(client);
  }

  async initialize(): Promise<void> {
    // Verified via client connection test
  }
}
