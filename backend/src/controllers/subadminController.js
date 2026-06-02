const { pool } = require('../database/index');
const bcrypt = require('bcryptjs');
const { generateReferralCode } = require('../utils/helpers');

const getSubadmins = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, mobile, role, referralcode, isblocked, createdat 
       FROM "User" 
       WHERE role = 'SUBADMIN' 
       ORDER BY createdat DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get subadmins error:', error);
    res.status(500).json({ error: 'Failed to get subadmins' });
  }
};

const createSubadmin = async (req, res) => {
  try {
    const { email, password, name, mobile } = req.body;
    
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
    const existing = await pool.query('SELECT * FROM "User" WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const referralcode = generateReferralCode();

    // Insert Subadmin
    const result = await pool.query(
      `INSERT INTO "User" (email, password, name, mobile, role, referralcode, isverified, createdat)
       VALUES ($1, $2, $3, $4, 'SUBADMIN', $5, true, NOW())
       RETURNING id, email, name, mobile, role, referralcode, isblocked, createdat`,
      [email.toLowerCase(), hashedPassword, name || null, mobile || null, referralcode]
    );

    const newSubadmin = result.rows[0];
    
    // Create wallet for subadmin
    await pool.query(
      `INSERT INTO "Wallet" (userid, usdtbalance, inrbalance, tokenbalance) VALUES ($1, 0, 0, 0) ON CONFLICT (userid) DO NOTHING`,
      [newSubadmin.id]
    );

    // Create reward record for subadmin
    await pool.query(
      `INSERT INTO "Reward" (userid, upirewardgiven, bankrewardgiven, telegramrewardgiven) VALUES ($1, false, false, false) ON CONFLICT (userid) DO NOTHING`,
      [newSubadmin.id]
    );

    res.status(201).json(newSubadmin);
  } catch (error) {
    console.error('Create subadmin error:', error);
    res.status(500).json({ error: 'Failed to create subadmin' });
  }
};

const updateSubadmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, name, mobile, isblocked } = req.body;

    // Check if subadmin exists
    const subadmin = await pool.query('SELECT * FROM "User" WHERE id = $1 AND role = $2', [id, 'SUBADMIN']);
    if (subadmin.rows.length === 0) {
      return res.status(404).json({ error: 'Subadmin not found' });
    }

    const fields = [];
    const params = [];
    let i = 0;

    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      // Check if email is already taken by another user
      const existing = await pool.query('SELECT * FROM "User" WHERE email = $1 AND id != $2', [email.toLowerCase(), id]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      i++; params.push(email.toLowerCase()); fields.push(`email = $${i}`);
    }

    if (password !== undefined && password.trim() !== '') {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      i++; params.push(hashedPassword); fields.push(`password = $${i}`);
    }

    if (name !== undefined) { i++; params.push(name); fields.push(`name = $${i}`); }
    if (mobile !== undefined) { i++; params.push(mobile); fields.push(`mobile = $${i}`); }
    if (isblocked !== undefined) { i++; params.push(isblocked); fields.push(`isblocked = $${i}`); }

    if (fields.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE "User" SET ${fields.join(', ')} WHERE id = $${i + 1} AND role = 'SUBADMIN'`,
        params
      );
    }

    const updated = await pool.query(
      `SELECT id, email, name, mobile, role, referralcode, isblocked, createdat 
       FROM "User" 
       WHERE id = $1 AND role = 'SUBADMIN'`,
      [id]
    );

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Update subadmin error:', error);
    res.status(500).json({ error: 'Failed to update subadmin' });
  }
};

const deleteSubadmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if subadmin exists
    const subadmin = await pool.query('SELECT * FROM "User" WHERE id = $1 AND role = $2', [id, 'SUBADMIN']);
    if (subadmin.rows.length === 0) {
      return res.status(404).json({ error: 'Subadmin not found' });
    }

    // Delete subadmin
    await pool.query('DELETE FROM "User" WHERE id = $1 AND role = $2', [id, 'SUBADMIN']);
    await pool.query('DELETE FROM "Wallet" WHERE userid = $1', [id]);
    await pool.query('DELETE FROM "Reward" WHERE userid = $1', [id]);

    res.json({ message: 'Subadmin deleted successfully' });
  } catch (error) {
    console.error('Delete subadmin error:', error);
    res.status(500).json({ error: 'Failed to delete subadmin' });
  }
};

module.exports = {
  getSubadmins,
  createSubadmin,
  updateSubadmin,
  deleteSubadmin
};
