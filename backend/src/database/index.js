const { Pool } = require('pg');

console.log('database/index.js loaded');

// Create pool with conservative settings for Render free tier + PgBouncer
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false }
});

// Prevent unhandled pool errors from crashing the Node process
pool.on('error', (err) => {
  console.error('⚠️ Unexpected pool client error (handled):', err.message);
});

async function migrateColumns() {
  const renames = [];

  for (const [table, oldCol, newCol] of renames) {
    try {
      await pool.query(`ALTER TABLE ${table} RENAME COLUMN ${oldCol} TO ${newCol}`);
      console.log(`Renamed ${oldCol} to ${newCol}`);
    } catch (e) {
      // Column may not exist or already renamed
    }
  }

  // Add missing columns to existing tables
  try {
    await pool.query(`ALTER TABLE "UPIApp" ADD COLUMN IF NOT EXISTS isforjtoken BOOLEAN DEFAULT false`);
    console.log('Added isforjtoken column to UPIApp table');
  } catch (e) {
    // Column may already exist
  }

  // Add discount settings columns
  try {
    await pool.query(`ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS depositdiscountenabled BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS depositdiscountpercent DECIMAL DEFAULT 0`);
    await pool.query(`ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS jtokendiscountenabled BOOLEAN DEFAULT false`);
    console.log('Added discount columns to Settings table');
  } catch (e) {
    console.log('Error migrating Settings table discount columns:', e.message);
  }
}

const initSQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS "User" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  mobile VARCHAR(50),
  role VARCHAR(50) DEFAULT 'USER',
  referralcode VARCHAR(50) UNIQUE NOT NULL,
  referredby VARCHAR(50),
  isverified BOOLEAN DEFAULT false,
  telegramid VARCHAR(255),
  transactionpin VARCHAR(10),
  isblocked BOOLEAN DEFAULT false,
  createdat TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Wallet" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) UNIQUE NOT NULL,
  usdtbalance DECIMAL DEFAULT 0,
  inrbalance DECIMAL DEFAULT 0,
  tokenbalance DECIMAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Deposit" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) NOT NULL,
  amount DECIMAL NOT NULL,
  method VARCHAR(50),
  utr VARCHAR(100),
  txhash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'PENDING',
  createdat TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Withdrawal" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) NOT NULL,
  amount DECIMAL NOT NULL,
  method VARCHAR(50),
  upiid VARCHAR(255),
  bankaccountid VARCHAR(255),
  status VARCHAR(50) DEFAULT 'PENDING',
  createdat TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "UPIAccount" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) NOT NULL,
  upiid VARCHAR(255) NOT NULL,
  appid VARCHAR(255),
  isprimary BOOLEAN DEFAULT false,
  isactive BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'active',
  createdat TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "BankAccount" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) NOT NULL,
  accountnumber VARCHAR(50) NOT NULL,
  ifsc VARCHAR(50) NOT NULL,
  holdername VARCHAR(255) NOT NULL,
  isprimary BOOLEAN DEFAULT false,
  createdat TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "UPIApp" (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  iconurl VARCHAR(255),
  isactive BOOLEAN DEFAULT true,
  isforjtoken BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "CryptoAddress" (
  id VARCHAR(255) PRIMARY KEY,
  coin VARCHAR(50) NOT NULL,
  network VARCHAR(50) NOT NULL,
  address VARCHAR(255) NOT NULL,
  isactive BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS "Transaction" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  amount DECIMAL NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  createdat TIMESTAMP DEFAULT NOW(),
  referralid VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS "Reward" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) UNIQUE NOT NULL,
  upirewardgiven BOOLEAN DEFAULT false,
  bankrewardgiven BOOLEAN DEFAULT false,
  telegramrewardgiven BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Settings" (
  id VARCHAR(255) PRIMARY KEY DEFAULT 'default',
  usdtrate DECIMAL DEFAULT 83,
  tokenrate DECIMAL DEFAULT 0.01,
  referralpercent DECIMAL DEFAULT 5,
  upirewardamount DECIMAL DEFAULT 50,
  bankrewardamount DECIMAL DEFAULT 100,
  telegramrewardamount DECIMAL DEFAULT 25,
  whatsappsupport VARCHAR(255) DEFAULT '',
  telegramsupport VARCHAR(255) DEFAULT '',
  telegramgroup VARCHAR(255) DEFAULT ''
);

CREATE TABLE IF NOT EXISTS "Otp" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(10) NOT NULL,
  expiresat TIMESTAMP NOT NULL,
  createdat TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "TelegramBindKey" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) NOT NULL,
  key VARCHAR(20) UNIQUE NOT NULL,
  expiresat TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  createdat TIMESTAMP DEFAULT NOW()
);
`;

const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  console.log('🔄 Initializing database...');
  
  // 1. Verify connection with retries (10 attempts x 3 seconds = 30 seconds total)
  // Render zero-downtime deploys keep the old container alive for ~30s,
  // so we need to wait long enough for it to release its connections.
  let dbConnected = false;
  const maxRetries = 10;
  const retryDelay = 3000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log(`✅ Database connection verified on attempt ${attempt}!`);
      dbConnected = true;
      break;
    } catch (connectionError) {
      console.warn(`⚠️ Database connection attempt ${attempt}/${maxRetries} failed: ${connectionError.message}`);
      if (attempt < maxRetries) {
        console.log(`🔄 Retrying in ${retryDelay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  if (!dbConnected) {
    console.error('❌ Database connection failed after all attempts.');
    console.log('⚠️ Starting server anyway — database queries will auto-reconnect when connections free up.');
    return true; // Let server start; pg Pool automatically retries on next query
  }

  // 2. Try to run schema creation and migrations
  try {
    console.log('📦 Creating tables...');
    const statements = initSQL.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await pool.query(stmt);
        } catch (queryErr) {
          console.log('ℹ️ Table init statement skipped or already exists:', stmt.substring(0, 50).trim());
        }
      }
    }
    console.log('✅ Tables initialization complete!');
    
    console.log('🔧 Migrating column names...');
    try {
      await migrateColumns();
      console.log('✅ Columns migrated!');
    } catch (migErr) {
      console.log('ℹ️ Column migration skipped:', migErr.message);
    }
    
    // Seed settings and defaults
    try {
      await pool.query(`
        INSERT INTO "Settings" (id, usdtrate, tokenrate, referralpercent, upirewardamount, bankrewardamount, telegramrewardamount, whatsappsupport, telegramsupport, telegramgroup)
        VALUES ('default', 83, 0.01, 5, 50, 100, 25, 'https://wa.me/919999999999', 'https://t.me/zcryptosupport', 'https://t.me/zcryptogroup')
        ON CONFLICT (id) DO NOTHING
      `);
      
      const upiApps = [
        { id: 'paytm', name: 'Paytm' },
        { id: 'phonepe', name: 'PhonePe' },
        { id: 'google-pay', name: 'Google Pay (GPay)' },
        { id: 'bhim', name: 'BHIM' },
        { id: 'amazon-pay', name: 'Amazon Pay' }
      ];
      for (const app of upiApps) {
        await pool.query(`INSERT INTO "UPIApp" (id, name, isactive) VALUES ($1, $2, true) ON CONFLICT (id) DO UPDATE SET isactive = true, name = EXCLUDED.name`, [app.id, app.name]);
      }
      
      await pool.query(`INSERT INTO "CryptoAddress" (id, coin, network, address, isactive) VALUES ('usdt-trc20', 'USDT', 'TRC20', 'TXyqBHxXH6WqE4M5L3VN7CJD9GKfCp2Yv', true) ON CONFLICT (id) DO NOTHING`);
      await pool.query(`INSERT INTO "CryptoAddress" (id, coin, network, address, isactive) VALUES ('usdt-erc20', 'USDT', 'ERC20', '0x8Ba1f109551bD432803012645Hac136E76aCd94', true) ON CONFLICT (id) DO NOTHING`);
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(`
        INSERT INTO "User" (email, password, name, role, referralcode, isverified, createdat)
        VALUES ('admin@premium.com', $1, 'Admin', 'ADMIN', 'ADMIN001', true, NOW())
        ON CONFLICT (email) DO NOTHING
      `, [hashedPassword]);
      
      await pool.query(`INSERT INTO "Wallet" (userid, usdtbalance, inrbalance, tokenbalance) SELECT id, 0, 0, 0 FROM "User" WHERE email = 'admin@premium.com' ON CONFLICT (userid) DO NOTHING`);
      await pool.query(`INSERT INTO "Reward" (userid, upirewardgiven, bankrewardgiven, telegramrewardgiven) SELECT id, false, false, false FROM "User" WHERE email = 'admin@premium.com' ON CONFLICT (userid) DO NOTHING`);
      
      console.log('✅ Seed data and configurations verified!');
    } catch (seedErr) {
      console.log('ℹ️ Seed step skipped:', seedErr.message);
    }

    console.log('✅ Database initialization complete!');
    return true;
  } catch (error) {
    console.warn('⚠️ Warning: Database initialization threw an error but continuing startup:', error.message);
    return true;
  }
}

module.exports = { pool, initializeDatabase };
