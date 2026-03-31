const { pool } = require('../database/index');

const createWithdrawal = async (req, res) => {
  const { amount, method, upiId, bankAccountId } = req.body;
  
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  
  if (!method || !['UPI', 'BANK'].includes(method)) {
    return res.status(400).json({ error: 'Invalid method' });
  }

  try {
    const wallet = await pool.query('SELECT * FROM "Wallet" WHERE "userId" = $1', [req.user.id]);
    const balance = parseFloat(wallet.rows[0]?.inrBalance || 0);
    
    console.log('Current balance:', balance, 'Requested:', amount);
    
    if (balance < parseFloat(amount)) {
      return res.status(400).json({ error: 'Insufficient balance. Available: ₹' + balance.toFixed(2) });
    }

    let upiIdVal = null, bankIdVal = null;
    
    if (method === 'UPI') {
      if (!upiId) {
        return res.status(400).json({ error: 'UPI ID required' });
      }
      const upi = await pool.query('SELECT upiid FROM "UPIAccount" WHERE id = $1 AND userid = $2 AND isprimary = true', [upiId, req.user.id]);
      console.log('UPI query result:', upi.rows);
      if (upi.rows.length === 0) {
        return res.status(400).json({ error: 'Primary UPI not found. Please set a primary UPI account.' });
      }
      upiIdVal = upi.rows[0].upiid;
    } else if (method === 'BANK') {
      if (!bankAccountId) {
        return res.status(400).json({ error: 'Bank ID required' });
      }
      const bank = await pool.query('SELECT id FROM "BankAccount" WHERE id = $1 AND userid = $2 AND isprimary = true', [bankAccountId, req.user.id]);
      console.log('Bank query result:', bank.rows);
      if (bank.rows.length === 0) {
        return res.status(400).json({ error: 'Primary bank not found. Please set a primary bank account.' });
      }
      bankIdVal = bankAccountId;
    }

    console.log('Inserting withdrawal record...');
    const result = await pool.query(
      `INSERT INTO "Withdrawal" (userid, amount, method, upiid, bankaccountid, status, createdat) 
       VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW()) RETURNING *`, 
      [req.user.id, amount, method, upiIdVal, bankIdVal]
    );
    console.log('Withdrawal inserted:', result.rows[0]);
    
    console.log('Deducting balance...');
    await pool.query('UPDATE "Wallet" SET "inrBalance" = "inrBalance" - $1 WHERE "userId" = $2', [amount, req.user.id]);
    console.log('Balance deducted');
    
    res.status(201).json({ 
      success: true, 
      message: 'Withdrawal submitted for approval', 
      withdrawal: result.rows[0] 
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Withdrawal failed: ' + error.message });
  }
};

const getWithdrawalHistory = async (req, res) => {
  try {
    const withdrawals = await pool.query('SELECT * FROM "Withdrawal" WHERE userid = $1 ORDER BY createdat DESC', [req.user.id]);
    res.json(withdrawals.rows);
  } catch (error) {
    console.error('Get withdrawal history error:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
};

module.exports = { createWithdrawal, getWithdrawalHistory };
