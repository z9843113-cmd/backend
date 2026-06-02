const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database/index');
const { sendOtp } = require('../utils/email');
const { generateReferralCode, generateOtp } = require('../utils/helpers');

const register = async (req, res) => {
  try {
    const { email, name, mobile, password, referralcode } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existing = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Check if pending registration exists, delete old one
    await pool.query('DELETE FROM "PendingUser" WHERE email = $1', [email]);
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const newReferralCode = generateReferralCode();
    const otp = generateOtp();

    // Store registration data temporarily
    await pool.query(`
      INSERT INTO "PendingUser" (email, name, mobile, password, referralcode, referredby, otp, expiresat, createdat)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [email, name || null, mobile || null, hashedPassword, newReferralCode, referralcode || null, otp, new Date(Date.now() + 10*60*1000)]);

    // Send OTP immediately (don't block response)
    sendOtp(email, otp).catch(err => console.error('Email error:', err.message));
    
    res.status(201).json({ message: 'OTP sent to your email for verification' });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    // Check PendingUser for OTP
    const pendingUser = await pool.query('SELECT * FROM "PendingUser" WHERE email = $1 AND otp = $2', [email, otp]);
    
    if (pendingUser.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const dbNow = await pool.query('SELECT NOW() as now');
    const otpExpiry = new Date(pendingUser.rows[0].expiresat);
    const now = new Date(dbNow.rows[0].now);
    
    if (otpExpiry < now) {
      await pool.query('DELETE FROM "PendingUser" WHERE email = $1', [email]);
      return res.status(400).json({ error: 'OTP expired. Please register again.' });
    }

    const p = pendingUser.rows[0];

    // Create actual user account
    const user = await pool.query(`
      INSERT INTO "User" (email, name, mobile, password, referralcode, referredby, isverified, createdat)
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
      RETURNING id, email, name, mobile, role, referralcode, telegramid
    `, [p.email, p.name, p.mobile, p.password, p.referralcode, p.referredby]);

    const u = user.rows[0];

    // Create wallet
    await pool.query(`INSERT INTO "Wallet" (userid, usdtbalance, inrbalance, tokenbalance) VALUES ($1, 0, 0, 0)`, [u.id]);
    
    // Create reward record
    await pool.query(`INSERT INTO "Reward" (userid, upirewardgiven, bankrewardgiven, telegramrewardgiven) VALUES ($1, false, false, false)`, [u.id]);

    // Delete pending user
    await pool.query('DELETE FROM "PendingUser" WHERE email = $1', [email]);

    const token = jwt.sign({ userId: u.id }, process.env.JWT_SECRET || 'zcrypto_premium_earning_fallback_secret_key_2026', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    
    res.json({ 
      token, 
      user: { 
        id: u.id, 
        email: u.email, 
        name: u.name,
        mobile: u.mobile,
        role: u.role, 
        referralCode: u.referralcode,
        telegramId: u.telegramid 
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const u = user.rows[0];
    
    if (u.isblocked) {
      return res.status(403).json({ error: 'Account blocked' });
    }

    const isValidPassword = await bcrypt.compare(password, u.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: u.id }, process.env.JWT_SECRET || 'zcrypto_premium_earning_fallback_secret_key_2026', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    
    res.json({ 
      token, 
      user: { 
        id: u.id, 
        email: u.email, 
        name: u.name,
        mobile: u.mobile,
        role: u.role, 
        referralCode: u.referralcode,
        telegramId: u.telegramid 
      }
    });
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    res.status(500).json({ error: 'Login failed', detail: error.message });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    
    const pendingUser = await pool.query('SELECT * FROM "PendingUser" WHERE email = $1', [email]);
    if (pendingUser.rows.length === 0) return res.status(404).json({ error: 'Please register first' });
    
    const otp = generateOtp();
    await pool.query(`UPDATE "PendingUser" SET otp = $1, expiresat = $2 WHERE email = $3`, [otp, new Date(Date.now() + 10*60*1000), email]);
    
    sendOtp(email, otp).catch(err => console.error('Email error:', err.message));
    
    res.json({ message: 'OTP resent to your email' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
};

const forgetPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  
  try {
    const user = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Email not registered' });
    }
  } catch (err) {
    console.error('User query error:', err);
    return res.status(500).json({ error: 'Failed to find user' });
  }
  
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  try {
    // Check and fix table schema
    const checkTable = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'PasswordReset' AND column_name = 'token'`);
    if (checkTable.rows.length === 0) {
      // Add token column
      await pool.query(`ALTER TABLE "PasswordReset" ADD COLUMN token VARCHAR(255)`);
      console.log('Added token column to PasswordReset table');
    }
  } catch (e) {
    console.log('Table schema check error:', e.message);
  }
  
  try {
    await pool.query(`DELETE FROM "PasswordReset" WHERE email = $1`, [email]);
    await pool.query(`INSERT INTO "PasswordReset" (email, token, expiresat, createdat) VALUES ($1, $2, $3, NOW())`, [email, resetToken, new Date(Date.now() + 10*60*1000)]);
  } catch (e) {
    console.error('PasswordReset insert error:', e);
  }
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
  
  const BREVO_API_KEY = process.env.EMAIL_PASS;
  if (BREVO_API_KEY) {
    const senderEmail = process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] || 'devxzenox@gmail.com';
    const https = require('https');
    const data = JSON.stringify({
      sender: { name: 'Jex Pay', email: senderEmail },
      to: [{ email }],
      subject: 'Reset Your Password - Jex Pay',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #D4AF37;">Jex Pay</h2>
          <p>Click the button below to reset your password:</p>
          <a href="${resetLink}" style="display: inline-block; background: linear-gradient(to right, #D4AF37, #FFD700); color: black; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Reset Password</a>
          <p>Or copy this link: ${resetLink}</p>
          <p style="color: #666; font-size: 12px;">This link will expire in 10 minutes.</p>
        </div>
      `
    });
    
    const options = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => console.log('Email response:', res.statusCode));
    });
    req.on('error', (e) => console.error('Email error:', e.message));
    req.write(data);
    req.end();
  }
  
  res.json({ message: 'Password reset link sent to your email' });
};

const resetPassword = async (req, res) => {
  try {
    // Fix table schema first
    try {
      const checkTable = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'PasswordReset' AND column_name = 'token'`);
      if (checkTable.rows.length === 0) {
        await pool.query(`ALTER TABLE "PasswordReset" ADD COLUMN token VARCHAR(255)`);
        console.log('Added token column');
      }
    } catch (e) {
      console.log('Schema fix error:', e.message);
    }
    
    const { email, token, newPassword } = req.body;
    console.log('Reset password request:', { email, token: token?.substring(0, 10) });
    
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Email, token and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    let resetRequest;
    try {
      resetRequest = await pool.query('SELECT * FROM "PasswordReset" WHERE email = $1 AND token = $2', [email, token]);
    } catch (err) {
      console.error('Query error:', err.message);
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }
    console.log('Reset request found:', resetRequest.rows.length);
    
    if (resetRequest.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    
    const dbNow = await pool.query('SELECT NOW() as now');
    const otpExpiry = new Date(resetRequest.rows[0].expiresat);
    const now = new Date(dbNow.rows[0].now);
    
    console.log('Expiry:', otpExpiry, 'Now:', now, 'Expired:', otpExpiry < now);
    
    if (otpExpiry < now) {
      await pool.query('DELETE FROM "PasswordReset" WHERE email = $1', [email]);
      return res.status(400).json({ error: 'Token expired. Please request a new one.' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE "User" SET password = $1 WHERE email = $2', [hashedPassword, email]);
    await pool.query('DELETE FROM "PasswordReset" WHERE email = $1', [email]);
    
    res.json({ message: 'Password reset successful. Please login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ error: 'Failed to reset password: ' + error.message });
  }
};

module.exports = { register, verifyOtp, login, resendOtp, forgetPassword, resetPassword };
