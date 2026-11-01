const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const https = require('https');

const { pool } = require('../database/index');
const { generateReferralCode } = require('../utils/helpers');


// ============================================
// REGISTER — DIRECT REGISTRATION
// NO OTP / NO EMAIL VERIFICATION
// ============================================

const register = async (req, res) => {
  let client;

  try {
    const { name, email, mobile, password, referralcode } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email and password are required'
      });
    }

    // Validate input types
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input format'
      });
    }

    // Clean inputs
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile =
      typeof mobile === 'string' && mobile.trim()
        ? mobile.trim()
        : null;

    // Validate name
    if (cleanName.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Name must be at least 2 characters'
      });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Check existing email
    const existing = await pool.query(
      'SELECT id FROM "User" WHERE LOWER(email) = $1',
      [cleanEmail]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered. Please login.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate referral code
    const newReferralCode = generateReferralCode();

    // Connect to database
    client = await pool.connect();

    // Start transaction
    await client.query('BEGIN');

    // Create user — VERIFIED WITHOUT OTP
    const userResult = await client.query(
      `
      INSERT INTO "User"
      (
        email,
        name,
        mobile,
        password,
        referralcode,
        referredby,
        isverified,
        createdat
      )
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
      RETURNING
        id,
        email,
        name,
        mobile,
        role,
        referralcode,
        telegramid
      `,
      [
        cleanEmail,
        cleanName,
        cleanMobile,
        hashedPassword,
        newReferralCode,
        referralcode || null
      ]
    );

    const user = userResult.rows[0];

    // Create wallet
    await client.query(
      `
      INSERT INTO "Wallet"
      (
        userid,
        usdtbalance,
        inrbalance,
        tokenbalance
      )
      VALUES ($1, 0, 0, 0)
      `,
      [user.id]
    );

    // Create rewards record
    await client.query(
      `
      INSERT INTO "Reward"
      (
        userid,
        upirewardgiven,
        bankrewardgiven,
        telegramrewardgiven
      )
      VALUES ($1, false, false, false)
      `,
      [user.id]
    );

    // Commit transaction
    await client.query('COMMIT');

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('WARNING: JWT_SECRET environment variable is missing');
    }

    const token = jwt.sign(
      { userId: user.id },
      jwtSecret || 'zcrypto_premium_earning_fallback_secret_key_2026',
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    );

    console.log('Registration successful:', cleanEmail);

    // Return successful response
    return res.status(201).json({
      success: true,
      message: 'Registration successful. Welcome!',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        referralCode: user.referralcode,
        telegramId: user.telegramid,
        isverified: true
      }
    });

  } catch (error) {

    // Rollback if transaction fails
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    console.error('REGISTER ERROR:', error);

    // Duplicate email
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Email already registered. Please login.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.',
      detail:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined
    });

  } finally {

    if (client) {
      client.release();
    }

  }
};


// ============================================
// LOGIN
// ============================================

const login = async (req, res) => {

  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input format'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const result = await pool.query(
      'SELECT * FROM "User" WHERE LOWER(email) = $1',
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Check blocked account
    if (user.isblocked) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET ||
        'zcrypto_premium_earning_fallback_secret_key_2026',
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        referralCode: user.referralcode,
        telegramId: user.telegramid,
        isverified: user.isverified
      }
    });

  } catch (error) {

    console.error('LOGIN ERROR:', error);

    return res.status(500).json({
      success: false,
      error: 'Login failed'
    });

  }

};


// ============================================
// FORGOT PASSWORD
// BREVO USED ONLY FOR PASSWORD RESET
// ============================================

const forgetPassword = async (req, res) => {

  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {

    const user = await pool.query(
      'SELECT id FROM "User" WHERE LOWER(email) = $1',
      [cleanEmail]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Email not registered'
      });
    }

  } catch (error) {

    console.error('FORGOT PASSWORD QUERY ERROR:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to find user'
    });

  }

  // Generate secure reset token
  const resetToken = crypto.randomBytes(32).toString('hex');

  try {

    await pool.query(
      'DELETE FROM "PasswordReset" WHERE email = $1',
      [cleanEmail]
    );

    await pool.query(
      `
      INSERT INTO "PasswordReset"
      (email, token, expiresat, createdat)
      VALUES ($1, $2, $3, NOW())
      `,
      [
        cleanEmail,
        resetToken,
        new Date(Date.now() + 10 * 60 * 1000)
      ]
    );

  } catch (error) {

    console.error('PASSWORD RESET INSERT ERROR:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to create password reset request'
    });

  }

  const frontendUrl =
    process.env.FRONTEND_URL || 'http://localhost:5173';

  const resetLink =
    `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`;

  const BREVO_API_KEY =
    process.env.BREVO_API_KEY || process.env.EMAIL_PASS;

  // Send email only for password reset
  if (BREVO_API_KEY) {

    const senderEmail =
      process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ||
      process.env.EMAIL_FROM ||
      'devxzenox@gmail.com';

    const data = JSON.stringify({
      sender: {
        name: 'Jex Pay',
        email: senderEmail
      },
      to: [{ email: cleanEmail }],
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

    const emailRequest = https.request(
      options,
      (emailResponse) => {

        let responseBody = '';

        emailResponse.on('data', chunk => {
          responseBody += chunk;
        });

        emailResponse.on('end', () => {

          console.log(
            'Password reset email status:',
            emailResponse.statusCode
          );

          if (emailResponse.statusCode !== 201) {
            console.error(
              'Password reset email failed:',
              responseBody
            );
          }

        });

      }
    );

    emailRequest.on('error', (error) => {
      console.error(
        'PASSWORD RESET EMAIL ERROR:',
        error.message
      );
    });

    emailRequest.write(data);
    emailRequest.end();

  } else {

    console.error(
      'BREVO_API_KEY missing: password reset email cannot be sent'
    );

  }

  return res.status(200).json({
    success: true,
    message: 'Password reset link sent to your email'
  });

};


// ============================================
// RESET PASSWORD
// ============================================

const resetPassword = async (req, res) => {

  try {

    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email, token and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const resetRequest = await pool.query(
      `
      SELECT *
      FROM "PasswordReset"
      WHERE email = $1 AND token = $2
      `,
      [cleanEmail, token]
    );

    if (resetRequest.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Check token expiration
    const dbNow = await pool.query('SELECT NOW() as now');

    const expiry = new Date(resetRequest.rows[0].expiresat);
    const now = new Date(dbNow.rows[0].now);

    if (expiry < now) {

      await pool.query(
        'DELETE FROM "PasswordReset" WHERE email = $1',
        [cleanEmail]
      );

      return res.status(400).json({
        success: false,
        error: 'Token expired. Please request a new one.'
      });

    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE "User" SET password = $1 WHERE LOWER(email) = $2',
      [hashedPassword, cleanEmail]
    );

    // Delete used reset token
    await pool.query(
      'DELETE FROM "PasswordReset" WHERE email = $1',
      [cleanEmail]
    );

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. Please login with your new password.'
    });

  } catch (error) {

    console.error('RESET PASSWORD ERROR:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });

  }

};


// ============================================
// EXPORTS
// ============================================

module.exports = {
  register,
  login,
  forgetPassword,
  resetPassword
};
