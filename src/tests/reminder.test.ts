import 'fake-indexeddb/auto';
import { LocalRepository, generateCustomerId, generateLicenseId } from '../repositories/LocalRepository';
import {
  generateRemindersForLicense,
  checkAndTriggerDueReminders,
  onLicenseRenewed,
  DEFAULT_REMINDER_INTERVALS,
  calculateReminderDate,
} from '../services/reminderEngine';
import { getTodayKolkata, addDurationToDate } from '../utils/licenseUtils';

async function runReminderTests() {
  console.log('--- Starting ClientVault Phase 4 Reminder Engine Tests ---');
  const repo = new LocalRepository();
  await repo.initialize();

  // Create customer and test license
  const cusId = await generateCustomerId();
  const customer = await repo.customers.create({
    customerId: cusId,
    name: 'Apollo Supermarket',
    businessName: 'Apollo Retail chain',
    businessType: 'Retail & Supermarket',
    phone: '+919988776655',
    address: 'Commercial Street, Bengaluru',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  const licId = await generateLicenseId();
  const today = getTodayKolkata();
  // Set expiration to 30 days in the future
  const expiryDate = addDurationToDate(today, { label: '', days: 30 });

  const license = await repo.licenses.create({
    licenseId: licId,
    customerId: cusId,
    productName: 'RetailPRO Desktop POS',
    activationKey: 'POS-2026-KEY-REMINDER-TEST',
    issueDate: today,
    expirationDate: expiryDate,
    status: 'expiring_soon',
    duration: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  // Test 1: Generate all default reminder intervals (Mandatory Test 12: 30, 15, 7, 3, 0)
  console.log('Test 1: Generating default reminder intervals (30d, 15d, 7d, 3d, 0d)...');
  const reminders = await generateRemindersForLicense(
    license,
    customer,
    DEFAULT_REMINDER_INTERVALS,
    repo
  );

  if (reminders.length !== 5) {
    throw new Error(`Expected 5 reminder schedules, created: ${reminders.length}`);
  }

  const intervals = reminders.map((r) => r.daysBeforeExpiry).sort((a, b) => b - a);
  const expectedIntervals = [30, 15, 7, 3, 0];
  if (JSON.stringify(intervals) !== JSON.stringify(expectedIntervals)) {
    throw new Error(`Intervals mismatch: got ${JSON.stringify(intervals)}`);
  }
  console.log('✓ All 5 default reminder intervals (30, 15, 7, 3, 0) generated successfully');

  // Test 2: Prevent Duplicate Reminders (Mandatory Test 13)
  console.log('Test 2: Verifying Duplicate Reminder Prevention...');
  const secondRun = await generateRemindersForLicense(
    license,
    customer,
    DEFAULT_REMINDER_INTERVALS,
    repo
  );
  if (secondRun.length !== 0) {
    throw new Error(`Expected 0 duplicate reminders to be created, but created ${secondRun.length}`);
  }

  const allRemindersInDb = await repo.reminders.getByLicense(licId);
  if (allRemindersInDb.length !== 5) {
    throw new Error(`Expected strictly 5 reminders in DB, got ${allRemindersInDb.length}`);
  }
  console.log('✓ Duplicate reminder prevention verified (0 duplicates generated on re-run)');

  // Test 3: Due Reminder Processing & In-App Notification Generation
  console.log('Test 3: Due Reminder Processing & Notifications...');
  // The 30-day reminder date for an expiry 30 days from today is TODAY!
  const todayReminderDate = calculateReminderDate(expiryDate, 30);
  if (todayReminderDate !== today) {
    throw new Error(`Expected 30-day reminder date to match today (${today}), got ${todayReminderDate}`);
  }

  const initialUnread = await repo.notifications.getUnreadCount();
  const processResult = await checkAndTriggerDueReminders(repo, false);

  if (processResult.processedCount < 1) {
    throw new Error(`Expected at least 1 due reminder to be processed, got ${processResult.processedCount}`);
  }

  // Verify reminder was marked 'sent'
  const updatedReminders = await repo.reminders.getByLicense(licId);
  const todayRem = updatedReminders.find((r) => r.reminderDate === today);
  if (!todayRem || todayRem.status !== 'sent') {
    throw new Error(`Today's reminder status was not updated to 'sent': ${todayRem?.status}`);
  }

  // Verify in-app notification was generated
  const newUnread = await repo.notifications.getUnreadCount();
  if (newUnread <= initialUnread) {
    throw new Error('In-app notification was not generated for due reminder');
  }
  console.log(`✓ Processed ${processResult.processedCount} due reminder(s) and created in-app notification`);

  // Test 4: Automatic Reminder Update After License Renewal
  console.log('Test 4: Automatic Reminder Re-scheduling on Renewal...');
  const newExpiryDate = addDurationToDate(expiryDate, { label: '', days: 365, years: 1 });
  await onLicenseRenewed(license, newExpiryDate, repo);

  // Verify old reminders for the previous cycle are completed
  const renewalsReminders = await repo.reminders.getByLicense(licId);
  const completedOld = renewalsReminders.filter((r) => r.status === 'completed');
  if (completedOld.length === 0) {
    throw new Error('Old reminders were not marked completed upon renewal');
  }

  // Verify new cycle of reminders for newExpiryDate exists
  const newPending = renewalsReminders.filter((r) => r.status === 'pending');
  if (newPending.length !== 5) {
    throw new Error(`Expected 5 new pending reminder intervals for extended expiry, got ${newPending.length}`);
  }
  console.log('✓ Previous reminders completed and new intervals generated for renewed expiration date');

  // Test 5: Custom Intervals Support
  console.log('Test 5: Custom Reminder Intervals Setting...');
  await repo.settings.set('reminderIntervals', [45, 20, 10, 5, 1, 0]);
  const customSettings = await repo.settings.get<number[]>('reminderIntervals');
  if (!customSettings || customSettings.length !== 6) {
    throw new Error('Custom reminder intervals failed to persist');
  }
  console.log(`✓ Custom reminder intervals verified: [${customSettings.join(', ')}]`);

  console.log('\n======================================================');
  console.log('ALL PHASE 4 REMINDER ENGINE TESTS PASSED!');
  console.log('======================================================');
}

runReminderTests().catch((err) => {
  console.error('Reminder tests failed:', err);
  process.exit(1);
});
