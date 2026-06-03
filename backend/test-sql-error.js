const { Pool } = require('pg');
require('dotenv').config();

const url = process.env.DATABASE_URL.replace('-a.oregon-postgres.render.com', '.oregon-postgres.render.com');

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('Testing query on JTokenPurchase with string UUID...');
    
    // 1. Let's find one request
    const findRes = await pool.query('SELECT * FROM "JTokenPurchase" LIMIT 1');
    console.log('Found purchase count:', findRes.rows.length);
    if (findRes.rows.length === 0) {
      console.log('No purchase requests in database. Creating a dummy purchase request to test...');
      // We need a user to create a purchase request. Let's find an admin user.
      const adminRes = await pool.query('SELECT * FROM "User" WHERE email = $1', ['admin@premium.com']);
      if (adminRes.rows.length === 0) {
        console.log('Admin user not found!');
        return;
      }
      const userId = adminRes.rows[0].id;
      const insertRes = await pool.query(
        `INSERT INTO "JTokenPurchase" (userid, method, amount, tokenamount, status) VALUES ($1, 'PAYTM', 5200.00, 500000.00, 'WAITING_ADMIN') RETURNING *`,
        [userId]
      );
      findRes.rows.push(insertRes.rows[0]);
    }

    const testId = findRes.rows[0].id;
    console.log('Testing with JTokenPurchase ID:', testId, 'type:', typeof testId);

    // Let's test the select statement like the one in assignJTokenPurchaseDetails
    console.log('Executing: SELECT * FROM "JTokenPurchase" WHERE id = $1');
    const selectRes = await pool.query('SELECT * FROM "JTokenPurchase" WHERE id = $1', [testId]);
    console.log('Select result length:', selectRes.rows.length);

    // Let's test the update statement like the one in assignJTokenPurchaseDetails
    console.log('Executing update: UPDATE "JTokenPurchase" SET paymentupi = $2 WHERE id = $1');
    const updateRes = await pool.query('UPDATE "JTokenPurchase" SET paymentupi = $2 WHERE id = $1 RETURNING *', [testId, 'test@upi']);
    console.log('Update result length:', updateRes.rows.length);

    // Let's print out the structure of JTokenPurchase table
    console.log('Schema description of JTokenPurchase:');
    const schemaRes = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'JTokenPurchase'
    `);
    console.log(schemaRes.rows);

  } catch (err) {
    console.error('ERROR ENCOUNTERED:', err);
  } finally {
    await pool.end();
  }
}

run();
