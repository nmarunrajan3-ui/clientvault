import {
  saveSupabaseConfig,
  getSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
} from '../services/supabaseClient';
import { SUPABASE_SQL_SCRIPT } from '../components/settings/SqlSchemaModal';

async function runSupabaseIntegrationTests() {
  console.log('--- Starting Supabase Cloud Integration Tests ---');

  // Test 1: Configuration Storage
  console.log('Test 1: Testing Supabase configuration persistence...');
  const testUrl = 'https://demo-clientvault.supabase.co';
  const testKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummykey';

  saveSupabaseConfig(testUrl, testKey);
  const loaded = getSupabaseConfig();

  if (!loaded || loaded.url !== testUrl || loaded.anonKey !== testKey) {
    throw new Error('Supabase configuration failed to save or retrieve');
  }
  console.log('✓ Test 1 Passed: Supabase configuration saved and loaded correctly.');

  // Test 2: Connection test handling
  console.log('\nTest 2: Testing connection handler error gracefully...');
  const connResult = await testSupabaseConnection(testUrl, testKey);
  if (connResult.success) {
    throw new Error('Expected dummy connection to fail');
  }
  console.log(`✓ Test 2 Passed: Connection tester handles unreachable/dummy endpoint gracefully: "${connResult.error}"`);

  // Test 3: SQL Schema verification
  console.log('\nTest 3: Verifying PostgreSQL Schema completeness...');
  const requiredTables = [
    'customers',
    'licenses',
    'renewals',
    'payments',
    'reminders',
    'notifications',
    'activities',
    'settings',
    'counters',
  ];

  for (const table of requiredTables) {
    if (!SUPABASE_SQL_SCRIPT.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
      throw new Error(`SQL schema is missing table definition for: ${table}`);
    }
  }

  if (!SUPABASE_SQL_SCRIPT.includes('ENABLE ROW LEVEL SECURITY')) {
    throw new Error('SQL schema is missing Row Level Security declarations');
  }

  console.log('✓ Test 3 Passed: All 9 PostgreSQL tables and RLS security policies verified in SQL schema.');

  // Cleanup
  clearSupabaseConfig();
  console.log('\n=== ALL SUPABASE CLOUD TESTS PASSED SUCCESSFULLY! ===');
}

runSupabaseIntegrationTests().catch((err) => {
  console.error('Supabase test failed:', err);
  process.exit(1);
});
