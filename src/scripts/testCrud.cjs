global.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const url = 'https://qsoagqpfpfpjbnttejua.supabase.co';
const key = 'sb_publishable_z_ezIPqgMMz6yNFlmLWjQw_yZlsq7oe';

const client = createClient(url, key);

async function testCrud() {
  console.log('Testing Write & Read on Supabase customers table...');
  const testId = 'CUS-TEST-LIVE-001';

  // 1. Insert
  const { data: insertData, error: insertError } = await client
    .from('customers')
    .upsert({
      customer_id: testId,
      name: 'Cloud Connectivity Verification Test',
      phone: '+919999988888',
      business_name: 'ClientVault Cloud Verification Ltd',
      business_type: 'Software & Technology Services',
      address: 'Mumbai, Maharashtra',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      schema_version: 1,
    })
    .select();

  if (insertError) {
    console.error('Insert error:', insertError);
    return;
  }
  console.log('✓ Successfully inserted record into Supabase PostgreSQL:', insertData);

  // 2. Read back
  const { data: readData, error: readError } = await client
    .from('customers')
    .select('*')
    .eq('customer_id', testId);

  if (readError) {
    console.error('Read error:', readError);
    return;
  }
  console.log('✓ Successfully retrieved record from Supabase PostgreSQL:', readData.length, 'records found.');

  // 3. Clean up test record
  await client.from('customers').delete().eq('customer_id', testId);
  console.log('✓ Cleaned up test record. Full Read/Write verified on Supabase Cloud PostgreSQL!');
}

testCrud();
