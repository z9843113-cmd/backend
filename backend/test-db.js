const { Pool } = require('pg');
require('dotenv').config();

async function testConnection(url, label) {
  console.log(`🔌 Testing connection for: ${label}`);
  const parsedUrl = url.replace(/:([^@]+)@/, ':***@');
  console.log(`🔗 URL: ${parsedUrl}`);
  
  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const start = Date.now();
    const result = await pool.query('SELECT NOW()');
    console.log(`✅ Success! Time taken: ${Date.now() - start}ms`);
    console.log(`📅 DB Time:`, result.rows[0].now);
    await pool.end();
    return true;
  } catch (err) {
    console.error(`❌ Failed: ${err.message}`);
    await pool.end();
    return false;
  }
}

async function run() {
  const internalUrl = process.env.DATABASE_URL;
  const externalUrl = internalUrl.replace('-a.oregon-postgres.render.com', '.oregon-postgres.render.com');
  
  await testConnection(internalUrl, 'INTERNAL CONNECTION STRING');
  console.log('\n-----------------------------------------\n');
  await testConnection(externalUrl, 'EXTERNAL CONNECTION STRING');
}

run();
