import type {
  Customer, License, Renewal, Payment, Reminder, Notification, Activity,
} from './models';

export interface SearchQuery {
  query?: string;
  status?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ICustomerRepository {
  create(customer: Omit<Customer, 'id'>): Promise<Customer>;
  getById(customerId: string): Promise<Customer | undefined>;
  getAll(query?: SearchQuery): Promise<PaginatedResult<Customer>>;
  update(customerId: string, data: Partial<Customer>): Promise<Customer>;
  archive(customerId: string): Promise<void>;
  restore(customerId: string): Promise<void>;
  search(searchTerm: string): Promise<Customer[]>;
  count(status?: string): Promise<number>;
  checkDuplicateGstin(gstin: string, excludeId?: string): Promise<Customer | undefined>;
  checkDuplicatePhone(phone: string, excludeId?: string): Promise<Customer | undefined>;
}

export interface ILicenseRepository {
  create(license: Omit<License, 'id'>): Promise<License>;
  getById(licenseId: string): Promise<License | undefined>;
  getByCustomer(customerId: string): Promise<License[]>;
  getAll(query?: SearchQuery): Promise<PaginatedResult<License>>;
  update(licenseId: string, data: Partial<License>): Promise<License>;
  getExpiring(daysAhead: number): Promise<License[]>;
  getExpired(): Promise<License[]>;
  count(status?: string): Promise<number>;
  countByCustomer(customerId: string): Promise<Record<string, number>>;
}

export interface IRenewalRepository {
  create(renewal: Omit<Renewal, 'id'>): Promise<Renewal>;
  getByLicense(licenseId: string): Promise<Renewal[]>;
  getByCustomer(customerId: string): Promise<Renewal[]>;
  getRecent(limit?: number): Promise<Renewal[]>;
}

export interface IPaymentRepository {
  create(payment: Omit<Payment, 'id'>): Promise<Payment>;
  getByCustomer(customerId: string): Promise<Payment[]>;
  getByLicense(licenseId: string): Promise<Payment[]>;
  getAll(query?: SearchQuery): Promise<PaginatedResult<Payment>>;
  update(id: number, data: Partial<Payment>): Promise<Payment>;
  getSummary(): Promise<{ total: number; paid: number; outstanding: number }>;
}

export interface IReminderRepository {
  create(reminder: Omit<Reminder, 'id'>): Promise<Reminder>;
  getByLicense(licenseId: string): Promise<Reminder[]>;
  getByDate(date: string): Promise<Reminder[]>;
  getUpcoming(days: number): Promise<Reminder[]>;
  getPending(): Promise<Reminder[]>;
  update(id: number, data: Partial<Reminder>): Promise<Reminder>;
  deleteByLicense(licenseId: string): Promise<void>;
  exists(licenseId: string, reminderDate: string): Promise<boolean>;
}

export interface INotificationRepository {
  create(notification: Omit<Notification, 'id'>): Promise<Notification>;
  getAll(limit?: number): Promise<Notification[]>;
  getUnread(): Promise<Notification[]>;
  getUnreadCount(): Promise<number>;
  markAsRead(id: number): Promise<void>;
  markAllAsRead(): Promise<void>;
  dismiss(id: number): Promise<void>;
}

export interface IActivityRepository {
  create(activity: Omit<Activity, 'id'>): Promise<Activity>;
  getAll(limit?: number): Promise<Activity[]>;
  getByCustomer(customerId: string, limit?: number): Promise<Activity[]>;
  getRecent(limit?: number): Promise<Activity[]>;
}

export interface ISettingsRepository {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
}

export interface IRepository {
  customers: ICustomerRepository;
  licenses: ILicenseRepository;
  renewals: IRenewalRepository;
  payments: IPaymentRepository;
  reminders: IReminderRepository;
  notifications: INotificationRepository;
  activities: IActivityRepository;
  settings: ISettingsRepository;
  initialize(): Promise<void>;
}
