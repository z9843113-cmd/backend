const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database/index');
const { generateReferralCode } = require('../utils/helpers');

const register = async (req, res) => {
  let client;

  try {
    const { email, name, mobile, password, referralcode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email and password are required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    const existing = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'Email already registered'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newReferralCode = generateReferralCode();

    client = await pool.connect();

    await client.query('BEGIN');

    const userResult = await client.query(`
      INSERT INTO "User"
      (email, name, mobile, password, referralcode, referredby, isverified, createdat)
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
      RETURNING id, email, name, mobile, role, referralcode, telegramid
    `, [
      email,
      name,
      mobile || null,
      hashedPassword,
      newReferralCode,
      referralcode || null
    ]);

    const u = userResult.rows[0];

    await client.query(`
      INSERT INTO "Wallet"
      (userid, usdtbalance, inrbalance, tokenbalance)
      VALUES ($1, 0, 0, 0)
    `, [u.id]);

    await client.query(`
      INSERT INTO "Reward"
      (userid, upirewardgiven, bankrewardgiven, telegramrewardgiven)
      VALUES ($1, false, false, false)
    `, [u.id]);

    await client.query('COMMIT');

    const token = jwt.sign(
      { userId: u.id },
      process.env.JWT_SECRET || 'zcrypto_premium_earning_fallback_secret_key_2026',
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    );

    return res.status(201).json({
      message: 'Registration successful',
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
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    console.error('Register error:', error.message);

    return res.status(500).json({
      error: 'Registration failed',
      detail: error.message
    });

  } finally {
    if (client) client.release();
  }
};


const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const result = await pool.query(
      'SELECT * FROM "User" WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const u = result.rows[0];

    if (u.isblocked) {
      return res.status(403).json({
        error: 'Account blocked'
      });
    }

    const isValidPassword = await bcrypt.compare(
      password,
      u.password
    );

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const token = jwt.sign(
      { userId: u.id },
      process.env.JWT_SECRET || 'zcrypto_premium_earning_fallback_secret_key_2026',
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    );

    return res.json({
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
    console.error('Login error:', error.message);

    return res.status(500).json({
      error: 'Login failed',
      detail: error.message
    });
  }
};


const forgetPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'Email is required'
    });
  }

  try {
    const user = await pool.query(
      'SELECT * FROM "User" WHERE email = $1',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        error: 'Email not registered'
      });
    }

  } catch (err) {
    console.error('User query error:', err.message);

    return res.status(500).json({
      error: 'Failed to find user'
    });
  }

  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');

  try {
    const checkTable = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'PasswordReset'
      AND column_name = 'token'
    `);

    if (checkTable.rows.length === 0) {
      await pool.query(`
        ALTER TABLE "PasswordReset"
        ADD COLUMN token VARCHAR(255)
      `);
    }

  } catch (e) {
    console.log('Table schema check:', e.message);
  }

  try {
    await pool.query(
      'DELETE FROM "PasswordReset" WHERE email = $1',
      [email]
    );

    await pool.query(`
      INSERT INTO "PasswordReset"
      (email, token, expiresat, createdat)
      VALUES ($1, $2, $3, NOW())
    `, [
      email,
      resetToken,
      new Date(Date.now() + 10 * 60 * 1000)
    ]);

  } catch (e) {
    console.error('PasswordReset insert error:', e.message);

    return res.status(500).json({
      error: 'Failed to create password reset request'
    });
  }

  const frontendUrl =
    process.env.FRONTEND_URL || 'http://localhost:5173';

  const resetLink =
    `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

  const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.EMAIL_PASS;

  if (BREVO_API_KEY) {
    const senderEmail =
      process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ||
      process.env.EMAIL_FROM ||
      'devxzenox@gmail.com';

    const https = require('https');

    const data = JSON.stringify({
      sender: {
        name: 'Jex Pay',
        email: senderEmail
      },
      to: [{ email }],
      subject: 'Reset Your Password - Jex Pay',
      htmlContent: `
        <div style="font-family:Arial,sans-serif;padding:20px">
          <h2 style="color:#D4AF37">Jex Pay</h2>
          <p>Click below to reset your password:</p>
          <a href="${resetLink}"
          style="background:#D4AF37;color:black;padding:15px 30px;
          text-decoration:none;border-radius:8px;font-weight:bold">
          Reset Password
          </a>
          <p>This link expires in 10 minutes.</p>
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
        'api-key': BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (emailRes) => {
      let responseBody = '';

      emailRes.on('data', chunk => {
        responseBody += chunk;
      });

      emailRes.on('end', () => {
        console.log('Password reset email status:', emailRes.statusCode);

        if (emailRes.statusCode !== 201) {
          console.error('Password reset email failed:', responseBody);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Password reset email error:', e.message);
    });

    req.write(data);
    req.end();
  }

  return res.json({
    message: 'Password reset link sent to your email'
  });
};


const resetPassword = async (req, res) => {
  try {
    const checkTable = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'PasswordReset'
      AND column_name = 'token'
    `);

    if (checkTable.rows.length === 0) {
      await pool.query(`
        ALTER TABLE "PasswordReset"
        ADD COLUMN token VARCHAR(255)
      `);
    }

  } catch (e) {
    console.log('Schema check:', e.message);
  }

  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        error: 'Email, token and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    const resetRequest = await pool.query(
      'SELECT * FROM "PasswordReset" WHERE email = $1 AND token = $2',
      [email, token]
    );

    if (resetRequest.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid token'
      });
    }

    const dbNow = await pool.query('SELECT NOW() as now');

    const expiry = new Date(resetRequest.rows[0].expiresat);
    const now = new Date(dbNow.rows[0].now);

    if (expiry < now) {
      await pool.query(
        'DELETE FROM "PasswordReset" WHERE email = $1',
        [email]
      );

      return res.status(400).json({
        error: 'Token expired. Please request a new one.'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE "User" SET password = $1 WHERE email = $2',
      [hashedPassword, email]
    );

    await pool.query(
      'DELETE FROM "PasswordReset" WHERE email = $1',
      [email]
    );

    return res.json({
      message: 'Password reset successful. Please login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error.message);

    return res.status(500).json({
      error: 'Failed to reset password',
      detail: error.message
    });
  }
};


module.exports = {
  register,
  login,
  forgetPassword,
  resetPassword
};
