import 'fake-indexeddb/auto';
import { LocalRepository, generateCustomerId } from '../repositories/LocalRepository';
import { customerInputSchema } from '../schemas/customerSchema';

async function runCustomerTests() {
  console.log('--- Starting ClientVault Phase 2 Customer Management Tests ---');
  const repo = new LocalRepository();
  await repo.initialize();

  // Test 1: Validation Rules (Zod)
  console.log('Testing Zod Schema Validation...');
  const invalidName = customerInputSchema.safeParse({
    name: 'A', // too short
    phone: '9876543210',
    businessName: 'Valid Biz',
    businessType: 'Retail',
    address: 'Valid Address',
  });
  if (invalidName.success) throw new Error('Expected validation error for short customer name');

  const invalidGstin = customerInputSchema.safeParse({
    name: 'Amit Patel',
    phone: '9876543210',
    businessName: 'Patel Stores',
    businessType: 'Retail',
    address: '12 Station Road, Ahmedabad',
    gstin: 'INVALID123', // not 15-char standard GSTIN
  });
  if (invalidGstin.success) throw new Error('Expected validation error for malformed GSTIN');

  const validNoGstin = customerInputSchema.safeParse({
    name: 'Suresh Kumar',
    phone: '9876543210',
    businessName: 'Suresh Kirana',
    businessType: 'Retail & Supermarket',
    address: '45 Market Street, Pune',
    gstin: '', // empty is valid
    email: '',
  });
  if (!validNoGstin.success) throw new Error('Expected success for customer without GSTIN');
  console.log('✓ Validation schema passed (strict name/phone, optional GSTIN/Email, format checking)');

  // Test 2: Add Customer with all fields
  const id1 = await generateCustomerId();
  const now = new Date().toISOString();
  const c1 = await repo.customers.create({
    customerId: id1,
    name: 'Vikram Seth',
    businessName: 'Seth Electronics & Appliances',
    businessType: 'Retail & Supermarket',
    phone: '+919811122233',
    gstin: '07AAAAA0000A1Z5',
    email: 'vikram@sethelectronics.com',
    address: 'Shop 14, Connaught Place, New Delhi 110001',
    notes: 'Key client, owns 4 branches',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  });
  if (c1.customerId !== 'CUS-000001') throw new Error(`Expected CUS-000001, got ${c1.customerId}`);
  console.log('✓ Added customer with full details (CUS-000001)');

  // Test 3: Add Customer without GSTIN & Email (mandatory test requirement 3)
  const id2 = await generateCustomerId();
  const c2 = await repo.customers.create({
    customerId: id2,
    name: 'Ananya Roy',
    businessName: 'Roy Handicrafts',
    businessType: 'Other / Custom',
    phone: '+919822233344',
    address: '7 Park Street, Kolkata, West Bengal 700016',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  });
  if (c2.customerId !== 'CUS-000002') throw new Error(`Expected CUS-000002, got ${c2.customerId}`);
  console.log('✓ Added customer without GSTIN & Email (CUS-000002)');

  // Test 4: Duplicate Phone & GSTIN Detection (non-blocking)
  const dupPhone = await repo.customers.checkDuplicatePhone('+919811122233');
  if (!dupPhone || dupPhone.customerId !== 'CUS-000001') {
    throw new Error('Duplicate phone check failed');
  }
  const dupGstin = await repo.customers.checkDuplicateGstin('07AAAAA0000A1Z5');
  if (!dupGstin || dupGstin.customerId !== 'CUS-000001') {
    throw new Error('Duplicate GSTIN check failed');
  }
  // When excluding current customer during edit, should not report self as duplicate
  const selfCheck = await repo.customers.checkDuplicatePhone('+919811122233', 'CUS-000001');
  if (selfCheck !== undefined) {
    throw new Error('Duplicate phone check should exclude current customer on edit');
  }
  console.log('✓ Duplicate phone & GSTIN detection passed (warns without blocking)');

  // Test 5: Edit Customer
  const updated = await repo.customers.update('CUS-000002', {
    businessName: 'Roy Luxury Handicrafts & Decor',
    notes: 'Upgraded to enterprise package',
  });
  if (updated.businessName !== 'Roy Luxury Handicrafts & Decor') {
    throw new Error('Edit customer failed');
  }
  const fetchUpdated = await repo.customers.getById('CUS-000002');
  if (fetchUpdated?.businessName !== 'Roy Luxury Handicrafts & Decor') {
    throw new Error('Persisted edited customer failed');
  }
  console.log('✓ Edit customer passed and verified');

  // Test 6: Archive and Restore Customer
  await repo.customers.archive('CUS-000002');
  let c2Archived = await repo.customers.getById('CUS-000002');
  if (c2Archived?.status !== 'archived') throw new Error('Archive customer failed');

  let activeList = await repo.customers.getAll({ status: 'active' });
  if (activeList.data.some((c) => c.customerId === 'CUS-000002')) {
    throw new Error('Archived customer appeared in active list');
  }

  await repo.customers.restore('CUS-000002');
  let c2Restored = await repo.customers.getById('CUS-000002');
  if (c2Restored?.status !== 'active') throw new Error('Restore customer failed');
  console.log('✓ Archive and restore operations passed');

  // Test 7: Multi-field Search
  const searchByName = await repo.customers.search('vikram');
  if (searchByName.length !== 1 || searchByName[0].customerId !== 'CUS-000001') {
    throw new Error('Search by name failed');
  }
  const searchByGstin = await repo.customers.search('07AAAAA');
  if (searchByGstin.length !== 1 || searchByGstin[0].customerId !== 'CUS-000001') {
    throw new Error('Search by GSTIN failed');
  }
  const searchByPhone = await repo.customers.search('9822233344');
  if (searchByPhone.length !== 1 || searchByPhone[0].customerId !== 'CUS-000002') {
    throw new Error('Search by phone failed');
  }
  const searchById = await repo.customers.search('CUS-000002');
  if (searchById.length !== 1) {
    throw new Error('Search by Customer ID failed');
  }
  console.log('✓ Search across Name, Business, Phone, GSTIN, and Customer ID passed');

  // Test 8: Multiple / Unlimited Customers Batch Test
  console.log('Testing batch customer addition (unlimited capability)...');
  for (let i = 3; i <= 25; i++) {
    const nextId = await generateCustomerId();
    await repo.customers.create({
      customerId: nextId,
      name: `Client Name ${i}`,
      businessName: `Enterprise Biz ${i}`,
      businessType: 'Wholesale & Distribution',
      phone: `+9198000000${String(i).padStart(2, '0')}`,
      address: `Industrial Area Plot ${i}, Sector 62, Noida`,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    });
  }
  const totalCount = await repo.customers.count();
  if (totalCount !== 25) throw new Error(`Expected 25 customers, got ${totalCount}`);
  console.log(`✓ Added 25 customers sequentially, total count verified: ${totalCount}`);

  console.log('\n======================================================');
  console.log('ALL PHASE 2 CUSTOMER MANAGEMENT TESTS PASSED!');
  console.log('======================================================');
}

runCustomerTests().catch((err) => {
  console.error('Customer tests failed:', err);
  process.exit(1);
});
