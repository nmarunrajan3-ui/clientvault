global.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const url = 'https://qsoagqpfpfpjbnttejua.supabase.co';
const key = 'sb_publishable_z_ezIPqgMMz6yNFlmLWjQw_yZlsq7oe';

const client = createClient(url, key);

async function checkAndSync() {
  const { error } = await client.from('customers').select('*', { count: 'exact', head: true });
  if (error) {
    console.log('Tables not ready yet:', error.message);
    return false;
  }
  console.log('PostgreSQL tables are live and ready on Supabase!');
  return true;
}

checkAndSync();
