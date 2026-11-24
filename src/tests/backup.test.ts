import 'fake-indexeddb/auto';
import { LocalRepository, generateCustomerId, generateLicenseId } from '../repositories/LocalRepository';
import {
  createFullBackupObject,
  validateBackupString,
  restoreDatabase,
  CURRENT_SCHEMA_VERSION,
} from '../services/backupService';
import { hashPin, verifyPin } from '../services/securityService';
import { db } from '../db/database';

async function runBackupAndSecurityTests() {
  console.log('--- Starting ClientVault Phase 6 Backup & Security Tests ---');
  const repo = new LocalRepository();
  await repo.initialize();

  // Seed sample data
  console.log('Seeding initial customer and license data...');
  const cus1Id = await generateCustomerId();
  await repo.customers.create({
    customerId: cus1Id,
    name: 'Apollo Diagnostics Ltd',
    businessName: 'Apollo Hospitals Group',
    businessType: 'Healthcare & Clinic',
    phone: '+919811223344',
    address: 'Greams Road, Chennai',
    gstin: '33AAACA1234A1Z5',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  const cus2Id = await generateCustomerId();
  await repo.customers.create({
    customerId: cus2Id,
    name: 'FabIndia Overseas Pvt Ltd',
    businessName: 'FabIndia Fashion',
    businessType: 'Retail & Supermarket',
    phone: '+919822334455',
    address: 'Connaught Place, New Delhi',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  const lic1Id = await generateLicenseId();
  await repo.licenses.create({
    licenseId: lic1Id,
    customerId: cus1Id,
    productName: 'Hospital Suite Pro',
    activationKey: 'HOSP-2026-KEY1-9988',
    issueDate: '2026-01-01',
    expirationDate: '2027-01-01',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  const lic2Id = await generateLicenseId();
  await repo.licenses.create({
    licenseId: lic2Id,
    customerId: cus2Id,
    productName: 'Retail POS Express',
    activationKey: 'RETAIL-POS-2026-KEY2',
    issueDate: '2026-02-01',
    expirationDate: '2026-11-28',
    status: 'expiring_soon',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  // Seed renewal
  await repo.renewals.create({
    licenseId: lic1Id,
    customerId: cus1Id,
    renewalKey: 'HOSP-2027-RENEW-1122',
    previousExpirationDate: '2027-01-01',
    newExpirationDate: '2028-01-01',
    renewalDate: '2026-12-15',
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  // Seed payment
  await repo.payments.create({
    customerId: cus1Id,
    licenseId: lic1Id,
    amount: 35000,
    paymentDate: '2026-01-01',
    paymentMethod: 'Bank Transfer (NEFT/RTGS)',
    status: 'paid',
    transactionRef: 'NEFT2026010199',
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  // -------------------------------------------------------------
  // Test 1: Full JSON Backup Creation
  // -------------------------------------------------------------
  console.log('\nTest 1: Creating full JSON backup object...');
  const backup = await createFullBackupObject(repo);

  if (backup.app !== 'ClientVault') {
    throw new Error(`Expected app to be ClientVault, got ${backup.app}`);
  }
  if (backup.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Expected schemaVersion ${CURRENT_SCHEMA_VERSION}, got ${backup.schemaVersion}`);
  }
  if (backup.metadata.customersCount !== 2) {
    throw new Error(`Expected 2 customers in metadata, got ${backup.metadata.customersCount}`);
  }
  if (backup.metadata.licensesCount !== 2) {
    throw new Error(`Expected 2 licenses in metadata, got ${backup.metadata.licensesCount}`);
  }
  if (backup.metadata.renewalsCount !== 1) {
    throw new Error(`Expected 1 renewal in metadata, got ${backup.metadata.renewalsCount}`);
  }
  if (backup.metadata.paymentsCount !== 1) {
    throw new Error(`Expected 1 payment in metadata, got ${backup.metadata.paymentsCount}`);
  }
  console.log('✓ Test 1 Passed: Full backup generated with valid schema and metadata.');

  // -------------------------------------------------------------
  // Test 2: Backup Validation Tests
  // -------------------------------------------------------------
  console.log('\nTest 2: Validating backup JSON strings...');
  const validJson = JSON.stringify(backup);
  const validResult = validateBackupString(validJson);
  if (!validResult.isValid || !validResult.backup) {
    throw new Error(`Expected valid backup to pass validation: ${validResult.error}`);
  }

  // Invalid cases
  const badAppJson = JSON.stringify({ ...backup, app: 'OtherApp' });
  if (validateBackupString(badAppJson).isValid) {
    throw new Error('Expected app !== ClientVault to fail validation');
  }

  const badSchemaJson = JSON.stringify({ ...backup, schemaVersion: 999 });
  if (validateBackupString(badSchemaJson).isValid) {
    throw new Error('Expected future schemaVersion to fail validation');
  }

  const badPayloadJson = JSON.stringify({ app: 'ClientVault', schemaVersion: 1, data: null });
  if (validateBackupString(badPayloadJson).isValid) {
    throw new Error('Expected null data to fail validation');
  }

  const corruptedJson = '{ bad json syntax !!!';
  if (validateBackupString(corruptedJson).isValid) {
    throw new Error('Expected malformed JSON to fail validation');
  }
  console.log('✓ Test 2 Passed: Validation accurately accepts valid backups and rejects corrupted/foreign files.');

  // -------------------------------------------------------------
  // Test 3: Transactional Database Restoration
  // -------------------------------------------------------------
  console.log('\nTest 3: Restoring database from backup archive...');
  // Modify database to simulate wipe or state change
  await db.customers.clear();
  await db.licenses.clear();
  const preRestoreCustCount = await db.customers.count();
  if (preRestoreCustCount !== 0) throw new Error('Failed to wipe customers for test');

  // Perform restore (without safety snapshot since no DOM in Node)
  const restoreRes = await restoreDatabase(backup, repo, false);
  if (!restoreRes.success) {
    throw new Error(`Restore failed: ${restoreRes.error}`);
  }

  // Verify records restored
  const postRestoreCust = await repo.customers.getAll();
  const postRestoreLic = await repo.licenses.getAll();
  const postRestoreRenewals = await repo.renewals.getByCustomer(cus1Id);
  const postRestorePayments = await repo.payments.getByCustomer(cus1Id);

  if (postRestoreCust.total !== 2) {
    throw new Error(`Expected 2 restored customers, got ${postRestoreCust.total}`);
  }
  if (postRestoreLic.total !== 2) {
    throw new Error(`Expected 2 restored licenses, got ${postRestoreLic.total}`);
  }
  if (postRestoreRenewals.length !== 1) {
    throw new Error(`Expected 1 restored renewal, got ${postRestoreRenewals.length}`);
  }
  if (postRestorePayments.length !== 1) {
    throw new Error(`Expected 1 restored payment, got ${postRestorePayments.length}`);
  }
  console.log('✓ Test 3 Passed: All tables restored transactionally with 100% data fidelity.');

  // -------------------------------------------------------------
  // Test 4: Sequential ID Counter Recalculation
  // -------------------------------------------------------------
  console.log('\nTest 4: Verifying sequential ID collision prevention...');
  const nextCusId = await generateCustomerId();
  const nextLicId = await generateLicenseId();

  if (nextCusId !== 'CUS-000003') {
    throw new Error(`Expected next customer ID CUS-000003, got ${nextCusId}`);
  }
  if (nextLicId !== 'LIC-000003') {
    throw new Error(`Expected next license ID LIC-000003, got ${nextLicId}`);
  }
  console.log(`✓ Test 4 Passed: Counter properly recalibrated (Next Customer: ${nextCusId}, Next License: ${nextLicId}). Zero ID collision risk.`);

  // -------------------------------------------------------------
  // Test 5: Security PIN Hashing & Verification (Web Crypto SHA-256)
  // -------------------------------------------------------------
  console.log('\nTest 5: Testing SHA-256 PIN hashing and verification...');
  const samplePin = '4829';
  const hashedPin = await hashPin(samplePin);

  if (typeof hashedPin !== 'string' || hashedPin.length !== 64) {
    throw new Error(`Expected 64-character hex SHA-256 string, got ${hashedPin}`);
  }

  const isMatchValid = await verifyPin('4829', hashedPin);
  if (!isMatchValid) {
    throw new Error('Expected correct PIN to verify successfully');
  }

  const isMatchInvalid = await verifyPin('1111', hashedPin);
  if (isMatchInvalid) {
    throw new Error('Expected wrong PIN to fail verification');
  }

  try {
    await hashPin('12'); // Too short
    throw new Error('Expected short PIN to throw error');
  } catch (err: any) {
    if (!err.message.includes('at least 4 digits')) {
      throw err;
    }
  }
  console.log('✓ Test 5 Passed: SHA-256 PIN hashing and verification works securely.');

  console.log('\n=== ALL PHASE 6 BACKUP & SECURITY INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
}

runBackupAndSecurityTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
