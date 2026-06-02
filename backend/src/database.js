require('dotenv').config();
const { Pool } = require('pg');

let connectionString = process.env.DATABASE_URL || '';
const isNeonPooler = connectionString.includes('neon.tech') && connectionString.includes('-pooler');

if (isNeonPooler) {
  connectionString = connectionString.replace('-pooler', '');
}

const pool = new Pool({
  connectionString,
  max: 5,
  ssl: { rejectUnauthorized: false }
});

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
  pinenabled BOOLEAN DEFAULT false,
  isblocked BOOLEAN DEFAULT false,
  createdat TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Wallet" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) UNIQUE NOT NULL,
  usdtbalance DECIMAL DEFAULT 0,
  inrbalance DECIMAL DEFAULT 0,
  tokenbalance DECIMAL DEFAULT 0,
  referralbalance DECIMAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Deposit" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) NOT NULL,
  amount DECIMAL NOT NULL,
  method VARCHAR(50),
  utr VARCHAR(100),
  txhash VARCHAR(255),
  screenshot TEXT,
  txid VARCHAR(255),
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
  isactive BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS "UPIVerification" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  upiid VARCHAR(255) NOT NULL,
  otp VARCHAR(10),
  otpexpiresat TIMESTAMP,
  status VARCHAR(50) DEFAULT 'PENDING',
  createdat TIMESTAMP DEFAULT NOW(),
  updatedat TIMESTAMP DEFAULT NOW()
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
  tokenamount DECIMAL DEFAULT 0,
  inrvalue DECIMAL DEFAULT 0,
  note TEXT,
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

CREATE TABLE IF NOT EXISTS "JTokenPurchase" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) NOT NULL,
  method VARCHAR(50) NOT NULL,
  amount DECIMAL NOT NULL,
  tokenamount DECIMAL NOT NULL,
  status VARCHAR(50) DEFAULT 'WAITING_ADMIN',
  paymentupi VARCHAR(255),
  qrimage TEXT,
  adminnote TEXT,
  utr VARCHAR(255),
  screenshot TEXT,
  paystartedat TIMESTAMP,
  payexpiresat TIMESTAMP,
  reviewedat TIMESTAMP,
  createdat TIMESTAMP DEFAULT NOW(),
  updatedat TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Settings" (
  id VARCHAR(255) PRIMARY KEY DEFAULT 'default',
  usdtrate DECIMAL DEFAULT 83,
  tokenrate DECIMAL DEFAULT 0.01,
  minjtokenbuy DECIMAL DEFAULT 10,
  referralpercent DECIMAL DEFAULT 5,
  jtokencommissionpercent DECIMAL DEFAULT 4,
  usdtcommissionpercent DECIMAL DEFAULT 0,
  upirewardamount DECIMAL DEFAULT 50,
  bankrewardamount DECIMAL DEFAULT 100,
  telegramrewardamount DECIMAL DEFAULT 25,
  whatsappsupport VARCHAR(255) DEFAULT '',
  telegramsupport VARCHAR(255) DEFAULT '',
  telegramgroup VARCHAR(255) DEFAULT '',
  bannerenabled BOOLEAN DEFAULT true,
  bannertitle VARCHAR(255) DEFAULT 'Welcome Bonus',
  bannersubtitle VARCHAR(255) DEFAULT 'Get 50% extra on first deposit',
  bannerbuttontext VARCHAR(100) DEFAULT 'Claim Now',
  bannerlink VARCHAR(255) DEFAULT '/deposit'
);

CREATE TABLE IF NOT EXISTS "Otp" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(10) NOT NULL,
  expiresat TIMESTAMP NOT NULL,
  createdat TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PendingUser" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  mobile VARCHAR(50),
  password VARCHAR(255) NOT NULL,
  referralcode VARCHAR(50) NOT NULL,
  referredby VARCHAR(50),
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
  try {
    const statements = initSQL.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) await pool.query(stmt);
    }
    console.log('✅ Tables created!');
    
    await pool.query(`
      INSERT INTO "Settings" (id, usdtrate, tokenrate, referralpercent, upirewardamount, bankrewardamount, telegramrewardamount, whatsappsupport, telegramsupport, telegramgroup)
      VALUES ('default', 83, 0.01, 5, 50, 100, 25, 'https://wa.me/919999999999', 'https://t.me/zcryptosupport', 'https://t.me/zcryptogroup')
      ON CONFLICT (id) DO NOTHING
    `);
    
    const upiApps = [
      { id: 'mobikwik', name: 'MobiKwik' },
      { id: 'freecharge', name: 'FreeCharge' },
      { id: 'paytm', name: 'Paytm' },
      { id: 'phonepe', name: 'PhonePe' },
      { id: 'google-pay', name: 'Google Pay' },
      { id: 'bhim', name: 'BHIM' },
      { id: 'amazon-pay', name: 'Amazon Pay' }
    ];
    for (const app of upiApps) {
      await pool.query(`INSERT INTO "UPIApp" (id, name, isactive) VALUES ($1, $2, true) ON CONFLICT (id) DO NOTHING`, [app.id, app.name]);
    }
    
    try {
      await pool.query(`ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS screenshot TEXT`);
      await pool.query(`ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS txid VARCHAR(255)`);
      await pool.query(`ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS cryptoid VARCHAR(255)`);
      await pool.query(`ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS cryptoamount DECIMAL`);
      await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS pinenabled BOOLEAN DEFAULT false`);
      await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS paymentenabled BOOLEAN DEFAULT true`);
      await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS telegramname VARCHAR(255)`);
      await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS telegramusername VARCHAR(255)`);
      await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS telegramchatid VARCHAR(255)`);
      await pool.query(`ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS referralbalance DECIMAL DEFAULT 0`);
      await pool.query(`ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS tokenamount DECIMAL DEFAULT 0`);
      await pool.query(`ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS inrvalue DECIMAL DEFAULT 0`);
      await pool.query(`ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS note TEXT`);
      await pool.query(`ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS minjtokenbuy DECIMAL DEFAULT 10`);
      await pool.query(`ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS jtokencommissionpercent DECIMAL DEFAULT 4`);
      await pool.query(`ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS usdtcommissionpercent DECIMAL DEFAULT 0`);
      await pool.query(`ALTER TABLE "JTokenPurchase" ADD COLUMN IF NOT EXISTS paymentupi VARCHAR(255)`);
      await pool.query(`ALTER TABLE "JTokenPurchase" ADD COLUMN IF NOT EXISTS qrimage TEXT`);
      await pool.query(`ALTER TABLE "JTokenPurchase" ADD COLUMN IF NOT EXISTS adminnote TEXT`);
      await pool.query(`ALTER TABLE "JTokenPurchase" ADD COLUMN IF NOT EXISTS utr VARCHAR(255)`);
      await pool.query(`ALTER TABLE "JTokenPurchase" ADD COLUMN IF NOT EXISTS screenshot TEXT`);
      await pool.query(`ALTER TABLE "JTokenPurchase" ADD COLUMN IF NOT EXISTS paystartedat TIMESTAMP`);
      await pool.query(`ALTER TABLE "JTokenPurchase" ADD COLUMN IF NOT EXISTS payexpiresat TIMESTAMP`);
      await pool.query(`ALTER TABLE "JTokenPurchase" ADD COLUMN IF NOT EXISTS reviewedat TIMESTAMP`);
      await pool.query(`ALTER TABLE "JTokenPurchase" ADD COLUMN IF NOT EXISTS updatedat TIMESTAMP DEFAULT NOW()`);
      await pool.query(`ALTER TABLE "JTokenPurchase" ADD COLUMN IF NOT EXISTS method VARCHAR(50) DEFAULT 'UPI'`);

      await pool.query(`
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          userid VARCHAR(255) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          upiid VARCHAR(255) NOT NULL,
          otp VARCHAR(10),
          otpexpiresat TIMESTAMP,
          status VARCHAR(50) DEFAULT 'PENDING',
          createdat TIMESTAMP DEFAULT NOW(),
          updatedat TIMESTAMP DEFAULT NOW()
        )
      `);
      await pool.query(`UPDATE "Settings" SET minjtokenbuy = COALESCE(minjtokenbuy, 10), jtokencommissionpercent = COALESCE(jtokencommissionpercent, 4), usdtcommissionpercent = COALESCE(usdtcommissionpercent, 0) WHERE id = 'default'`);
      
      // Migration: Add isactive and status to UPIAccount
      await pool.query(`ALTER TABLE "UPIAccount" ADD COLUMN IF NOT EXISTS isactive BOOLEAN DEFAULT true`);
      await pool.query(`ALTER TABLE "UPIAccount" ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'`);
      
      // Migration: Add isactive and status to BankAccount
      await pool.query(`ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS isactive BOOLEAN DEFAULT true`);
      await pool.query(`ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'`);
      
      // Create ExchangeRequest table for USDT sell requests
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "ExchangeRequest" (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          userid VARCHAR(255) NOT NULL,
          ratetype VARCHAR(50) NOT NULL,
          rate NUMERIC NOT NULL,
          amount NUMERIC NOT NULL,
          upiid VARCHAR(255),
          status VARCHAR(50) DEFAULT 'PENDING',
          adminnote VARCHAR(500),
          createdat TIMESTAMP DEFAULT NOW(),
          updatedat TIMESTAMP DEFAULT NOW()
        )
      `);
      
      console.log('✅ New columns and tables added');
    } catch (err) {
      console.log('ℹ️ Columns already exist or error:', err.message);
    }
    
    await pool.query(`INSERT INTO "CryptoAddress" (id, coin, network, address, isactive) VALUES ('usdt-trc20', 'USDT', 'TRC20', 'TXyqBHxXH6WqE4M5L3VN7CJD9GKfCp2Yv', true) ON CONFLICT (id) DO NOTHING`);
    
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await pool.query(`
      INSERT INTO "User" (email, password, name, role, referralcode, isverified, createdat)
      VALUES ('admin@premium.com', $1, 'Admin', 'ADMIN', 'ADMIN001', true, NOW())
      ON CONFLICT (email) DO NOTHING
    `, [hashedPassword]);
    
    await pool.query(`INSERT INTO "Wallet" (userid, usdtbalance, inrbalance, tokenbalance) SELECT id, 0, 0, 0 FROM "User" WHERE email = 'admin@premium.com' ON CONFLICT (userid) DO NOTHING`);
    await pool.query(`INSERT INTO "Reward" (userid, upirewardgiven, bankrewardgiven, telegramrewardgiven) SELECT id, false, false, false FROM "User" WHERE email = 'admin@premium.com' ON CONFLICT (userid) DO NOTHING`);
    
    console.log('✅ Database initialized!');
    return true;
  } catch (error) {
    console.error('❌ DB Init failed:', error.message);
    return false;
  }
}

module.exports = { pool, initializeDatabase };
