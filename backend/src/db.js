const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('⚠️ Unexpected legacy pool client error:', err.message);
});

module.exports = pool;
