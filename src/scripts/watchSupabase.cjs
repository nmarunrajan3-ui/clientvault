global.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const url = 'https://qsoagqpfpfpjbnttejua.supabase.co';
const key = 'sb_publishable_z_ezIPqgMMz6yNFlmLWjQw_yZlsq7oe';
const client = createClient(url, key);

async function checkStatus() {
  const { data, error } = await client.from('customers').select('*').limit(1);
  if (error) {
    if (error.code === 'PGRST205') {
      return { ready: false, message: 'Tables not yet created.' };
    }
    return { ready: false, message: error.message };
  }
  return { ready: true, count: data.length };
}

checkStatus().then(r => console.log(JSON.stringify(r)));
