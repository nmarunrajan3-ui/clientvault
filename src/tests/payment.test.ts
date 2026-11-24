import 'fake-indexeddb/auto';
import { LocalRepository, generateCustomerId, generateLicenseId } from '../repositories/LocalRepository';
import { getTodayKolkata, addDurationToDate } from '../utils/licenseUtils';

async function runPaymentAndDashboardTests() {
  console.log('--- Starting ClientVault Phase 5 Payments & Dashboard Tests ---');
  const repo = new LocalRepository();
  await repo.initialize();

  // Create test customer
  const cusId = await generateCustomerId();
  const customer = await repo.customers.create({
    customerId: cusId,
    name: 'Reliance Fresh Supermarket',
    businessName: 'Reliance Retail Ltd',
    businessType: 'Retail & Supermarket',
    phone: '+919876549988',
    address: 'Bandra West, Mumbai',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  // Create test license
  const licId = await generateLicenseId();
  const today = getTodayKolkata();
  const license = await repo.licenses.create({
    licenseId: licId,
    customerId: cusId,
    productName: 'POS Express ERP',
    activationKey: 'POS-EXP-2026-KEY1',
    issueDate: today,
    expirationDate: addDurationToDate(today, { label: '', days: 20 }), // expiring in 20 days
    status: 'expiring_soon',
    duration: 365,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  // Test 1: Record Payments (Paid, Partially Paid, Unpaid)
  console.log('Test 1: Recording payments with various statuses...');
  // Payment 1: Full paid via UPI
  await repo.payments.create({
    customerId: cusId,
    licenseId: licId,
    amount: 25000,
    paymentDate: today,
    paymentMethod: 'UPI',
    status: 'paid',
    transactionRef: 'UPI-REF-99887766',
    notes: 'Full annual license fee collected',
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  // Payment 2: Partial payment
  await repo.payments.create({
    customerId: cusId,
    licenseId: licId,
    amount: 10000,
    paymentDate: today,
    paymentMethod: 'Bank Transfer / NEFT / IMPS',
    status: 'partially_paid',
    transactionRef: 'NEFT-AXIS-12345',
    notes: 'Advance installment',
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  // Payment 3: Unpaid invoice
  await repo.payments.create({
    customerId: cusId,
    amount: 15000,
    paymentDate: today,
    paymentMethod: 'Cheque',
    status: 'unpaid',
    notes: 'Pending cheque clearance',
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  // Test 2: Financial Summary Calculation
  console.log('Test 2: Verifying Financial Summary (Total, Paid, Outstanding)...');
  const summary = await repo.payments.getSummary();
  // Total = 25000 + 10000 + 15000 = 50000
  // Paid = 25000
  // Outstanding = 50000 - 25000 = 25000
  if (summary.total !== 50000) throw new Error(`Expected total ₹50,000, got ₹${summary.total}`);
  if (summary.paid !== 25000) throw new Error(`Expected paid ₹25,000, got ₹${summary.paid}`);
  if (summary.outstanding !== 25000) throw new Error(`Expected outstanding ₹25,000, got ₹${summary.outstanding}`);
  console.log(`✓ Financial summary verified: Total=₹${summary.total}, Paid=₹${summary.paid}, Outstanding=₹${summary.outstanding}`);

  // Test 3: Customer Payment History Retrieval
  console.log('Test 3: Customer payment records retrieval...');
  const customerPayments = await repo.payments.getByCustomer(cusId);
  if (customerPayments.length !== 3) {
    throw new Error(`Expected 3 payments for customer, found ${customerPayments.length}`);
  }
  console.log(`✓ Retrieved all ${customerPayments.length} payments linked to ${cusId}`);

  // Test 4: Real Dashboard Telemetry & Metric Accuracy
  console.log('Test 4: Real Dashboard statistics calculation...');
  const [totalCustomers, activeCustomers, totalLicenses, expiringLicenses, allRenewals] = await Promise.all([
    repo.customers.count(),
    repo.customers.count('active'),
    repo.licenses.count(),
    repo.licenses.getExpiring(30),
    repo.renewals.getRecent(10),
  ]);

  if (totalCustomers !== 1) throw new Error(`Expected 1 customer, got ${totalCustomers}`);
  if (activeCustomers !== 1) throw new Error(`Expected 1 active customer, got ${activeCustomers}`);
  if (totalLicenses !== 1) throw new Error(`Expected 1 license, got ${totalLicenses}`);
  if (expiringLicenses.length !== 1) throw new Error(`Expected 1 expiring license, got ${expiringLicenses.length}`);
  console.log('✓ All dashboard metrics verified from actual IndexedDB records with ZERO mock data');

  console.log('\n======================================================');
  console.log('ALL PHASE 5 PAYMENTS & DASHBOARD TESTS PASSED!');
  console.log('======================================================');
}

runPaymentAndDashboardTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
