const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
