export type CustomerStatus = 'active' | 'archived';

export interface Customer {
  id?: number;
  customerId: string;
  name: string;
  phone: string;
  businessName: string;
  businessType: string;
  address: string;
  gstin?: string;
  email?: string;
  notes?: string;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export type LicenseStatus = 'active' | 'expiring_soon' | 'urgent' | 'expired' | 'revoked';

export interface License {
  id?: number;
  licenseId: string;
  customerId: string;
  productName: string;
  activationKey: string;
  currentRenewalKey?: string;
  issueDate: string;
  expirationDate: string;
  status: LicenseStatus;
  duration?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface Renewal {
  id?: number;
  licenseId: string;
  customerId: string;
  renewalKey: string;
  previousExpirationDate: string;
  newExpirationDate: string;
  renewalDate: string;
  duration?: number;
  notes?: string;
  createdAt: string;
  schemaVersion: number;
}

export type PaymentStatus = 'paid' | 'partially_paid' | 'unpaid';

export interface Payment {
  id?: number;
  customerId: string;
  licenseId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  status: PaymentStatus;
  transactionRef?: string;
  notes?: string;
  createdAt: string;
  schemaVersion: number;
}

export type ReminderStatus = 'pending' | 'sent' | 'completed' | 'dismissed';

export interface Reminder {
  id?: number;
  licenseId: string;
  customerId: string;
  reminderDate: string;
  daysBeforeExpiry: number;
  status: ReminderStatus;
  message?: string;
  createdAt: string;
  schemaVersion: number;
}

export type NotificationType = 'reminder' | 'expiry' | 'renewal' | 'system' | 'payment' | 'customer';

export interface Notification {
  id?: number;
  type: NotificationType;
  title: string;
  message: string;
  isRead: number;
  relatedId?: string;
  relatedType?: 'customer' | 'license' | 'payment';
  createdAt: string;
  schemaVersion: number;
}

export type ActivityType =
  | 'customer_created' | 'customer_updated' | 'customer_archived' | 'customer_restored'
  | 'license_created' | 'license_renewed' | 'license_revoked'
  | 'payment_recorded' | 'backup_created' | 'backup_restored' | 'settings_changed';

export interface Activity {
  id?: number;
  customerId?: string;
  licenseId?: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  schemaVersion: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface Counter {
  name: string;
  value: number;
}
