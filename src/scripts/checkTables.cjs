global.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const url = 'https://qsoagqpfpfpjbnttejua.supabase.co';
const key = 'sb_publishable_z_ezIPqgMMz6yNFlmLWjQw_yZlsq7oe';

const client = createClient(url, key);

async function checkAllTables() {
  const tables = ['customers', 'licenses', 'renewals', 'payments', 'reminders', 'notifications', 'activities', 'settings', 'counters'];
  console.log('Checking all PostgreSQL tables on Supabase...');

  for (const table of tables) {
    const { error } = await client.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`- Table [${table}]: MISSING (${error.message})`);
    } else {
      console.log(`- Table [${table}]: READY`);
    }
  }
}

checkAllTables();
