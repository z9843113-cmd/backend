const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: { rejectUnauthorized: false }
});

const initSQL = `
-- Users Table
CREATE TABLE IF NOT EXISTS "User" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  mobile VARCHAR(50),
  role VARCHAR(50) DEFAULT 'USER',
  referralCode VARCHAR(50) UNIQUE NOT NULL,
  "referredBy" VARCHAR(50),
  "isVerified" BOOLEAN DEFAULT false,
  "telegramId" VARCHAR(255),
  "transactionPin" VARCHAR(10),
  "isBlocked" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Wallet Table
CREATE TABLE IF NOT EXISTS "Wallet" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" VARCHAR(255) UNIQUE NOT NULL,
  "usdtBalance" DECIMAL DEFAULT 0,
  "inrBalance" DECIMAL DEFAULT 0,
  "tokenBalance" DECIMAL DEFAULT 0,
  "referralBalance" DECIMAL DEFAULT 0,
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Add referralBalance if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Wallet' AND column_name = 'referralBalance') THEN
    ALTER TABLE "Wallet" ADD COLUMN "referralBalance" DECIMAL DEFAULT 0;
  END IF;
END $$;

-- Deposit Table
CREATE TABLE IF NOT EXISTS "Deposit" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) NOT NULL,
  amount DECIMAL NOT NULL,
  method VARCHAR(50),
  utr VARCHAR(100),
  txhash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'PENDING',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (userid) REFERENCES "User"(id) ON DELETE CASCADE
);

-- Withdrawal Table
CREATE TABLE IF NOT EXISTS "Withdrawal" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid VARCHAR(255) NOT NULL,
  amount DECIMAL NOT NULL,
  method VARCHAR(50),
  upiid VARCHAR(255),
  bankaccountid VARCHAR(255),
  status VARCHAR(50) DEFAULT 'PENDING',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (userid) REFERENCES "User"(id) ON DELETE CASCADE
);

-- UPI Account Table
CREATE TABLE IF NOT EXISTS "UPIAccount" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" VARCHAR(255) NOT NULL,
  "upiId" VARCHAR(255) NOT NULL,
  "appId" VARCHAR(255),
  "isPrimary" BOOLEAN DEFAULT false,
  "isActive" BOOLEAN DEFAULT true,
  "status" VARCHAR(50) DEFAULT 'active',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Bank Account Table
CREATE TABLE IF NOT EXISTS "BankAccount" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" VARCHAR(255) NOT NULL,
  "accountNumber" VARCHAR(50) NOT NULL,
  "ifsc" VARCHAR(50) NOT NULL,
  "holderName" VARCHAR(255) NOT NULL,
  "isPrimary" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- UPI App Table
CREATE TABLE IF NOT EXISTS "UPIApp" (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  "iconUrl" VARCHAR(255),
  "isActive" BOOLEAN DEFAULT true,
  "isForJToken" BOOLEAN DEFAULT false
);

-- Crypto Address Table
CREATE TABLE IF NOT EXISTS "CryptoAddress" (
  id VARCHAR(255) PRIMARY KEY,
  coin VARCHAR(50) NOT NULL,
  network VARCHAR(50) NOT NULL,
  address VARCHAR(255) NOT NULL,
  "isActive" BOOLEAN DEFAULT true
);

-- Transaction Table
CREATE TABLE IF NOT EXISTS "Transaction" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  amount DECIMAL NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "referralId" VARCHAR(255),
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Reward Table
CREATE TABLE IF NOT EXISTS "Reward" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" VARCHAR(255) UNIQUE NOT NULL,
  "upiRewardGiven" BOOLEAN DEFAULT false,
  "bankRewardGiven" BOOLEAN DEFAULT false,
  "telegramRewardGiven" BOOLEAN DEFAULT false,
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Settings Table
CREATE TABLE IF NOT EXISTS "Settings" (
  id VARCHAR(255) PRIMARY KEY DEFAULT 'default',
  "usdtRate" DECIMAL DEFAULT 83,
  "tokenRate" DECIMAL DEFAULT 0.01,
  "referralPercent" DECIMAL DEFAULT 5,
  "upiRewardAmount" DECIMAL DEFAULT 50,
  "bankRewardAmount" DECIMAL DEFAULT 100,
  "telegramRewardAmount" DECIMAL DEFAULT 25,
  "whatsappSupport" VARCHAR(255) DEFAULT '',
  "telegramSupport" VARCHAR(255) DEFAULT '',
  "telegramGroup" VARCHAR(255) DEFAULT ''
);

-- OTP Table
CREATE TABLE IF NOT EXISTS "Otp" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(10) NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Telegram Bind Key Table
CREATE TABLE IF NOT EXISTS "TelegramBindKey" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" VARCHAR(255) NOT NULL,
  key VARCHAR(20) UNIQUE NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);
`;

const seedSQL = `
-- Insert default settings if not exists
INSERT INTO "Settings" (id, "usdtRate", "tokenRate", "referralPercent", "upiRewardAmount", "bankRewardAmount", "telegramRewardAmount", "whatsappSupport", "telegramSupport", "telegramGroup")
VALUES ('default', 83, 0.01, 5, 50, 100, 25, 'https://wa.me/919999999999', 'https://t.me/zcryptosupport', 'https://t.me/zcryptogroup')
ON CONFLICT (id) DO NOTHING;

-- Insert UPI Apps if not exists
INSERT INTO "UPIApp" (id, name, "isActive", "isForJToken") VALUES 
('UPI', 'UPI', true, false),
('paytm', 'Paytm', true, false),
('phonepe', 'PhonePe', true, false),
('google-pay', 'Google Pay (GPay)', true, false),
('bhim', 'BHIM', true, false),
('amazon-pay', 'Amazon Pay', true, false)
ON CONFLICT (id) DO NOTHING;

-- Insert Crypto Addresses if not exists
INSERT INTO "CryptoAddress" (id, coin, network, address, "isActive") VALUES 
('usdt-trc20', 'USDT', 'TRC20', 'TXyqBHxXH6WqE4M5L3VN7CJD9GKfCp2Yv', true),
('usdt-erc20', 'USDT', 'ERC20', '0x8Ba1f109551bD432803012645Hac136E76aCd94', true)
ON CONFLICT (id) DO NOTHING;

-- Insert Admin User if not exists
INSERT INTO "User" (id, email, password, name, role, referralCode, "isVerified", "createdAt")
VALUES ('admin-001', 'admin@premium.com', '$2a$10$YourHashedPasswordHere', 'Admin', 'ADMIN', 'ADMIN001', true, NOW())
ON CONFLICT (email) DO NOTHING;
`;

async function initializeDatabase() {
  console.log('🔄 Initializing database...');
  
  try {
    // Create tables
    console.log('📦 Creating tables...');
    await pool.query(initSQL);
    console.log('✅ Tables created successfully!');
    
    // Seed data
    console.log('🌱 Seeding data...');
    await pool.query(seedSQL);
    console.log('✅ Data seeded successfully!');
    
    // Create wallet for admin if not exists
    const adminWallet = await pool.query('SELECT id FROM "Wallet" WHERE "userId" = (SELECT id FROM "User" WHERE email = $1)', ['admin@premium.com']);
    if (adminWallet.rows.length === 0) {
      await pool.query(
        'INSERT INTO "Wallet" ("userId", "usdtBalance", "inrBalance", "tokenBalance") SELECT id, 0, 0, 0 FROM "User" WHERE email = $1',
        ['admin@premium.com']
      );
      console.log('✅ Admin wallet created!');
    }
    
    // Create reward record for admin if not exists
    const adminReward = await pool.query('SELECT id FROM "Reward" WHERE "userId" = (SELECT id FROM "User" WHERE email = $1)', ['admin@premium.com']);
    if (adminReward.rows.length === 0) {
      await pool.query(
        'INSERT INTO "Reward" ("userId", "upiRewardGiven", "bankRewardGiven", "telegramRewardGiven") SELECT id, false, false, false FROM "User" WHERE email = $1',
        ['admin@premium.com']
      );
      console.log('✅ Admin reward record created!');
    }
    
    console.log('🎉 Database initialization complete!');
    await pool.end();
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    await pool.end();
    return false;
  }
}

// Export for use in index.js
module.exports = { initializeDatabase, pool };
