const { pool } = require('../database/index');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zcrypto_premium_earning_fallback_secret_key_2026');
    console.log('Auth - decoded:', decoded);
    const user = await pool.query('SELECT * FROM "User" WHERE id = $1', [decoded.userId]);
    console.log('Auth - user query result:', user.rows.length);
    if (user.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    if (user.rows[0].isblocked) return res.status(403).json({ error: 'Account blocked' });
    req.user = user.rows[0];
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};

const getProfile = async (req, res) => {
  // Get fresh user data from database
  const user = await pool.query('SELECT * FROM "User" WHERE id = $1', [req.user.id]);
  const u = user.rows[0];
  res.json({ 
    id: u.id, 
    email: u.email, 
    role: u.role, 
    referralCode: u.referralcode, 
    isVerified: u.isverified, 
    telegramId: u.telegramid, 
    telegramChatId: u.telegramchatid || u.telegramChatId || null,
    telegramUsername: u.telegramusername || u.telegramUsername || null,
    telegramName: u.telegramname || u.telegramName || null,
    mobile: u.mobile, 
    createdAt: u.createdat,
    hasPin: !!u.transactionpin,
    pinEnabled: u.pinenabled || false,
    paymentEnabled: u.paymentenabled !== false
  });
};

const togglePayment = async (req, res) => {
  try {
    const enabled = req.body.enabled;
    if (enabled === undefined || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid value' });
    }
    await pool.query('UPDATE "User" SET paymentenabled = $1 WHERE id = $2', [enabled, req.user.id]);
    res.json({ success: true, paymentEnabled: enabled });
  } catch (error) {
    console.error('Toggle payment error:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
};

const requestUpiVerification = async (req, res) => {
  try {
    const { phone, upiId } = req.body;
    if (!phone || !upiId) return res.status(400).json({ error: 'Phone number and UPI ID required' });

    const existingUpi = await pool.query('SELECT * FROM "UPIAccount" WHERE userid = $1 AND upiid = $2', [req.user.id, upiId.toLowerCase()]);
    if (existingUpi.rows.length > 0) return res.status(400).json({ error: 'UPI already added' });

    const pending = await pool.query('SELECT * FROM "UPIVerification" WHERE userid = $1 AND status IN ($2, $3, $4)', [req.user.id, 'PENDING', 'OTP_REQUESTED', 'OTP_SUBMITTED']);
    if (pending.rows.length > 0) return res.status(400).json({ error: 'You already have a pending UPI request' });

    await pool.query(
      `INSERT INTO "UPIVerification" (userid, phone, upiid, status, createdat, updatedat) VALUES ($1, $2, $3, 'PENDING', NOW(), NOW())`,
      [req.user.id, phone, upiId.toLowerCase()]
    );

    res.json({ success: true, message: 'Request submitted. Wait for admin to ask for code.' });
  } catch (error) {
    console.error('Request UPI verification error:', error);
    res.status(500).json({ error: 'Failed to submit request' });
  }
};

const respondToOtpRequest = async (req, res) => {
  try {
    const verification = await pool.query('SELECT * FROM "UPIVerification" WHERE userid = $1 AND status = $2 ORDER BY createdat DESC LIMIT 1', [req.user.id, 'OTP_REQUESTED']);
    if (verification.rows.length === 0) return res.status(400).json({ error: 'No OTP request pending' });

    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'OTP required' });

    await pool.query('UPDATE "UPIVerification" SET otp = $1, status = $2, updatedat = NOW() WHERE id = $3', [otp, 'OTP_SUBMITTED', verification.rows[0].id]);

    res.json({ success: true, message: 'OTP submitted. Wait for admin approval.' });
  } catch (error) {
    console.error('Respond to OTP request error:', error);
    res.status(500).json({ error: 'Failed to submit OTP' });
  }
};

const verifyUpiOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'OTP required' });

    const verification = await pool.query('SELECT * FROM "UPIVerification" WHERE userid = $1 AND status = $2 ORDER BY createdat DESC LIMIT 1', [req.user.id, 'OTP_SENT']);
    if (verification.rows.length === 0) return res.status(400).json({ error: 'No pending verification request' });

    const v = verification.rows[0];
    if (v.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    if (v.otpexpiresat && new Date(v.otpexpiresat) < new Date()) {
      await pool.query('UPDATE "UPIVerification" SET status = $1, updatedat = NOW() WHERE id = $2', ['EXPIRED', v.id]);
      return res.status(400).json({ error: 'OTP expired' });
    }

    await pool.query('UPDATE "UPIVerification" SET status = $1, updatedat = NOW() WHERE id = $2', ['VERIFIED', v.id]);

    const existingUpi = await pool.query('SELECT * FROM "UPIAccount" WHERE userid = $1 AND upiid = $2', [req.user.id, v.upiid]);
    if (existingUpi.rows.length === 0) {
      await pool.query(`INSERT INTO "UPIAccount" (userid, upiid, isactive, status, createdat) VALUES ($1, $2, true, 'active', NOW())`, [req.user.id, v.upiid]);
    }

    res.json({ success: true, message: 'UPI added successfully' });
  } catch (error) {
    console.error('Verify UPI OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

const getUpiVerificationStatus = async (req, res) => {
  try {
    const verification = await pool.query('SELECT status, phone, upiid, createdat FROM "UPIVerification" WHERE userid = $1 ORDER BY createdat DESC LIMIT 1', [req.user.id]);
    res.json({ verification: verification.rows[0] || null });
  } catch (error) {
    console.error('Get UPI verification status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
};

const addUpi = async (req, res) => {
  try {
    console.log('addUpi called, user:', req.user.id);
    const { upiId, appId } = req.body;
    if (!upiId) return res.status(400).json({ error: 'UPI ID required' });
    const existing = await pool.query('SELECT * FROM "UPIAccount" WHERE userid = $1 AND upiid = $2', [req.user.id, upiId.toLowerCase()]);
    console.log('Existing check:', existing.rows.length);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'UPI already added' });
    
    const result = await pool.query(`INSERT INTO "UPIAccount" (userid, upiid, appid, isactive, status, createdat) VALUES ($1, $2, $3, true, 'active', NOW()) RETURNING *`, [req.user.id, upiId.toLowerCase(), appId || null]);
    console.log('Insert result:', result.rows[0]);
    
    let rewardGiven = false;
    let rewardAmount = 0;
    
    const count = await pool.query('SELECT COUNT(*) as count FROM "UPIAccount" WHERE userid = $1', [req.user.id]);
    if (parseInt(count.rows[0].count) === 1) {
      const settings = await pool.query('SELECT * FROM "Settings" LIMIT 1');
      rewardAmount = settings.rows[0]?.upirewardamount || 20;
      await pool.query('UPDATE "Wallet" SET inrbalance = inrbalance + $1 WHERE userid = $2', [rewardAmount, req.user.id]);
      await pool.query(`INSERT INTO "Transaction" (userid, type, amount, status, createdat) VALUES ($1, 'REWARD', $2, 'COMPLETED', NOW())`, [req.user.id, rewardAmount]);
      rewardGiven = true;
    }
    
    res.json({ message: 'UPI added', upiAccount: result.rows[0], rewardGiven, rewardAmount });
  } catch (error) {
    console.error('addUpi error:', error);
    res.status(500).json({ error: 'Failed to add UPI: ' + error.message });
  }
};

const getUpiAccounts = async (req, res) => {
  const accounts = await pool.query('SELECT * FROM "UPIAccount" WHERE userid = $1 ORDER BY isprimary DESC', [req.user.id]);
  res.json(accounts.rows);
};

const setPrimaryUpi = async (req, res) => {
  try {
    console.log('setPrimaryUpi called, user:', req.user.id, 'upiId:', req.body.upiId);
    const { upiId } = req.body;
    await pool.query('UPDATE "UPIAccount" SET isprimary = false WHERE userid = $1', [req.user.id]);
    console.log('Cleared primary for user');
    await pool.query('UPDATE "UPIAccount" SET isprimary = true WHERE id = $1', [upiId]);
    console.log('Set primary for upi');
    
    const reward = await pool.query('SELECT * FROM "Reward" WHERE userid = $1', [req.user.id]);
    console.log('Reward check:', reward.rows[0]);
    if (reward.rows.length === 0 || !reward.rows[0].upirewardgiven) {
      const settings = await pool.query('SELECT * FROM "Settings" LIMIT 1');
      const amount = settings.rows[0]?.upirewardamount || 50;
      console.log('Giving reward:', amount);
      console.log('Wallet table name test');
      await pool.query('UPDATE "Wallet" SET inrbalance = inrbalance + $1 WHERE userid = $2', [amount, req.user.id]);
      console.log('Wallet updated');
      await pool.query('UPDATE "Reward" SET upirewardgiven = true WHERE userid = $1', [req.user.id]);
      await pool.query(`INSERT INTO "Transaction" (userid, type, amount, status, createdat) VALUES ($1, 'REWARD', $2, 'COMPLETED', NOW())`, [req.user.id, amount]);
      console.log('All reward operations done');
    }
    res.json({ message: 'Primary UPI set' });
  } catch (error) {
    console.error('setPrimaryUpi error:', error);
    res.status(500).json({ error: 'Failed: ' + error.message });
  }
};

const deleteUpi = async (req, res) => {
  await pool.query('DELETE FROM "UPIAccount" WHERE id = $1 AND userid = $2', [req.params.id, req.user.id]);
  res.json({ message: 'Deleted' });
};

const addBank = async (req, res) => {
  try {
    const { accountNumber, ifsc, holderName } = req.body;
    if (!accountNumber || !ifsc || !holderName) return res.status(400).json({ error: 'All fields required' });
    
    const result = await pool.query(`INSERT INTO "BankAccount" (userid, accountnumber, ifsc, holdername, isactive, status, createdat) VALUES ($1, $2, $3, $4, true, 'active', NOW()) RETURNING *`, [req.user.id, accountNumber, ifsc, holderName]);
    
    let rewardGiven = false;
    let rewardAmount = 0;
    
    const count = await pool.query('SELECT COUNT(*) as count FROM "BankAccount" WHERE userid = $1', [req.user.id]);
    if (parseInt(count.rows[0].count) === 1) {
      const settings = await pool.query('SELECT * FROM "Settings" LIMIT 1');
      rewardAmount = settings.rows[0]?.bankrewardamount || 20;
      await pool.query('UPDATE "Wallet" SET inrbalance = inrbalance + $1 WHERE userid = $2', [rewardAmount, req.user.id]);
      await pool.query(`INSERT INTO "Transaction" (userid, type, amount, status, createdat) VALUES ($1, 'REWARD', $2, 'COMPLETED', NOW())`, [req.user.id, rewardAmount]);
      rewardGiven = true;
    }
    
    res.json({ message: 'Bank added', bankAccount: result.rows[0], rewardGiven, rewardAmount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add bank' });
  }
};

const getBankAccounts = async (req, res) => {
  const accounts = await pool.query('SELECT * FROM "BankAccount" WHERE userid = $1 ORDER BY isprimary DESC', [req.user.id]);
  res.json(accounts.rows);
};

const setPrimaryBank = async (req, res) => {
  try {
    const { bankAccountId } = req.body;
    await pool.query('UPDATE "BankAccount" SET isprimary = false WHERE userid = $1', [req.user.id]);
    await pool.query('UPDATE "BankAccount" SET isprimary = true WHERE id = $1', [bankAccountId]);
    
    const reward = await pool.query('SELECT * FROM "Reward" WHERE userid = $1', [req.user.id]);
    if (reward.rows.length === 0 || !reward.rows[0].bankrewardgiven) {
      const settings = await pool.query('SELECT * FROM "Settings" LIMIT 1');
      const amount = settings.rows[0]?.bankrewardamount || 100;
      await pool.query('UPDATE "Wallet" SET inrbalance = inrbalance + $1 WHERE userid = $2', [amount, req.user.id]);
      await pool.query('UPDATE "Reward" SET bankrewardgiven = true WHERE userid = $1', [req.user.id]);
      await pool.query(`INSERT INTO "Transaction" (userid, type, amount, status, createdat) VALUES ($1, 'REWARD', $2, 'COMPLETED', NOW())`, [req.user.id, amount]);
    }
    res.json({ message: 'Primary bank set' });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

const deleteBank = async (req, res) => {
  await pool.query('DELETE FROM "BankAccount" WHERE id = $1 AND userid = $2', [req.params.id, req.user.id]);
  res.json({ message: 'Deleted' });
};

const bindMobile = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ error: 'Mobile number required' });
    
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) return res.status(400).json({ error: 'Invalid mobile number' });
    
    const currentUser = await pool.query('SELECT mobile FROM "User" WHERE id = $1', [req.user.id]);
    const alreadyHasMobile = currentUser.rows[0]?.mobile;
    
    await pool.query('UPDATE "User" SET mobile = $1 WHERE id = $2', [mobile, req.user.id]);
    
    let rewardGiven = false;
    let rewardAmount = 10;
    
    if (!alreadyHasMobile) {
      await pool.query('UPDATE "Wallet" SET inrbalance = inrbalance + $1 WHERE userid = $2', [rewardAmount, req.user.id]);
      await pool.query(`INSERT INTO "Transaction" (userid, type, amount, status, createdat) VALUES ($1, 'MOBILE_BIND', $2, 'COMPLETED', NOW())`, [req.user.id, rewardAmount]);
      rewardGiven = true;
    }
    
    res.json({ message: 'Mobile bound', rewardGiven, rewardAmount: rewardGiven ? rewardAmount : 0 });
  } catch (error) {
    console.error('Bind mobile error:', error);
    res.status(500).json({ error: 'Failed to bind mobile' });
  }
};

const generateTelegramKey = async (req, res) => {
  try {
    console.log('Generating telegram key for user:', req.user.id);
    await pool.query('DELETE FROM "TelegramBindKey" WHERE userid = $1 AND used = false', [req.user.id]);
    const key = 'TG' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 15*60*1000);
    await pool.query(`INSERT INTO "TelegramBindKey" (userid, key, expiresat, used, createdat) VALUES ($1, $2, $3, false, NOW())`, [req.user.id, key, expiresAt]);
    console.log('Key generated:', key);
    res.json({ key, expiresAt });
  } catch (error) {
    console.error('Error generating key:', error);
    res.status(500).json({ error: 'Failed to generate key' });
  }
};

const bindTelegram = async (req, res) => {
  try {
    const { key, chatId, telegramUsername, telegramName } = req.body;
    
    const bindKey = await pool.query(
      'SELECT * FROM "TelegramBindKey" WHERE userid = $1 AND key = $2 AND used = false AND expiresat > NOW()',
      [req.user.id, key]
    );
    
    if (bindKey.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired key' });
    }
    
    // Check and add columns - create temp table first to force column creation
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS "TelegramUserCols" (id SERIAL)`);
    } catch(e) {}
    
    // Now check User table columns
    try {
      const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User'`);
      const telegramCols = cols.rows.filter(r => r.column_name.startsWith('telegram'));
      console.log('Telegram columns in User table:', telegramCols.map(r => r.column_name));
      
      if (!telegramCols.find(c => c.column_name === 'telegramchatid')) {
        await pool.query(`ALTER TABLE "User" ADD COLUMN "telegramchatid" VARCHAR(50)`);
        console.log('Added telegramchatid column');
      }
      if (!telegramCols.find(c => c.column_name === 'telegramusername')) {
        await pool.query(`ALTER TABLE "User" ADD COLUMN "telegramusername" VARCHAR(100)`);
        console.log('Added telegramusername column');
      }
      if (!telegramCols.find(c => c.column_name === 'telegramname')) {
        await pool.query(`ALTER TABLE "User" ADD COLUMN "telegramname" VARCHAR(100)`);
        console.log('Added telegramname column');
      }
    } catch (e) { 
      console.log('Column check error:', e.message); 
    }
    
    await pool.query('UPDATE "TelegramBindKey" SET used = true WHERE id = $1', [bindKey.rows[0].id]);
    
    try {
      const updateResult = await pool.query('UPDATE "User" SET "telegramid" = $1, "telegramchatid" = $2, "telegramusername" = $3, "telegramname" = $4 WHERE id = $5 RETURNING *', 
        [key, chatId || null, telegramUsername || null, telegramName || null, req.user.id]);
      console.log('Update result:', updateResult.rows[0]);
    } catch (e) {
      console.log('Update error:', e.message);
      // Fallback - just update telegramid
      await pool.query('UPDATE "User" SET "telegramid" = $1 WHERE id = $2', [key, req.user.id]);
    }
    
    let rewardGiven = false;
    let rewardAmount = 0;
    
    if (!req.user.telegramid) {
      const settings = await pool.query('SELECT * FROM "Settings" LIMIT 1');
      rewardAmount = settings.rows[0]?.telegramrewardamount || 20;
      await pool.query('UPDATE "Wallet" SET inrbalance = inrbalance + $1 WHERE userid = $2', [rewardAmount, req.user.id]);
      await pool.query(`INSERT INTO "Transaction" (userid, type, amount, status, createdat) VALUES ($1, 'REWARD', $2, 'COMPLETED', NOW())`, [req.user.id, rewardAmount]);
      rewardGiven = true;
    }
    
    res.json({ message: 'Telegram bound successfully', rewardGiven, rewardAmount });
  } catch (error) {
    console.error('Bind telegram error:', error);
    res.status(500).json({ error: 'Failed to bind telegram' });
  }
};

const setTransactionPin = async (req, res) => {
  const { pin } = req.body;
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4 digits' });
  await pool.query('UPDATE "User" SET transactionpin = $1 WHERE id = $2', [pin, req.user.id]);
  res.json({ message: 'PIN set' });
};

const verifyTransactionPin = async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN required' });
  if (!req.user.transactionpin) return res.status(400).json({ error: 'PIN not set' });
  if (req.user.transactionpin !== pin) return res.status(400).json({ error: 'Invalid PIN' });
  res.json({ message: 'PIN verified' });
};

const setPinEnabled = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'Invalid value' });
    
    if (enabled && !req.user.transactionpin) {
      return res.status(400).json({ error: 'Set a PIN first before enabling' });
    }
    
    await pool.query('UPDATE "User" SET pinenabled = $1 WHERE id = $2', [enabled, req.user.id]);
    res.json({ message: enabled ? 'PIN protection enabled' : 'PIN protection disabled', pinEnabled: enabled });
  } catch (error) {
    console.error('Set pin enabled error:', error);
    res.status(500).json({ error: 'Failed to update PIN settings' });
  }
};

const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Passwords required' });
  const isValid = await bcrypt.compare(currentPassword, req.user.password);
  if (!isValid) return res.status(400).json({ error: 'Current password incorrect' });
  const hashed = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE "User" SET password = $1 WHERE id = $2', [hashed, req.user.id]);
  res.json({ message: 'Password updated' });
};

const getSupportLinks = async (req, res) => {
  const settings = await pool.query('SELECT * FROM "Settings" LIMIT 1');
  const s = settings.rows[0] || {};
  res.json({ whatsappSupport: s.whatsappsupport || '', telegramSupport: s.telegramsupport || '', telegramGroup: s.telegramgroup || '' });
};

const createExchangeRequest = async (req, res) => {
  try {
    const { rateType, amount, upiId } = req.body;
    
    if (!rateType || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    
    const rate = rateType === 'GAMING' ? 103 : 108;
    
    const result = await pool.query(
      `INSERT INTO "ExchangeRequest" (userid, ratetype, rate, amount, upiid, status, createdat, updatedat)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW(), NOW()) RETURNING *`,
      [req.user.id, rateType, rate, parseFloat(amount), upiId || null]
    );
    
    res.json({ message: 'Request submitted', request: result.rows[0] });
  } catch (error) {
    console.error('Create exchange request error:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
};

const getMyExchangeRequests = async (req, res) => {
  try {
    const requests = await pool.query(
      'SELECT * FROM "ExchangeRequest" WHERE userid = $1 ORDER BY createdat DESC',
      [req.user.id]
    );
    res.json({ requests: requests.rows });
  } catch (error) {
    console.error('Get exchange requests error:', error);
    res.status(500).json({ error: 'Failed to get requests' });
  }
};

module.exports = { auth, getProfile, togglePayment, requestUpiVerification, respondToOtpRequest, verifyUpiOtp, getUpiVerificationStatus, addUpi, getUpiAccounts, setPrimaryUpi, deleteUpi, addBank, getBankAccounts, setPrimaryBank, deleteBank, bindMobile, bindTelegram, generateTelegramKey, setTransactionPin, verifyTransactionPin, setPinEnabled, updatePassword, getSupportLinks, createExchangeRequest, getMyExchangeRequests };
