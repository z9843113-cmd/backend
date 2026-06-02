const jwt = require('jsonwebtoken');
const { pool } = require('../database/index');

const auth = async (req, res, next) => {
  try {
    console.log('MIDDLEWARE AUTH - Checking token');
    const authHeader = req.headers.authorization;
    console.log('MIDDLEWARE AUTH - authHeader:', authHeader ? 'present' : 'missing');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('MIDDLEWARE AUTH - No bearer token');
      return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.split(' ')[1];
    console.log('MIDDLEWARE AUTH - Token length:', token.length);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zcrypto_premium_earning_fallback_secret_key_2026');
    console.log('MIDDLEWARE AUTH - Decoded:', decoded);
    const user = await pool.query('SELECT * FROM "User" WHERE id = $1', [decoded.userId]);
    console.log('MIDDLEWARE AUTH - User found:', user.rows.length);
    if (user.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    if (user.rows[0].isblocked) return res.status(403).json({ error: 'Account blocked' });
    req.user = user.rows[0];
    next();
  } catch (error) {
    console.log('MIDDLEWARE AUTH - Error:', error.message);
    console.log('MIDDLEWARE AUTH - Error name:', error.name);
    console.log('MIDDLEWARE AUTH - Error stack:', error.stack);
    res.status(401).json({ error: 'Invalid token', details: error.message });
  }
};

module.exports = auth;
