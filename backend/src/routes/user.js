const express = require('express');
const router = express.Router();
const { pool } = require('../database/index');
const { auth, getProfile, togglePayment, requestUpiVerification, respondToOtpRequest, verifyUpiOtp, getUpiVerificationStatus, addUpi, getUpiAccounts, setPrimaryUpi, deleteUpi, addBank, getBankAccounts, setPrimaryBank, deleteBank, bindMobile, bindTelegram, generateTelegramKey, setTransactionPin, verifyTransactionPin, setPinEnabled, updatePassword, getSupportLinks, createExchangeRequest, getMyExchangeRequests, getMobileVerificationStatus, requestMobileOtp, submitMobileOtp, cancelMobileVerification, cancelUpiVerification } = require('../controllers/userController');

router.get('/verify', auth, async (req, res) => {
  res.json({ valid: true, user: { id: req.user.id, email: req.user.email, role: req.user.role } });
});

router.get('/profile', auth, getProfile);
router.post('/toggle-payment', auth, togglePayment);
router.post('/upi/request-verification', auth, requestUpiVerification);
router.post('/upi/submit-otp', auth, respondToOtpRequest);
router.post('/upi/verify-otp', auth, verifyUpiOtp);
router.get('/upi/verification-status', auth, getUpiVerificationStatus);
router.post('/upi/cancel', auth, cancelUpiVerification);
router.post('/add-upi', auth, addUpi);
router.post('/set-primary-upi', auth, setPrimaryUpi);
router.get('/upi-accounts', auth, getUpiAccounts);
router.delete('/upi/:id', auth, deleteUpi);
router.post('/add-bank', auth, addBank);
router.post('/set-primary-bank', auth, setPrimaryBank);
router.get('/bank-accounts', auth, getBankAccounts);
router.delete('/bank/:id', auth, deleteBank);
router.post('/bind-mobile', auth, bindMobile);

router.get('/mobile-verification/status', auth, getMobileVerificationStatus);
router.post('/mobile-verification/request-otp', auth, requestMobileOtp);
router.post('/mobile-verification/submit-otp', auth, submitMobileOtp);
router.post('/mobile-verification/cancel', auth, cancelMobileVerification);
router.post('/bind-telegram', auth, async (req, res) => {
  try {
    const { key } = req.body;
    console.log('Bind telegram request - key:', key, 'userid:', req.user.id);
    
    if (!key) return res.status(400).json({ error: 'Key required' });
    
    const keyData = await pool.query(
      'SELECT * FROM "TelegramBindKey" WHERE key = $1 AND userid = $2 AND used = false',
      [key.toUpperCase(), req.user.id]
    );
    
    console.log('Key data found:', keyData.rows.length);
    
    if (keyData.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired key. Please generate a new one.' });
    }
    
    if (new Date() > new Date(keyData.rows[0].expiresat)) {
      return res.status(400).json({ error: 'Key expired. Please generate a new one.' });
    }
    
    await pool.query('UPDATE "TelegramBindKey" SET used = true WHERE id = $1', [keyData.rows[0].id]);
    const user = await pool.query('SELECT telegramchatid FROM "User" WHERE id = $1', [req.user.id]);
    const tgId = user.rows[0]?.telegramchatid || 'BOUND_' + key.toUpperCase();
    await pool.query('UPDATE "User" SET telegramid = $1 WHERE id = $2', [tgId, req.user.id]);
    
    const reward = await pool.query('SELECT * FROM "Reward" WHERE userid = $1', [req.user.id]);
    let rewardGiven = false;
    let rewardAmount = 0;
    
    if (reward.rows.length === 0 || !reward.rows[0].telegramrewardgiven) {
      const settings = await pool.query('SELECT * FROM "Settings" LIMIT 1');
      rewardAmount = settings.rows[0]?.telegramrewardamount || 20;
      await pool.query('UPDATE "Wallet" SET inrbalance = inrbalance + $1 WHERE userid = $2', [rewardAmount, req.user.id]);
      await pool.query(`INSERT INTO "Reward" (userid, upirewardgiven, bankrewardgiven, telegramrewardgiven) VALUES ($1, false, false, true) ON CONFLICT (userid) DO UPDATE SET telegramrewardgiven = true`, [req.user.id]);
      await pool.query(`INSERT INTO "Transaction" (userid, type, amount, status, createdat) VALUES ($1, 'REWARD', $2, 'COMPLETED', NOW())`, [req.user.id, rewardAmount]);
      rewardGiven = true;
    }
    
    console.log('Telegram bound successfully!');
    res.json({ message: 'Telegram bound successfully!', rewardGiven, rewardAmount });
  } catch (error) {
    console.error('Bind telegram error:', error);
    res.status(500).json({ error: 'Failed to bind telegram' });
  }
});
router.post('/generate-telegram-key', auth, generateTelegramKey);
router.post('/verify-telegram-key', auth, async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Key required' });
    
    const keyData = await pool.query('SELECT * FROM "TelegramBindKey" WHERE key = $1 AND userid = $2', [key.toUpperCase(), req.user.id]);
    if (keyData.rows.length === 0) return res.status(400).json({ error: 'Invalid key' });
    if (keyData.rows[0].used) return res.status(400).json({ error: 'Key already used' });
    if (new Date() > new Date(keyData.rows[0].expiresat)) return res.status(400).json({ error: 'Key expired' });
    
    await pool.query('UPDATE "TelegramBindKey" SET used = true WHERE id = $1', [keyData.rows[0].id]);
    await pool.query('UPDATE "User" SET telegramid = $1 WHERE id = $2', ['bound_' + req.user.id, req.user.id]);
    
    const reward = await pool.query('SELECT * FROM "Reward" WHERE userid = $1', [req.user.id]);
    if (reward.rows.length === 0 || !reward.rows[0].telegramrewardgiven) {
      const settings = await pool.query('SELECT * FROM "Settings" LIMIT 1');
      const amount = settings.rows[0]?.telegramrewardamount || 25;
      await pool.query('UPDATE "Wallet" SET inrbalance = inrbalance + $1 WHERE userid = $2', [amount, req.user.id]);
      await pool.query(`INSERT INTO "Reward" (userid, upirewardgiven, bankrewardgiven, telegramrewardgiven) VALUES ($1, false, false, true) ON CONFLICT (userid) DO UPDATE SET telegramrewardgiven = true`, [req.user.id]);
      await pool.query(`INSERT INTO "Transaction" (userid, type, amount, status, createdat) VALUES ($1, 'REWARD', $2, 'COMPLETED', NOW())`, [req.user.id, amount]);
    }
    
    res.json({ message: 'Telegram bound successfully!', rewardGiven: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify key' });
  }
});
router.get('/telegram-key-status', auth, async (req, res) => {
  try {
    const keyData = await pool.query('SELECT * FROM "TelegramBindKey" WHERE userid = $1 AND used = false AND expiresat > NOW() ORDER BY createdat DESC LIMIT 1', [req.user.id]);
    res.json({ hasActiveKey: keyData.rows.length > 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});
router.post('/set-pin', auth, setTransactionPin);
router.post('/verify-pin', auth, verifyTransactionPin);
router.post('/set-pin-enabled', auth, setPinEnabled);
router.post('/update-password', auth, updatePassword);
router.get('/support-links', auth, getSupportLinks);
router.post('/exchange-request', auth, createExchangeRequest);
router.get('/exchange-requests', auth, getMyExchangeRequests);

module.exports = router;
