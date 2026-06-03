require('dotenv').config({ path: './.env' });
const { Pool } = require('pg');

let url = process.env.DATABASE_URL;
if (url.includes('-a.oregon-postgres')) {
  url = url.replace('-a.oregon-postgres', '.oregon-postgres');
}
console.log('Connecting to:', url.replace(/:([^@]+)@/, ':***@'));

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const apps = await pool.query('SELECT * FROM "UPIApp"');
    console.log('--- UPI Apps ---');
    console.log(apps.rows);
    
    const settings = await pool.query('SELECT * FROM "Settings"');
    console.log('--- Settings ---');
    console.log(settings.rows[0]);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

check();
