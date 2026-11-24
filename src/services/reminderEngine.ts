import type { IRepository } from '../types/repository';
import type { License, Customer, Reminder } from '../types/models';
import { getTodayKolkata, toKolkataDateString, getDaysRemaining } from '../utils/licenseUtils';

export const DEFAULT_REMINDER_INTERVALS = [30, 15, 7, 3, 0];

/**
 * Calculates the reminder date by subtracting daysBefore from expiration date (in Asia/Kolkata).
 */
export function calculateReminderDate(expirationDateStr: string, daysBefore: number): string {
  const expKolkata = toKolkataDateString(expirationDateStr);
  const [year, month, day] = expKolkata.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - daysBefore);

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generates reminder schedules for a license based on configured intervals.
 * Automatically checks and prevents duplicate reminders!
 */
export async function generateRemindersForLicense(
  license: License,
  customer: Customer | undefined,
  intervals: number[] = DEFAULT_REMINDER_INTERVALS,
  repo: IRepository
): Promise<Reminder[]> {
  const now = new Date().toISOString();
  const createdReminders: Reminder[] = [];

  for (const daysBefore of intervals) {
    const reminderDate = calculateReminderDate(license.expirationDate, daysBefore);

    // Prevent duplicate reminders using composite check
    const exists = await repo.reminders.exists(license.licenseId, reminderDate);
    if (!exists) {
      let intervalLabel = `${daysBefore} days before expiration`;
      if (daysBefore === 0) intervalLabel = 'On expiration day';
      else if (daysBefore === 1) intervalLabel = '1 day before expiration';

      const message = `${license.productName} for ${customer?.name || license.customerId} expires in ${daysBefore} days (${new Date(
        license.expirationDate
      ).toLocaleDateString()}). Contact client at ${customer?.phone || 'N/A'}.`;

      const reminder = await repo.reminders.create({
        licenseId: license.licenseId,
        customerId: license.customerId,
        reminderDate,
        daysBeforeExpiry: daysBefore,
        status: 'pending',
        message,
        createdAt: now,
        schemaVersion: 1,
      });

      createdReminders.push(reminder);
    }
  }

  return createdReminders;
}

/**
 * Checks and triggers due reminders.
 * Runs on app startup, on window focus / visibility change, and on manual refresh.
 */
export async function checkAndTriggerDueReminders(
  repo: IRepository,
  triggerDesktopNotification = true
): Promise<{ processedCount: number; dueReminders: Reminder[] }> {
  const today = getTodayKolkata();
  const now = new Date().toISOString();

  // 1. Ensure all active licenses have reminder records generated
  const activeLicenses = await repo.licenses.getAll({ limit: 1000 });
  const customIntervals =
    (await repo.settings.get<number[]>('reminderIntervals')) || DEFAULT_REMINDER_INTERVALS;

  for (const lic of activeLicenses.data) {
    if (lic.status !== 'revoked') {
      const cust = await repo.customers.getById(lic.customerId);
      await generateRemindersForLicense(lic, cust, customIntervals, repo);
    }
  }

  // 2. Fetch pending reminders due on or before today
  const allPending = await repo.reminders.getPending();
  const dueReminders = allPending.filter((r) => r.reminderDate <= today);

  const isDesktopNotifEnabled = Boolean(await repo.settings.get('desktopNotifications'));
  const canSendDesktop =
    triggerDesktopNotification &&
    isDesktopNotifEnabled &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted';

  let processedCount = 0;

  for (const rem of dueReminders) {
    // Mark reminder as 'sent'
    await repo.reminders.update(rem.id!, {
      status: 'sent',
    });

    const license = await repo.licenses.getById(rem.licenseId);
    const customer = await repo.customers.getById(rem.customerId);

    const daysRemaining = license ? getDaysRemaining(license.expirationDate) : 0;
    let urgency = 'Upcoming Renewal';
    if (daysRemaining <= 0) urgency = 'License Expired Today';
    else if (daysRemaining <= 3) urgency = 'CRITICAL: License Expiring Soon';
    else if (daysRemaining <= 7) urgency = 'URGENT: Renewal Due';

    const notifTitle = `${urgency} — ${license?.productName || 'Software License'}`;
    const notifMessage = `${customer?.name || rem.customerId} (${customer?.businessName || ''}): ${
      rem.message || 'License is nearing expiration.'
    } Contact: ${customer?.phone || 'N/A'}`;

    // Create in-app notification
    await repo.notifications.create({
      type: 'reminder',
      title: notifTitle,
      message: notifMessage,
      isRead: 0,
      relatedId: rem.licenseId,
      relatedType: 'license',
      createdAt: now,
      schemaVersion: 1,
    });

    // Send native desktop notification if enabled
    if (canSendDesktop) {
      try {
        new Notification(notifTitle, {
          body: notifMessage,
          icon: '/favicon.svg',
          tag: `rem-${rem.licenseId}-${rem.reminderDate}`, // Prevents duplicate OS notifications
        });
      } catch (err) {
        console.warn('Desktop notification failed:', err);
      }
    }

    processedCount++;
  }

  return { processedCount, dueReminders };
}

/**
 * Handles license renewal by marking obsolete reminders as completed and re-scheduling for the new expiry date.
 */
export async function onLicenseRenewed(
  license: License,
  newExpirationDate: string,
  repo: IRepository
): Promise<void> {
  const existingReminders = await repo.reminders.getByLicense(license.licenseId);

  // Mark all previous pending reminders as completed
  for (const rem of existingReminders) {
    if (rem.status === 'pending' || rem.status === 'sent') {
      await repo.reminders.update(rem.id!, {
        status: 'completed',
      });
    }
  }

  // Generate fresh reminders for the newly extended license
  const customer = await repo.customers.getById(license.customerId);
  const customIntervals =
    (await repo.settings.get<number[]>('reminderIntervals')) || DEFAULT_REMINDER_INTERVALS;

  const updatedLicense: License = {
    ...license,
    expirationDate: newExpirationDate,
  };

  await generateRemindersForLicense(updatedLicense, customer, customIntervals, repo);
}
