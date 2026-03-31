const express = require('express');
const router = express.Router();
const { register, verifyOtp, login, resendOtp, forgetPassword, resetPassword } = require('../controllers/authController');
const { pool } = require('../database/index');

router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.post('/resend-otp', resendOtp);
router.post('/forget-password', forgetPassword);
router.post('/reset-password', resetPassword);

// Test endpoint - create test user and return token
router.post('/test-login', async (req, res) => {
  try {
    const testEmail = 'testuser' + Date.now() + '@test.com';
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('Test@123', 10);
    const referralCode = 'TEST' + Math.random().toString(36).substring(7).toUpperCase();
    
    const result = await pool.query(
      `INSERT INTO "User" (email, password, name, role, referralcode, isverified, createdat) 
       VALUES ($1, $2, $3, $4, $5, true, NOW()) RETURNING id, email, name`,
      [testEmail, hashedPassword, 'Test User', 'USER', referralCode]
    );
    
    const user = result.rows[0];
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
    
    // Create wallet (ignore if already exists)
    try {
      await pool.query(
        `INSERT INTO "Wallet" (userid, usdtbalance, inrbalance, tokenbalance, referralbalance) VALUES ($1, 100, 500, 100, 50)`,
        [user.id]
      );
    } catch (walletErr) {
      console.log('Wallet may already exist:', walletErr.message);
    }
    
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Test login error:', error.message);
    res.status(500).json({ error: 'Test login failed: ' + error.message });
  }
});

module.exports = router;
