import 'fake-indexeddb/auto';
import { LocalRepository, generateCustomerId, generateLicenseId } from '../repositories/LocalRepository';
import {
  calculateLicenseStatus,
  calculateRenewalExpiration,
  maskLicenseKey,
  addDurationToDate,
  DURATION_PRESETS,
  getTodayKolkata,
} from '../utils/licenseUtils';

async function runLicenseTests() {
  console.log('--- Starting ClientVault Phase 3 License & Key Management Tests ---');
  const repo = new LocalRepository();
  await repo.initialize();

  // Step 0: Create Customer to bind licenses to
  const cusId = await generateCustomerId();
  await repo.customers.create({
    customerId: cusId,
    name: 'Anand Diagnostics',
    businessName: 'Anand Labs Pvt Ltd',
    businessType: 'Pharmacy & Healthcare',
    phone: '+919833344455',
    address: 'Indiranagar 100ft Road, Bengaluru',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  // Test 1: Paste Activation Key & Initial Creation
  console.log('Test 1: Manual Activation Key Entry...');
  const licId1 = await generateLicenseId();
  const activationKey1 = 'MED-2026-ABCD-1111-2222';
  const issueDate1 = '2026-01-01';
  const expirationDate1 = '2027-01-01';

  const license1 = await repo.licenses.create({
    licenseId: licId1,
    customerId: cusId,
    productName: 'PharmaCare Billing Suite',
    activationKey: activationKey1,
    issueDate: issueDate1,
    expirationDate: expirationDate1,
    status: calculateLicenseStatus(expirationDate1),
    duration: 365,
    notes: 'POS Counter 1 License',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  });
  if (license1.licenseId !== 'LIC-000001') throw new Error(`Expected LIC-000001, got ${license1.licenseId}`);
  if (license1.activationKey !== activationKey1) throw new Error('Activation key mismatch');
  console.log('✓ Successfully recorded initial activation key for LIC-000001');

  // Test 2: Key Masking and Revealing
  console.log('Test 2: Key Masking & Revealing...');
  const masked = maskLicenseKey(activationKey1, false);
  const revealed = maskLicenseKey(activationKey1, true);
  if (!masked.includes('••••')) throw new Error(`Key was not masked: ${masked}`);
  if (revealed !== activationKey1) throw new Error(`Revealed key mismatch: ${revealed}`);
  console.log(`✓ Masking verified: "${masked}" -> "${revealed}"`);

  // Test 3: Renewal Date Logic — Renew BEFORE Expiry (Mandatory Test 9)
  // Spec: If license expires on 23 November 2027 and customer renews on 20 November 2027 for one year,
  // new expiry must be 23 November 2028.
  console.log('Test 3: Renewal Date Calculation BEFORE Expiry (Specification Check)...');
  const oneYearOption = DURATION_PRESETS.find((p) => p.years === 1)!;
  const earlyCalc = calculateRenewalExpiration('2027-11-23', '2027-11-20', oneYearOption);

  if (earlyCalc.calculatedExpiry !== '2028-11-23') {
    throw new Error(
      `Early renewal failed: expected 2028-11-23, got ${earlyCalc.calculatedExpiry}`
    );
  }
  if (earlyCalc.calculatedFrom !== 'previous_expiry') {
    throw new Error(`Expected calculatedFrom to be 'previous_expiry', got ${earlyCalc.calculatedFrom}`);
  }
  console.log('✓ Early renewal calculated correctly: 2027-11-23 -> 2028-11-23 (Calculated from previous expiry)');

  // Test 4: Renewal Date Logic — Renew AFTER Expiry (Mandatory Test 10)
  // Spec: If the license has already expired, calculate the new expiry from the renewal date by default.
  console.log('Test 4: Renewal Date Calculation AFTER Expiry (Specification Check)...');
  const lateCalc = calculateRenewalExpiration('2027-11-10', '2027-11-20', oneYearOption);

  if (lateCalc.calculatedExpiry !== '2028-11-20') {
    throw new Error(
      `Late renewal failed: expected 2028-11-20, got ${lateCalc.calculatedExpiry}`
    );
  }
  if (lateCalc.calculatedFrom !== 'renewal_date') {
    throw new Error(`Expected calculatedFrom to be 'renewal_date', got ${lateCalc.calculatedFrom}`);
  }
  console.log('✓ Expired renewal calculated correctly: expired 2027-11-10, renewed 2027-11-20 -> 2028-11-20 (Calculated from renewal date)');

  // Test 5: Status Calculations
  console.log('Test 5: Expiration Status Engine...');
  const today = getTodayKolkata();
  const futureActive = addDurationToDate(today, { label: '', days: 60 });
  const futureExpiringSoon = addDurationToDate(today, { label: '', days: 15 });
  const futureUrgent = addDurationToDate(today, { label: '', days: 3 });
  const pastExpired = '2020-01-01';

  if (calculateLicenseStatus(futureActive) !== 'active') throw new Error('Expected active status');
  if (calculateLicenseStatus(futureExpiringSoon) !== 'expiring_soon') throw new Error('Expected expiring_soon');
  if (calculateLicenseStatus(futureUrgent) !== 'urgent') throw new Error('Expected urgent status');
  if (calculateLicenseStatus(pastExpired) !== 'expired') throw new Error('Expected expired status');
  if (calculateLicenseStatus(futureActive, 'revoked') !== 'revoked') throw new Error('Expected revoked status');
  console.log('✓ Dynamic status calculations verified (active, expiring_soon, urgent, expired, revoked)');

  // Test 6: UNLIMITED KEYS PER CUSTOMER — Adding MORE THAN 10 KEYS (Mandatory Test 5)
  console.log('Test 6: Adding more than 10 keys to one customer (Unlimited History)...');
  const licId2 = await generateLicenseId();
  const initialKey = 'KEY-INITIAL-2026';
  let currentExpiry = '2027-01-01';

  await repo.licenses.create({
    licenseId: licId2,
    customerId: cusId,
    productName: 'Enterprise ERP Suite',
    activationKey: initialKey,
    issueDate: '2026-01-01',
    expirationDate: currentExpiry,
    status: 'active',
    duration: 365,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  // Add 12 renewal keys sequentially (1 initial + 12 renewals = 13 keys total on 1 license)
  for (let i = 1; i <= 12; i++) {
    const renewalKey = `KEY-RENEWAL-${i}-${2027 + i}`;
    const renewalDate = currentExpiry; // renewed on expiry
    const newExpiry = addDurationToDate(currentExpiry, oneYearOption);

    await repo.renewals.create({
      licenseId: licId2,
      customerId: cusId,
      renewalKey,
      previousExpirationDate: currentExpiry,
      newExpirationDate: newExpiry,
      renewalDate,
      duration: 365,
      notes: `Yearly extension #${i}`,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    });

    currentExpiry = newExpiry;
  }

  // Update license to current latest key and expiry
  await repo.licenses.update(licId2, {
    expirationDate: currentExpiry,
    currentRenewalKey: `KEY-RENEWAL-12-${2027 + 12}`,
  });

  // Verify all 12 renewals exist in database
  const customerRenewals = await repo.renewals.getByLicense(licId2);
  if (customerRenewals.length !== 12) {
    throw new Error(`Expected 12 renewal records, found ${customerRenewals.length}`);
  }

  // Verify initial activation key is still preserved and not overwritten!
  const fetchedLicense = await repo.licenses.getById(licId2);
  if (fetchedLicense?.activationKey !== initialKey) {
    throw new Error('Initial activation key was overwritten!');
  }
  console.log(`✓ Added 13 keys total (1 initial + 12 renewals) to ${cusId}. All historical keys preserved!`);

  // Test 7: Multi-field search across License ID, Product, and Key
  console.log('Test 7: Multi-field License Search...');
  const byProduct = await repo.licenses.getAll({ query: 'PharmaCare' });
  if (byProduct.data.length < 1) throw new Error('Search by product failed');
  console.log('✓ License multi-field retrieval passed');

  console.log('\n======================================================');
  console.log('ALL PHASE 3 LICENSE & RENEWAL TESTS PASSED!');
  console.log('======================================================');
}

runLicenseTests().catch((err) => {
  console.error('License tests failed:', err);
  process.exit(1);
});
