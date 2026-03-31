const { pool } = require('../database/index');

const createDeposit = async (req, res) => {
  try {
    const { amount, method, screenshot, txid, cryptoId, cryptoAmount } = req.body;
    
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    if (!method || !method.trim()) {
      return res.status(400).json({ error: 'Payment method is required' });
    }
    
    if (!screenshot) {
      return res.status(400).json({ error: 'Screenshot is required for all deposits' });
    }
    if (!txid || !txid.trim()) {
      return res.status(400).json({ error: 'Transaction ID is required for all deposits' });
    }
    
    const result = await pool.query(
      `INSERT INTO "Deposit" (userid, amount, method, status, screenshot, txid, cryptoid, cryptoamount, createdat) 
       VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, $7, NOW()) RETURNING *`, 
      [req.user.id, amount, method, screenshot, txid.trim(), cryptoId || method, cryptoAmount || amount]
    );
    
    res.status(201).json({ 
      success: true,
      message: 'Deposit request submitted for approval', 
      deposit: result.rows[0] 
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Failed to submit deposit: ' + error.message });
  }
};

const getDepositHistory = async (req, res) => {
  try {
    const deposits = await pool.query('SELECT * FROM "Deposit" WHERE userid = $1 ORDER BY createdat DESC', [req.user.id]);
    res.json(deposits.rows);
  } catch (error) {
    console.error('Get deposits error:', error);
    res.status(500).json({ error: 'Failed to fetch deposits' });
  }
};

module.exports = { createDeposit, getDepositHistory };
