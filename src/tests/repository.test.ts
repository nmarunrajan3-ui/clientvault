import 'fake-indexeddb/auto';
import { LocalRepository, generateCustomerId, generateLicenseId } from '../repositories/LocalRepository';

async function runTests() {
  console.log('--- Starting ClientVault LocalRepository Integration Tests ---');
  const repo = new LocalRepository();
  await repo.initialize();
  console.log('✓ Database initialized successfully with default settings');

  // Test 1: ID Generators
  const cusId1 = await generateCustomerId();
  const cusId2 = await generateCustomerId();
  if (cusId1 !== 'CUS-000001' || cusId2 !== 'CUS-000002') {
    throw new Error(`Customer ID generation failed: got ${cusId1}, ${cusId2}`);
  }
  const licId1 = await generateLicenseId();
  if (licId1 !== 'LIC-000001') {
    throw new Error(`License ID generation failed: got ${licId1}`);
  }
  console.log('✓ Sequential ID generators passed (CUS-000001, CUS-000002, LIC-000001)');

  // Test 2: Customer Repository CRUD & Search
  const customer = await repo.customers.create({
    customerId: cusId1,
    name: 'Rajesh Sharma',
    businessName: 'Sharma Tech Solutions',
    businessType: 'IT Services',
    phone: '+919876543210',
    gstin: '29ABCDE1234F1Z5',
    email: 'rajesh@sharmatech.in',
    address: '123 MG Road, Bengaluru, Karnataka 560001',
    notes: 'Premium client, 3 desktop POS licenses',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  });
  console.log('✓ Customer created:', customer.customerId, customer.name);

  const fetched = await repo.customers.getById(cusId1);
  if (!fetched || fetched.businessName !== 'Sharma Tech Solutions') {
    throw new Error('Customer getById failed');
  }
  console.log('✓ Customer retrieved by ID');

  const searchResults = await repo.customers.search('sharma');
  if (searchResults.length !== 1 || searchResults[0].customerId !== cusId1) {
    throw new Error(`Customer search failed: found ${searchResults.length}`);
  }
  console.log('✓ Customer search passed');

  const dupGstin = await repo.customers.checkDuplicateGstin('29ABCDE1234F1Z5');
  if (!dupGstin) throw new Error('Duplicate GSTIN check failed');
  console.log('✓ Duplicate GSTIN detection passed');

  // Test 3: License Repository
  const license = await repo.licenses.create({
    licenseId: licId1,
    customerId: cusId1,
    productName: 'RetailPRO Desktop POS',
    activationKey: 'POS-2026-ABCD-EFGH-1234',
    issueDate: new Date('2026-01-01').toISOString(),
    expirationDate: new Date('2026-12-31').toISOString(),
    status: 'active',
    duration: 365,
    notes: 'Single PC activation key generated externally',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  });
  console.log('✓ License created:', license.licenseId, license.productName);

  const customerLicenses = await repo.licenses.getByCustomer(cusId1);
  if (customerLicenses.length !== 1) throw new Error('License getByCustomer failed');
  console.log('✓ Licenses by customer passed');

  // Test 4: Renewal Repository
  const renewal = await repo.renewals.create({
    licenseId: licId1,
    customerId: cusId1,
    renewalKey: 'REN-2027-WXYZ-5678',
    previousExpirationDate: license.expirationDate,
    newExpirationDate: new Date('2027-12-31').toISOString(),
    renewalDate: new Date('2026-11-23').toISOString(),
    duration: 365,
    notes: 'Renewed for year 2027',
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  });
  console.log('✓ Renewal recorded:', renewal.renewalKey);

  const renewals = await repo.renewals.getByLicense(licId1);
  if (renewals.length !== 1 || renewals[0].renewalKey !== 'REN-2027-WXYZ-5678') {
    throw new Error('Renewal retrieval failed');
  }
  console.log('✓ Renewal history preserved and retrieved');

  // Test 5: Payment Repository
  await repo.payments.create({
    customerId: cusId1,
    licenseId: licId1,
    amount: 15000,
    paymentDate: new Date().toISOString(),
    paymentMethod: 'UPI',
    status: 'paid',
    transactionRef: 'UPI-20261123-9988',
    notes: 'Annual license fee',
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  });
  const summary = await repo.payments.getSummary();
  if (summary.total !== 15000 || summary.paid !== 15000 || summary.outstanding !== 0) {
    throw new Error(`Payment summary mismatch: ${JSON.stringify(summary)}`);
  }
  console.log('✓ Payment tracking & summary passed (Total: ₹15,000, Paid: ₹15,000)');

  // Test 6: Notification Repository
  const notif = await repo.notifications.create({
    type: 'system',
    title: 'ClientVault Offline Mode Ready',
    message: 'Local database initialized with zero cloud dependencies.',
    isRead: 0,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  });
  let unread = await repo.notifications.getUnreadCount();
  if (unread !== 1) throw new Error(`Expected 1 unread notification, got ${unread}`);
  await repo.notifications.markAsRead(notif.id!);
  unread = await repo.notifications.getUnreadCount();
  if (unread !== 0) throw new Error(`Expected 0 unread notification, got ${unread}`);
  console.log('✓ Notification system unread & mark-as-read passed');

  // Test 7: Settings Repository
  await repo.settings.set('theme', 'dark');
  const theme = await repo.settings.get('theme');
  if (theme !== 'dark') throw new Error(`Settings get/set failed, got ${theme}`);
  const allSettings = await repo.settings.getAll();
  if (allSettings.timezone !== 'Asia/Kolkata') {
    throw new Error(`Default timezone should be Asia/Kolkata, got ${allSettings.timezone}`);
  }
  console.log('✓ Settings persistence passed (Timezone: Asia/Kolkata, Theme: dark)');

  console.log('\n======================================================');
  console.log('ALL PHASE 1 LOCAL REPOSITORY INTEGRATION TESTS PASSED!');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
