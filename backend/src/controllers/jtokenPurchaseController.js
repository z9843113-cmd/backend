const { pool } = require('../database/index');

const ACTIVE_STATUSES = ['WAITING_ADMIN', 'READY_TO_PAY', 'PAYMENT_STARTED', 'PAYMENT_SUBMITTED'];

const expireUserRequests = async (userId) => {
  await pool.query(
    `UPDATE "JTokenPurchase"
     SET status = 'EXPIRED', updatedat = NOW()
     WHERE userid = $1 AND status = 'PAYMENT_STARTED' AND payexpiresat IS NOT NULL AND payexpiresat < NOW()`,
    [userId]
  );
};

const serializePurchase = (purchase) => ({
  ...purchase,
  amount: parseFloat(purchase.amount || 0),
  tokenamount: parseFloat(purchase.tokenamount || 0)
});

const createJTokenPurchase = async (req, res) => {
  try {
    const { amount, method } = req.body;
    const inrAmount = parseFloat(amount);

    if (!inrAmount || inrAmount <= 0) {
      return res.status(400).json({ error: 'Invalid INR amount' });
    }

    if (!method) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    await expireUserRequests(req.user.id);

    const existing = await pool.query(
      `SELECT id FROM "JTokenPurchase" WHERE userid = $1 AND status = ANY($2::text[]) ORDER BY createdat DESC LIMIT 1`,
      [req.user.id, ACTIVE_STATUSES]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You already have an active J Token request' });
    }

    const firstRequest = await pool.query(
      `SELECT id FROM "JTokenPurchase" WHERE userid = $1 ORDER BY createdat ASC LIMIT 1`,
      [req.user.id]
    );

    if (firstRequest.rows.length === 0) {
      const upiAccounts = await pool.query('SELECT id FROM "UPIAccount" WHERE userid = $1', [req.user.id]);
      if (upiAccounts.rows.length === 0) {
        return res.status(400).json({ error: 'Please bind your UPI account first before buying J Token' });
      }
    }

    const app = await pool.query('SELECT * FROM "UPIApp" WHERE LOWER(id) = LOWER($1)', [String(method)]);
    if (app.rows.length === 0) {
      return res.status(400).json({ error: 'Selected payment method is not available' });
    }
    if (!app.rows[0].isactive) {
      return res.status(400).json({ error: 'Selected payment method is not active' });
    }
    if (!app.rows[0].isforjtoken) {
      return res.status(400).json({ error: 'JToken payment method not configured. Please contact support.' });
    }
    if (app.rows.length === 0) {
      return res.status(400).json({ error: 'Selected payment method is not available' });
    }

    const settings = await pool.query('SELECT tokenrate, minjtokenbuy FROM "Settings" LIMIT 1');
    const tokenRate = parseFloat(settings.rows[0]?.tokenrate || 0.01);
    const minJTokenBuy = parseFloat(settings.rows[0]?.minjtokenbuy || 10);
    const tokenAmount = inrAmount / tokenRate;

    if (inrAmount < minJTokenBuy) {
      return res.status(400).json({ error: `Minimum buy amount is Rs ${minJTokenBuy.toFixed(2)}` });
    }

    const created = await pool.query(
      `INSERT INTO "JTokenPurchase" (userid, method, amount, tokenamount, status, createdat, updatedat)
       VALUES ($1, $2, $3, $4, 'WAITING_ADMIN', NOW(), NOW()) RETURNING *`,
      [req.user.id, String(method).toUpperCase(), inrAmount, tokenAmount]
    );

    res.status(201).json({
      success: true,
      message: 'J Token request submitted. Please wait 3-5 minutes.',
      request: serializePurchase(created.rows[0])
    });
  } catch (error) {
    console.error('Create J Token purchase error:', error);
    res.status(500).json({ error: 'Failed to create J Token request' });
  }
};

const getMyJTokenPurchases = async (req, res) => {
  try {
    await expireUserRequests(req.user.id);
    const purchases = await pool.query('SELECT * FROM "JTokenPurchase" WHERE userid = $1 ORDER BY createdat DESC LIMIT 20', [req.user.id]);
    res.json({ purchases: purchases.rows.map(serializePurchase) });
  } catch (error) {
    console.error('Get J Token purchases error:', error);
    res.status(500).json({ error: 'Failed to fetch J Token purchases' });
  }
};

const startJTokenPayment = async (req, res) => {
  try {
    await expireUserRequests(req.user.id);
    const purchase = await pool.query('SELECT * FROM "JTokenPurchase" WHERE id = $1 AND userid = $2', [req.params.requestId, req.user.id]);
    if (purchase.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const row = purchase.rows[0];
    if (row.status !== 'READY_TO_PAY' && row.status !== 'PAYMENT_STARTED') {
      return res.status(400).json({ error: 'Payment details are not ready yet' });
    }

    const updated = await pool.query(
      `UPDATE "JTokenPurchase"
       SET status = 'PAYMENT_STARTED', paystartedat = NOW(), payexpiresat = NOW() + INTERVAL '10 minutes', updatedat = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.requestId]
    );
    res.json({ message: 'Payment window started', request: serializePurchase(updated.rows[0]) });
  } catch (error) {
    console.error('Start J Token payment error:', error);
    res.status(500).json({ error: 'Failed to start payment window' });
  }
};

const submitJTokenPayment = async (req, res) => {
  try {
    await expireUserRequests(req.user.id);
    const { utr, screenshot } = req.body;
    if (!utr || !utr.trim()) return res.status(400).json({ error: 'UTR is required' });
    if (!screenshot) return res.status(400).json({ error: 'Payment screenshot is required' });

    const purchase = await pool.query('SELECT * FROM "JTokenPurchase" WHERE id = $1 AND userid = $2', [req.params.requestId, req.user.id]);
    if (purchase.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const row = purchase.rows[0];
    if (!['READY_TO_PAY', 'PAYMENT_STARTED'].includes(row.status)) {
      return res.status(400).json({ error: 'This request is not accepting payment proofs' });
    }
    if (row.payexpiresat && new Date(row.payexpiresat) < new Date()) {
      await pool.query(`UPDATE "JTokenPurchase" SET status = 'EXPIRED', updatedat = NOW() WHERE id = $1`, [req.params.requestId]);
      return res.status(400).json({ error: 'Payment window expired. Create a new request.' });
    }

    const updated = await pool.query(
      `UPDATE "JTokenPurchase"
       SET status = 'PAYMENT_SUBMITTED', utr = $2, screenshot = $3, updatedat = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.requestId, utr.trim(), screenshot]
    );

    res.json({
      message: 'Payment proof submitted. Please wait 3-5 minutes.',
      request: serializePurchase(updated.rows[0])
    });
  } catch (error) {
    console.error('Submit J Token payment error:', error);
    res.status(500).json({ error: 'Failed to submit payment proof' });
  }
};

const cancelJTokenPurchase = async (req, res) => {
  try {
    const purchase = await pool.query('SELECT * FROM "JTokenPurchase" WHERE id = $1 AND userid = $2', [req.params.requestId, req.user.id]);
    if (purchase.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const row = purchase.rows[0];
    if (!['WAITING_ADMIN', 'READY_TO_PAY', 'PAYMENT_STARTED'].includes(row.status)) {
      return res.status(400).json({ error: 'This request cannot be cancelled now' });
    }

    const updated = await pool.query(
      `UPDATE "JTokenPurchase" SET status = 'CANCELLED', updatedat = NOW() WHERE id = $1 RETURNING *`,
      [req.params.requestId]
    );
    res.json({ message: 'J Token request cancelled', request: serializePurchase(updated.rows[0]) });
  } catch (error) {
    console.error('Cancel J Token purchase error:', error);
    res.status(500).json({ error: 'Failed to cancel request' });
  }
};

module.exports = {
  createJTokenPurchase,
  getMyJTokenPurchases,
  startJTokenPayment,
  submitJTokenPayment,
  cancelJTokenPurchase
};
