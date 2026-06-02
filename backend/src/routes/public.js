const express = require('express');
const router = express.Router();
const { getUpiApps, getCryptoAddresses } = require('../controllers/publicController');
const { pool } = require('../database/index');
const { sendOtp } = require('../utils/email');
const crypto = require('crypto');

console.log('PUBLIC ROUTES LOADING...');

router.get('/test-hello', (req, res) => {
  res.json({ message: 'hello from public' });
});

/*
router.get('/test-email', async (req, res) => {
  const email = req.query.email || 'amitxrajwar@gmail.com';
  const otp = '123456';
  console.log('===========================================');
  console.log('TEST EMAIL ENDPOINT HIT');
  console.log('Target email:', email);
  console.log('ALL ENV KEYS:', Object.keys(process.env).sort().join(', '));
  console.log('EMAIL related env:', Object.entries(process.env).filter(([k]) => k.includes('EMAIL') || k.includes('BREVO')).map(([k,v]) => `${k}=${v?.substring(0,20)}...`).join(', ') || 'NONE');
  console.log('===========================================');
  try {
    await sendOtp(email, otp);
    res.json({ success: true, message: 'Test email sent to ' + email });
  } catch (error) {
    console.error('TEST EMAIL FAILED:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/env-check', (req, res) => {
  res.json({
    envKeys: Object.keys(process.env).sort(),
    emailKeys: Object.entries(process.env).filter(([k]) => k.includes('EMAIL') || k.includes('BREVO')).reduce((acc, [k,v]) => { acc[k] = v ? '***SET***(' + v.length + ' chars)' : 'NOT SET'; return acc; }, {}),
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT
  });
});

router.post('/fix-user-table', async (req, res) => {
  try {
    await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramchatid" VARCHAR(50)`);
    await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramusername" VARCHAR(100)`);
    await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramname" VARCHAR(100)`);
    res.json({ success: true, message: 'Columns added' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});
*/

router.post('/telegram/generate-key', async (req, res) => {
  try {
    const { email, telegramName, telegramUsername, telegramChatId } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    const user = await pool.query('SELECT id FROM "User" WHERE email = $1', [email.toLowerCase()]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const userId = user.rows[0].id;
    
    await pool.query('DELETE FROM "TelegramBindKey" WHERE userid = $1 AND used = false', [userId]);
    const key = 'TG' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 15*60*1000);
    
    await pool.query(
      `INSERT INTO "TelegramBindKey" (userid, key, expiresat, used, createdat) VALUES ($1, $2, $3, false, NOW())`,
      [userId, key, expiresAt]
    );

    if (telegramChatId) {
      await pool.query(
        `UPDATE "User" SET telegramname = $1, telegramusername = $2, telegramchatid = $3 WHERE id = $4`,
        [telegramName || null, telegramUsername || null, String(telegramChatId), userId]
      );
    }
    
    res.json({ key, expiresAt });
  } catch (error) {
    console.error('Generate key error:', error);
    res.status(500).json({ error: 'Failed to generate key' });
  }
});

router.get('/upi-apps', getUpiApps);
router.get('/crypto-addresses', getCryptoAddresses);

router.get('/crypto-rates', async (req, res) => {
  console.log('CRYPTO-RATES ENDPOINT HIT - timestamp:', Date.now());
  try {
    const coins = 'bitcoin,ethereum,tether,binancecoin,solana,ripple,dogecoin,cardano,polkadot,avalanche-2,chainlink,polygon';
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=inr,usd&include_24hr_change=true&include_last_updated_at=true&_=${Date.now()}`
    );
    console.log('CoinGecko response status:', response.status);
    const data = await response.json();
    console.log('CoinGecko data keys:', Object.keys(data).slice(0,5));
    const result = Object.entries(data).map(([id, values]) => ({
      id,
      inr: values.inr,
      usd: values.usd,
      inr_24h_change: values.inr_24h_change,
      usd_24h_change: values.usd_24h_change,
      last_updated_at: values.last_updated_at
    }));
    res.json(result);
  } catch (error) {
    console.error('Crypto rates error:', error.message);
    res.status(500).json({ error: 'Failed to fetch crypto rates' });
  }
});

router.get('/rates', async (req, res) => {
  console.log('RATES ENDPOINT HIT - timestamp:', Date.now());
  try {
    const coins = 'bitcoin,ethereum,tether,binancecoin,solana,ripple,dogecoin,cardano,polkadot,avalanche-2,chainlink,polygon';
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=inr,usd&include_24hr_change=true&include_last_updated_at=true&t=${Date.now()}`
    );
    console.log('CoinGecko response status:', response.status);
    const data = await response.json();
    console.log('CoinGecko data keys:', Object.keys(data).slice(0,5));
    const result = Object.entries(data).map(([id, values]) => ({
      id,
      inr: values.inr,
      usd: values.usd,
      inr_24h_change: values.inr_24h_change,
      usd_24h_change: values.usd_24h_change,
      last_updated_at: values.last_updated_at
    }));
    res.json(result);
  } catch (error) {
    console.error('Rates error:', error.message);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

router.get('/recent-trades', async (req, res) => {
  console.log('RECENT-TRADES ROUTE HIT');
  try {
    // Add cache buster to prevent caching
    const noCache = req.query._ || req.query.t;
    if (noCache) {
      console.log('Recent trades cache bust:', noCache);
    }
    const transactions = await pool.query(`
      SELECT * FROM "Transaction" 
      WHERE status = 'COMPLETED' 
      ORDER BY createdat DESC 
      LIMIT 20
    `);
    
    const anonymousTrades = transactions.rows.map(t => ({
      id: t.id,
      user: 'User' + t.userid.slice(0, 4),
      type: t.type,
      amount: parseFloat(t.amount),
      time: getTimeAgo(new Date(t.createdat))
    }));
    res.json(anonymousTrades);
  } catch (error) {
    console.error('Recent trades error:', error.message);
    res.json([]);
  }
});

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

module.exports = router;
