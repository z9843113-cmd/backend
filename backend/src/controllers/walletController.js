const { pool } = require('../database/index');

const getWallet = async (req, res) => {
  try {
    let wallet = await pool.query('SELECT * FROM "Wallet" WHERE userid = $1', [req.user.id]);
    if (wallet.rows.length === 0) {
      wallet = await pool.query(`INSERT INTO "Wallet" (userid, usdtbalance, inrbalance, tokenbalance, referralbalance) VALUES ($1, 0, 0, 0, 0) RETURNING *`, [req.user.id]);
    }
    
    const settings = await pool.query('SELECT * FROM "Settings" LIMIT 1');
    const s = settings.rows[0] || {};
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayDeposits = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM "Deposit" WHERE userid = $1 AND status = 'APPROVED' AND createdat >= $2`,
      [req.user.id, today]
    );
    
    const todayWithdrawals = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM "Withdrawal" WHERE userid = $1 AND status = 'APPROVED' AND createdat >= $2`,
      [req.user.id, today]
    );
    
    const totalDeposits = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM "Deposit" WHERE userid = $1 AND status = 'APPROVED'`,
      [req.user.id]
    );
    
    const totalWithdrawals = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM "Withdrawal" WHERE userid = $1 AND status = 'APPROVED'`,
      [req.user.id]
    );
    
    const referralEarnings = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM "Transaction" WHERE userid = $1 AND type = 'REFERRAL' AND status = 'COMPLETED'`,
      [req.user.id]
    );
    
    const pendingDeposits = await pool.query(
      `SELECT COUNT(*) as count FROM "Deposit" WHERE userid = $1 AND status = 'PENDING'`,
      [req.user.id]
    );
    
    const pendingWithdrawals = await pool.query(
      `SELECT COUNT(*) as count FROM "Withdrawal" WHERE userid = $1 AND status = 'PENDING'`,
      [req.user.id]
    );
    
    const w = wallet.rows[0];
    const usdtRate = s.usdtrate || 83;
    const tokenRate = s.tokenrate || 0.01;
    const inrBalance = parseFloat(w.inrbalance || 0);
    const usdtBalance = parseFloat(w.usdtbalance || 0);
    const tokenBalance = parseFloat(w.tokenbalance || 0);
    const referralBalance = parseFloat(w.referralbalance || 0);
    const totalInrValue = inrBalance + (usdtBalance * usdtRate) + (tokenBalance * tokenRate);
    
    const todayPL = parseFloat(todayDeposits.rows[0].total || 0) - parseFloat(todayWithdrawals.rows[0].total || 0);
    
    res.json({
      ...w,
      usdtRate,
      tokenRate,
      minJTokenBuy: parseFloat(s.minjtokenbuy || 10),
      referralPercent: s.referralpercent || 5,
      commissionPercent: s.jtokencommissionpercent || 4,
      jTokenCommissionPercent: s.jtokencommissionpercent || 4,
      usdtCommissionPercent: s.usdtcommissionpercent || 0,
      totalBalance: totalInrValue,
      availableBalance: inrBalance,
      lockedBalance: 0,
      todayProfitLoss: todayPL,
      totalDeposits: parseFloat(totalDeposits.rows[0].total || 0),
      totalWithdrawals: parseFloat(totalWithdrawals.rows[0].total || 0),
      referralEarnings: parseFloat(referralEarnings.rows[0].total || 0),
      referralBalance: referralBalance,
      pendingDeposits: parseInt(pendingDeposits.rows[0].count || 0),
      pendingWithdrawals: parseInt(pendingWithdrawals.rows[0].count || 0),
      usdtInrValue: usdtBalance * usdtRate,
      tokenInrValue: tokenBalance * tokenRate
    });
  } catch (error) {
    console.error('Wallet error:', error);
    res.status(500).json({ error: 'Failed to get wallet: ' + error.message });
  }
};

const trade = async (req, res) => {
  try {
    const { amount, type } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    
    const wallet = await pool.query('SELECT * FROM "Wallet" WHERE userid = $1', [req.user.id]);
    const w = wallet.rows[0];
    const settings = await pool.query('SELECT * FROM "Settings" LIMIT 1');
    const rate = settings.rows[0]?.usdtrate || 83;
    const tokenRate = settings.rows[0]?.tokenrate || 0.01;

    if (type === 'USDT_TO_INR') {
      if (parseFloat(w.usdtbalance) < amount) return res.status(400).json({ error: 'Insufficient USDT' });
      const inrAmount = amount * rate;
      await pool.query('UPDATE "Wallet" SET usdtbalance = usdtbalance - $1, inrbalance = inrbalance + $2 WHERE userid = $3', [amount, inrAmount, req.user.id]);
      await pool.query(`INSERT INTO "Transaction" (userid, type, amount, status, createdat) VALUES ($1, 'TRADE', $2, 'COMPLETED', NOW())`, [req.user.id, inrAmount]);
      res.json({ message: 'Trade successful', inrAmount });
    } else if (type === 'INR_TO_USDT') {
      if (parseFloat(w.inrbalance) < amount) return res.status(400).json({ error: 'Insufficient INR' });
      const usdtAmount = amount / rate;
      await pool.query('UPDATE "Wallet" SET inrbalance = inrbalance - $1, usdtbalance = usdtbalance + $2 WHERE userid = $3', [amount, usdtAmount, req.user.id]);
      await pool.query(`INSERT INTO "Transaction" (userid, type, amount, status, createdat) VALUES ($1, 'TRADE', $2, 'COMPLETED', NOW())`, [req.user.id, usdtAmount]);
      res.json({ message: 'Trade successful', usdtAmount });
    } else if (type === 'JTOKEN_TO_INR') {
      if (parseFloat(w.tokenbalance || 0) < amount) return res.status(400).json({ error: 'Insufficient J Token balance' });
      const inrAmount = amount * tokenRate;
      await pool.query('UPDATE "Wallet" SET tokenbalance = tokenbalance - $1, inrbalance = inrbalance + $2 WHERE userid = $3', [amount, inrAmount, req.user.id]);
      await pool.query(
        `INSERT INTO "Transaction" (userid, type, amount, tokenamount, inrvalue, note, status, createdat)
         VALUES ($1, 'JTOKEN_TRADE', $2, $3, $4, $5, 'COMPLETED', NOW())`,
        [req.user.id, inrAmount, amount, inrAmount, `Redeemed ${parseFloat(amount).toFixed(2)} J Token to INR`]
      );
      res.json({ message: 'J Token redeemed successfully', inrAmount });
    } else {
      res.status(400).json({ error: 'Invalid type' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Trade failed: ' + error.message });
  }
};

const withdrawReferralEarnings = async (req, res) => {
  const client = await pool.connect();
  try {
    const { amount } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    await client.query('BEGIN');
    
    const wallet = await client.query('SELECT * FROM "Wallet" WHERE userid = $1', [req.user.id]);
    if (wallet.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Wallet not found' });
    }
    
    const currentBalance = parseFloat(wallet.rows[0].referralbalance || 0);
    if (currentBalance < parseFloat(amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient referral balance' });
    }
    
    const withdrawalAmount = parseFloat(amount);
    await client.query('UPDATE "Wallet" SET referralbalance = referralbalance - $1 WHERE userid = $2', [withdrawalAmount, req.user.id]);
    await client.query('UPDATE "Wallet" SET inrbalance = inrbalance + $1 WHERE userid = $2', [withdrawalAmount, req.user.id]);
    await client.query(`INSERT INTO "Transaction" (userid, type, amount, status, createdat) VALUES ($1, 'REFERRAL_WITHDRAW', $2, 'COMPLETED', NOW())`, [req.user.id, withdrawalAmount]);
    
    await client.query('COMMIT');
    res.json({ message: `₹${withdrawalAmount.toFixed(2)} transferred to main balance`, amount: withdrawalAmount });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Referral withdrawal error:', error);
    res.status(500).json({ error: 'Failed to withdraw referral earnings: ' + error.message });
  } finally {
    client.release();
  }
};

module.exports = { getWallet, trade, withdrawReferralEarnings };
