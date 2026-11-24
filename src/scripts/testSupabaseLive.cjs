global.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const url = 'https://qsoagqpfpfpjbnttejua.supabase.co';
const key = 'sb_publishable_z_ezIPqgMMz6yNFlmLWjQw_yZlsq7oe';

async function testConnection() {
  console.log('Connecting to Supabase at:', url);
  const client = createClient(url, key);

  try {
    const { data, error } = await client.from('customers').select('*', { count: 'exact', head: true });
    if (error) {
      console.log('Supabase connection responded:', error.message);
      if (error.code === '42P01' || error.message.includes('relation "public.customers" does not exist')) {
        console.log('TABLES_NEED_CREATION: Tables do not exist yet.');
      }
      return;
    }
    console.log('SUCCESS: Supabase is 100% connected and tables exist!');
  } catch (err) {
    console.error('Connection error:', err);
  }
}

testConnection();
