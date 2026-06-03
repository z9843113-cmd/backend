const { pool } = require('../database/index');

const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    
    let query = 'SELECT u.id, u.email, u.name, u.mobile, u.role, u.referralcode, u.referredby, u.isverified, u.isblocked, u.createdat, w.usdtbalance, w.inrbalance, w.tokenbalance, w.referralbalance FROM "User" u LEFT JOIN "Wallet" w ON u.id::text = w.userid';
    let countQuery = 'SELECT COUNT(*) FROM "User"';
    const params = [];
    const isNumeric = search ? /^\d+$/.test(search) : false;
    
    if (search) {
      if (isNumeric) {
        query += ' WHERE u.id::text = $1';
        countQuery += ' WHERE id::text = $1';
        params.push(search);
      } else {
        query += ' WHERE u.email ILIKE $1 OR u.referralcode ILIKE $1 OR u.mobile ILIKE $1';
        countQuery += ' WHERE email ILIKE $1 OR referralcode ILIKE $1 OR mobile ILIKE $1';
        params.push('%' + search + '%');
      }
      query += ` ORDER BY u.createdat DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    } else {
      query += ' ORDER BY u.createdat DESC LIMIT $1 OFFSET $2';
      params.push(limit, offset);
    }
    
    const users = await pool.query(query, params);
    const total = await pool.query(countQuery, search ? (isNumeric ? [search] : ['%' + search + '%']) : []);
    res.json({ users: users.rows, total: parseInt(total.rows[0].count), page, totalPages: Math.ceil(total.rows[0].count / limit) });
  } catch (error) {
    console.error('getAllUsers error:', error);
    res.status(500).json({ error: 'Failed to get users: ' + error.message });
  }
};

const getAdminNotifications = async (req, res) => {
  try {
    const [pendingDeposits, pendingWithdrawals, pendingJToken, pendingUpi, pendingExchange, recentDeposits, recentWithdrawals, recentJToken, recentUpi, recentExchange] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM "Deposit" WHERE status = 'PENDING'`),
      pool.query(`SELECT COUNT(*) FROM "Withdrawal" WHERE status = 'PENDING'`),
      pool.query(`SELECT COUNT(*) FROM "JTokenPurchase" WHERE status IN ('WAITING_ADMIN', 'PAYMENT_SUBMITTED')`),
      pool.query(`SELECT COUNT(*) FROM "UPIVerification" WHERE status IN ('PENDING', 'OTP_REQUESTED', 'OTP_SUBMITTED')`),
      pool.query(`SELECT COUNT(*) FROM "ExchangeRequest" WHERE status = 'PENDING'`),
      pool.query(`SELECT d.id, d.createdat, d.amount, d.method, u.email FROM "Deposit" d JOIN "User" u ON u.id::text = d.userid WHERE d.status = 'PENDING' ORDER BY d.createdat DESC LIMIT 5`),
      pool.query(`SELECT w.id, w.createdat, w.amount, w.method, u.email FROM "Withdrawal" w JOIN "User" u ON u.id::text = w.userid WHERE w.status = 'PENDING' ORDER BY w.createdat DESC LIMIT 5`),
      pool.query(`SELECT p.id, p.createdat, p.amount, p.method, p.status, u.email FROM "JTokenPurchase" p JOIN "User" u ON u.id::text = p.userid WHERE p.status IN ('WAITING_ADMIN', 'PAYMENT_SUBMITTED') ORDER BY p.createdat DESC LIMIT 5`),
      pool.query(`SELECT v.id, v.createdat, v.phone, v.upiid, v.status, u.email FROM "UPIVerification" v JOIN "User" u ON u.id::text = v.userid WHERE v.status IN ('PENDING', 'OTP_REQUESTED', 'OTP_SUBMITTED') ORDER BY v.createdat DESC LIMIT 5`),
      pool.query(`SELECT e.id, e.createdat, e.amount, e.ratetype, e.rate, u.email FROM "ExchangeRequest" e JOIN "User" u ON u.id::text = e.userid WHERE e.status = 'PENDING' ORDER BY e.createdat DESC LIMIT 5`)
    ]);

    const items = [
      ...recentDeposits.rows.map((item) => ({
        id: `deposit-${item.id}`,
        type: 'DEPOSIT',
        title: 'New deposit request',
        description: `${item.email} requested Rs ${parseFloat(item.amount || 0).toFixed(2)} via ${item.method}`,
        createdat: item.createdat,
        path: '/admin/deposits'
      })),
      ...recentWithdrawals.rows.map((item) => ({
        id: `withdrawal-${item.id}`,
        type: 'WITHDRAWAL',
        title: 'New withdrawal request',
        description: `${item.email} requested Rs ${parseFloat(item.amount || 0).toFixed(2)} via ${item.method}`,
        createdat: item.createdat,
        path: '/admin/withdrawals'
      })),
      ...recentJToken.rows.map((item) => ({
        id: `jtoken-${item.id}`,
        type: 'JTOKEN',
        title: item.status === 'PAYMENT_SUBMITTED' ? 'J Token proof submitted' : 'New J Token request',
        description: `${item.email} requested Rs ${parseFloat(item.amount || 0).toFixed(2)} via ${item.method}`,
        createdat: item.createdat,
        path: '/admin/jtoken-requests'
      })),
      ...recentUpi.rows.map((item) => ({
        id: `upi-${item.id}`,
        type: 'UPI_VERIFICATION',
        title: item.status === 'OTP_SUBMITTED' ? 'UPI OTP submitted - Verify now' : item.status === 'OTP_REQUESTED' ? 'UPI OTP requested' : 'New UPI verification request',
        description: `${item.email} - ${item.phone} - ${item.upiid}`,
        createdat: item.createdat,
        path: '/admin/upi-verifications'
      })),
      ...recentExchange.rows.map((item) => ({
        id: `exchange-${item.id}`,
        type: 'EXCHANGE',
        title: 'New USDT Sell Request',
        description: `${item.email} - Rs ${parseFloat(item.amount || 0).toFixed(2)} @ ${item.ratetype} Rate (₹${item.rate})`,
        createdat: item.createdat,
        path: '/admin/exchange-requests'
      }))
    ].sort((a, b) => new Date(b.createdat) - new Date(a.createdat));

    res.json({
      counts: {
        deposits: parseInt(pendingDeposits.rows[0].count),
        withdrawals: parseInt(pendingWithdrawals.rows[0].count),
        jtoken: parseInt(pendingJToken.rows[0].count),
        upiverification: parseInt(pendingUpi.rows[0].count),
        exchange: parseInt(pendingExchange.rows[0].count)
      },
      totalUnread: parseInt(pendingDeposits.rows[0].count) + parseInt(pendingWithdrawals.rows[0].count) + parseInt(pendingJToken.rows[0].count) + parseInt(pendingUpi.rows[0].count) + parseInt(pendingExchange.rows[0].count),
      items: items.slice(0, 10)
    });
  } catch (error) {
    console.error('Get admin notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
};

const toggleUserBlock = async (req, res) => {
  try {
    const { isBlocked } = req.body;
    await pool.query('UPDATE "User" SET isblocked = $1 WHERE id::text = $2', [isBlocked, req.params.userId]);
    res.json({ message: 'Updated' });
  } catch (error) {
    console.error('Toggle block error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

const adminToggleUserPayment = async (req, res) => {
  try {
    const { userId } = req.params;
    // Get current paymentenabled status
    const user = await pool.query(
      'SELECT id, name, email, paymentenabled FROM "User" WHERE id::text = $1',
      [userId]
    );
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Toggle: if currently true/null → false, if false → true
    const current = user.rows[0].paymentenabled;
    const newValue = current === false ? true : false;
    await pool.query(
      'UPDATE "User" SET paymentenabled = $1 WHERE id::text = $2',
      [newValue, userId]
    );
    res.json({
      success: true,
      paymentEnabled: newValue,
      message: newValue ? 'Receive payment enabled for user' : 'Receive payment disabled for user'
    });
  } catch (error) {
    console.error('Admin toggle payment error:', error);
    res.status(500).json({ error: 'Failed to toggle payment status: ' + error.message });
  }
};

const getAllDeposits = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    
    let query = 'SELECT d.id, d.amount, d.status, d.createdat, d.method, d.txid, d.screenshot, d.userid, u.email FROM "Deposit" d JOIN "User" u ON d.userid = u.id::text';
    let countQuery = 'SELECT COUNT(*) FROM "Deposit" d';
    const params = [];
    
    if (status) {
      query += ' WHERE d.status = $1';
      countQuery += ' WHERE d.status = $1';
      params.push(status);
    }
    
    query += ` ORDER BY d.createdat DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const deposits = await pool.query(query, params);
    const total = await pool.query(countQuery, status ? [status] : []);
    res.json({ deposits: deposits.rows, total: parseInt(total.rows[0].count), page, totalPages: Math.ceil(total.rows[0].count / limit) });
  } catch (error) {
    console.error('Get deposits error:', error);
    res.status(500).json({ error: 'Failed to get deposits: ' + error.message });
  }
};

const approveDeposit = async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Approve deposit called for:', req.params.depositId);
    await client.query('BEGIN');
    
    const deposit = await client.query('SELECT * FROM "Deposit" WHERE id::text = $1', [req.params.depositId]);
    console.log('Deposit found:', deposit.rows.length);
    if (deposit.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    if (deposit.rows[0].status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already processed' });
    }
    
    const depositData = deposit.rows[0];
    const depositAmount = parseFloat(depositData.amount);
    const userId = String(depositData.userid);
    
    console.log('Deposit data:', depositData);
    console.log('User ID:', userId);
    
    console.log('Updating deposit status...');
    await client.query('UPDATE "Deposit" SET status = $1 WHERE id::text = $2', ['APPROVED', req.params.depositId]);
    
    console.log('Updating wallet balance...');
    const walletCheck = await client.query('SELECT * FROM "Wallet" WHERE userid = $1', [userId]);
    if (walletCheck.rows.length === 0) {
      console.log('Wallet not found, creating new wallet for user:', userId);
      await client.query('INSERT INTO "Wallet" (userid, usdtbalance, inrbalance, tokenbalance, referralbalance) VALUES ($1, 0, $2, 0, 0)', [userId, depositAmount]);
    } else {
      await client.query('UPDATE "Wallet" SET inrbalance = inrbalance + $1 WHERE userid = $2', [depositAmount, userId]);
    }
    
    console.log('Inserting transaction...');
    await client.query(`INSERT INTO "Transaction" (userid, type, amount, status, createdat) VALUES ($1, 'DEPOSIT', $2, 'COMPLETED', NOW())`, [userId, depositAmount]);
    
    await client.query('COMMIT');
    console.log('Deposit approved successfully, balance updated by:', depositAmount);
    res.json({ message: 'Approved' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve deposit error:', error);
    res.status(500).json({ error: 'Failed to approve deposit: ' + error.message });
  } finally {
    client.release();
  }
};

const rejectDeposit = async (req, res) => {
  try {
    await pool.query('UPDATE "Deposit" SET status = $1 WHERE id::text = $2 AND status = $3', ['REJECTED', req.params.depositId, 'PENDING']);
    res.json({ message: 'Rejected' });
  } catch (error) {
    console.error('Reject deposit error:', error);
    res.status(500).json({ error: 'Failed to reject deposit' });
  }
};

const getAllWithdrawals = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    
    let query = 'SELECT w.*, u.email FROM "Withdrawal" w JOIN "User" u ON w.userid = u.id::text';
    let countQuery = 'SELECT COUNT(*) FROM "Withdrawal" w';
    const params = [];
    
    if (status) {
      query += ' WHERE w.status = $1';
      countQuery += ' WHERE w.status = $1';
      params.push(status);
    }
    
    query += ` ORDER BY w.createdat DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const withdrawals = await pool.query(query, params);
    const total = await pool.query(countQuery, status ? [status] : []);
    res.json({ withdrawals: withdrawals.rows, total: parseInt(total.rows[0].count), page, totalPages: Math.ceil(total.rows[0].count / limit) });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({ error: 'Failed to get withdrawals' });
  }
};

const approveWithdrawal = async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('approveWithdrawal called with params:', req.params);
    await client.query('BEGIN');
    const w = await client.query('SELECT * FROM "Withdrawal" WHERE id = $1', [req.params.withdrawalId]);
    console.log('Approve withdrawal - found:', w.rows.length, 'status:', w.rows[0]?.status);
    if (w.rows.length > 0 && w.rows[0].status === 'PENDING') {
      await client.query('UPDATE "Withdrawal" SET status = $1 WHERE id = $2 AND status = $3', ['APPROVED', req.params.withdrawalId, 'PENDING']);
    }
    await client.query('COMMIT');
    res.json({ message: 'Approved' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve withdrawal error:', error);
    res.status(500).json({ error: 'Failed to approve withdrawal: ' + error.message });
  } finally {
    client.release();
  }
};

const rejectWithdrawal = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const w = await client.query('SELECT * FROM "Withdrawal" WHERE id = $1', [req.params.withdrawalId]);
    console.log('Reject withdrawal - found:', w.rows.length);
    if (w.rows.length > 0 && w.rows[0].status === 'PENDING') {
      await client.query('UPDATE "Withdrawal" SET status = $1 WHERE id = $2', ['REJECTED', req.params.withdrawalId]);
      await client.query('UPDATE "Wallet" SET inrbalance = inrbalance + $1 WHERE userid = $2', [parseFloat(w.rows[0].amount), w.rows[0].userid]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Rejected' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reject withdrawal error:', error);
    res.status(500).json({ error: 'Failed to reject withdrawal: ' + error.message });
  } finally {
    client.release();
  }
};

const getAllUpiApps = async (req, res) => {
  const apps = await pool.query('SELECT * FROM "UPIApp"');
  res.json(apps.rows);
};

const createUpiApp = async (req, res) => {
  const { name, iconUrl, isForJToken } = req.body;
  const id = name.toLowerCase().replace(/\s+/g, '-');
  await pool.query(`INSERT INTO "UPIApp" (id, name, iconurl, isactive, isforjtoken) VALUES ($1, $2, $3, true, $4) ON CONFLICT (id) DO UPDATE SET isforjtoken = $4`, [id, name, iconUrl || null, isForJToken || false]);
  res.json({ message: 'Created' });
};

const deleteUpiApp = async (req, res) => {
  await pool.query('DELETE FROM "UPIApp" WHERE id = $1', [req.params.id]);
  res.json({ message: 'Deleted' });
};

const getAllCryptoAddresses = async (req, res) => {
  const addresses = await pool.query('SELECT * FROM "CryptoAddress"');
  res.json(addresses.rows);
};

const createCryptoAddress = async (req, res) => {
  const { coin, network, address } = req.body;
  const id = coin.toLowerCase() + '-' + network.toLowerCase();
  await pool.query(`INSERT INTO "CryptoAddress" (id, coin, network, address, isactive) VALUES ($1, $2, $3, $4, true) ON CONFLICT (id) DO NOTHING`, [id, coin.toUpperCase(), network.toUpperCase(), address]);
  res.json({ message: 'Created' });
};

const deleteCryptoAddress = async (req, res) => {
  await pool.query('DELETE FROM "CryptoAddress" WHERE id = $1', [req.params.id]);
  res.json({ message: 'Deleted' });
};

const getSettings = async (req, res) => {
  const settings = await pool.query('SELECT * FROM "Settings" LIMIT 1');
  res.json(settings.rows[0] || {});
};

const updateSettings = async (req, res) => {
  const { usdtRate, tokenRate, minJTokenBuy, referralPercent, jTokenCommissionPercent, usdtCommissionPercent, upiRewardAmount, bankRewardAmount, telegramRewardAmount, whatsappSupport, telegramSupport, telegramGroup, bannerEnabled, bannerTitle, bannerSubtitle, bannerButtonText, bannerLink, depositDiscountEnabled, depositDiscountPercent, jTokenDiscountEnabled } = req.body;
  const fields = [], params = [];
  let i = 0;
  if (usdtRate !== undefined) { i++; params.push(usdtRate); fields.push(`usdtrate = $${i}`); }
  if (tokenRate !== undefined) { i++; params.push(tokenRate); fields.push(`tokenrate = $${i}`); }
  if (minJTokenBuy !== undefined) { i++; params.push(minJTokenBuy); fields.push(`minjtokenbuy = $${i}`); }
  if (referralPercent !== undefined) { i++; params.push(referralPercent); fields.push(`referralpercent = $${i}`); }
  if (jTokenCommissionPercent !== undefined) { i++; params.push(jTokenCommissionPercent); fields.push(`jtokencommissionpercent = $${i}`); }
  if (usdtCommissionPercent !== undefined) { i++; params.push(usdtCommissionPercent); fields.push(`usdtcommissionpercent = $${i}`); }
  if (upiRewardAmount !== undefined) { i++; params.push(upiRewardAmount); fields.push(`upirewardamount = $${i}`); }
  if (bankRewardAmount !== undefined) { i++; params.push(bankRewardAmount); fields.push(`bankrewardamount = $${i}`); }
  if (telegramRewardAmount !== undefined) { i++; params.push(telegramRewardAmount); fields.push(`telegramrewardamount = $${i}`); }
  if (whatsappSupport !== undefined) { i++; params.push(whatsappSupport); fields.push(`whatsappsupport = $${i}`); }
  if (telegramSupport !== undefined) { i++; params.push(telegramSupport); fields.push(`telegramsupport = $${i}`); }
  if (telegramGroup !== undefined) { i++; params.push(telegramGroup); fields.push(`telegramgroup = $${i}`); }
  if (bannerEnabled !== undefined) { i++; params.push(bannerEnabled); fields.push(`bannerenabled = $${i}`); }
  if (bannerTitle !== undefined) { i++; params.push(bannerTitle); fields.push(`bannertitle = $${i}`); }
  if (bannerSubtitle !== undefined) { i++; params.push(bannerSubtitle); fields.push(`bannersubtitle = $${i}`); }
  if (bannerButtonText !== undefined) { i++; params.push(bannerButtonText); fields.push(`bannerbuttontext = $${i}`); }
  if (bannerLink !== undefined) { i++; params.push(bannerLink); fields.push(`bannerlink = $${i}`); }
  if (depositDiscountEnabled !== undefined) { i++; params.push(depositDiscountEnabled); fields.push(`depositdiscountenabled = $${i}`); }
  if (depositDiscountPercent !== undefined) { i++; params.push(depositDiscountPercent); fields.push(`depositdiscountpercent = $${i}`); }
  if (jTokenDiscountEnabled !== undefined) { i++; params.push(jTokenDiscountEnabled); fields.push(`jtokendiscountenabled = $${i}`); }
  
  if (fields.length > 0) {
    params.push('default');
    await pool.query(`UPDATE "Settings" SET ${fields.join(', ')} WHERE id = $${i + 1}`, params);
  }
  res.json({ message: 'Updated' });
};

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      verifiedUsers,
      totalDeposits,
      totalWithdrawals,
      pendingDeposits,
      pendingWithdrawals,
      totalJTokenIssued,
      totalJTokenRedeemed,
      totalJTokenDebited,
      jTokenWalletSupply,
      totalRewardPayouts,
      todayRewardPayouts,
      settings
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM "User"'),
      pool.query('SELECT COUNT(*) FROM "User" WHERE isverified = true'),
      pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM "Deposit" WHERE status = $1', ['APPROVED']),
      pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM "Withdrawal" WHERE status = $1', ['APPROVED']),
      pool.query('SELECT COUNT(*) FROM "Deposit" WHERE status = $1', ['PENDING']),
      pool.query('SELECT COUNT(*) FROM "Withdrawal" WHERE status = $1', ['PENDING']),
      pool.query(`SELECT COALESCE(SUM(tokenamount), 0) as total FROM "Transaction" WHERE type = 'JTOKEN_CREDIT' AND status = 'COMPLETED'`),
      pool.query(`SELECT COALESCE(SUM(tokenamount), 0) as total FROM "Transaction" WHERE type = 'JTOKEN_TRADE' AND status = 'COMPLETED'`),
      pool.query(`SELECT COALESCE(SUM(tokenamount), 0) as total FROM "Transaction" WHERE type = 'JTOKEN_DEBIT' AND status = 'COMPLETED'`),
      pool.query('SELECT COALESCE(SUM(tokenbalance), 0) as total FROM "Wallet"'),
      pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM "Transaction" WHERE type IN ('REFERRAL', 'REWARD', 'MOBILE_BIND') AND status = 'COMPLETED'`),
      pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM "Transaction" WHERE type IN ('REFERRAL', 'REWARD', 'MOBILE_BIND') AND status = 'COMPLETED' AND createdat >= $1`, [today]),
      pool.query('SELECT * FROM "Settings" LIMIT 1')
    ]);

    const settingsRow = settings.rows[0] || {};

    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count),
      verifiedUsers: parseInt(verifiedUsers.rows[0].count),
      totalDeposits: parseFloat(totalDeposits.rows[0].total),
      totalWithdrawals: parseFloat(totalWithdrawals.rows[0].total),
      pendingDeposits: parseInt(pendingDeposits.rows[0].count),
      pendingWithdrawals: parseInt(pendingWithdrawals.rows[0].count),
      totalJTokenIssued: parseFloat(totalJTokenIssued.rows[0].total),
      totalJTokenRedeemed: parseFloat(totalJTokenRedeemed.rows[0].total),
      totalJTokenDebited: parseFloat(totalJTokenDebited.rows[0].total),
      totalJTokenInWallets: parseFloat(jTokenWalletSupply.rows[0].total),
      totalRewardPayouts: parseFloat(totalRewardPayouts.rows[0].total),
      todayRewardPayouts: parseFloat(todayRewardPayouts.rows[0].total),
      jTokenCommissionPercent: parseFloat(settingsRow.jtokencommissionpercent || 4),
      usdtCommissionPercent: parseFloat(settingsRow.usdtcommissionpercent || 0),
      tokenRate: parseFloat(settingsRow.tokenrate || 0.01)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
};

const updateUpiApp = async (req, res) => {
  const { name, iconUrl, isActive, isForJToken } = req.body;
  const { id } = req.params;
  const fields = [], params = [];
  let i = 0;
  if (name !== undefined) { i++; params.push(name); fields.push(`name = $${i}`); }
  if (iconUrl !== undefined) { i++; params.push(iconUrl); fields.push(`iconurl = $${i}`); }
  if (isActive !== undefined) { i++; params.push(isActive); fields.push(`isactive = $${i}`); }
  if (isForJToken !== undefined) { i++; params.push(isForJToken); fields.push(`isforjtoken = $${i}`); }
  if (fields.length > 0) {
    params.push(id);
    await pool.query(`UPDATE "UPIApp" SET ${fields.join(', ')} WHERE id = $${i + 1}`, params);
  }
  res.json({ message: 'Updated' });
};

const updateCryptoAddress = async (req, res) => {
  const { coin, network, address, isActive } = req.body;
  const { id } = req.params;
  const fields = [], params = [];
  let i = 0;
  if (coin !== undefined) { i++; params.push(coin); fields.push(`coin = $${i}`); }
  if (network !== undefined) { i++; params.push(network); fields.push(`network = $${i}`); }
  if (address !== undefined) { i++; params.push(address); fields.push(`address = $${i}`); }
  if (isActive !== undefined) { i++; params.push(isActive); fields.push(`isactive = $${i}`); }
  if (fields.length > 0) {
    params.push(id);
    await pool.query(`UPDATE "CryptoAddress" SET ${fields.join(', ')} WHERE id = $${i + 1}`, params);
  }
  res.json({ message: 'Updated' });
};

const updateSupportLinks = async (req, res) => {
  const { whatsappSupport, telegramSupport, telegramGroup } = req.body;
  await pool.query(`UPDATE "Settings" SET whatsappsupport = $1, telegramsupport = $2, telegramgroup = $3 WHERE id = 'default'`, [whatsappSupport || '', telegramSupport || '', telegramGroup || '']);
  res.json({ message: 'Updated' });
};

const getSupportLinksAdmin = async (req, res) => {
  const settings = await pool.query('SELECT * FROM "Settings" LIMIT 1');
  const s = settings.rows[0] || {};
  res.json({ whatsappSupport: s.whatsappsupport || '', telegramSupport: s.telegramsupport || '', telegramGroup: s.telegramgroup || '' });
};

const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await pool.query('SELECT id, email, name, mobile, referralcode, telegramid, telegramname, telegramusername, telegramchatid, isverified, isblocked, createdat FROM "User" WHERE id::text = $1', [userId]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const wallet = await pool.query('SELECT * FROM "Wallet" WHERE userid = $1', [userId]);
    const upiAccounts = await pool.query('SELECT * FROM "UPIAccount" WHERE userid = $1', [userId]);
    const bankAccounts = await pool.query('SELECT * FROM "BankAccount" WHERE userid = $1', [userId]);
    const upiVerifications = await pool.query('SELECT * FROM "UPIVerification" WHERE userid = $1 ORDER BY createdat DESC', [userId]);
    const deposits = await pool.query('SELECT * FROM "Deposit" WHERE userid = $1 ORDER BY createdat DESC LIMIT 10', [userId]);
    const withdrawals = await pool.query('SELECT * FROM "Withdrawal" WHERE userid = $1 ORDER BY createdat DESC LIMIT 10', [userId]);
    const transactions = await pool.query('SELECT * FROM "Transaction" WHERE userid = $1 ORDER BY createdat DESC LIMIT 20', [userId]);
    const referral = await pool.query('SELECT * FROM "User" WHERE referredby = $1', [userId]);
    
    res.json({
      user: user.rows[0],
      wallet: wallet.rows[0] || null,
      upiAccounts: upiAccounts.rows,
      bankAccounts: bankAccounts.rows,
      upiVerifications: upiVerifications.rows,
      deposits: deposits.rows,
      withdrawals: withdrawals.rows,
      transactions: transactions.rows,
      referralCount: referral.rows.length
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to get user details' });
  }
};

const getAllJTokenPurchases = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || '';

    let query = `
      SELECT p.*, u.email, u.name, u.mobile, u.telegramid, u.referralcode, u.createdat as usercreatedat
      FROM "JTokenPurchase" p
      JOIN "User" u ON u.id::text = p.userid
    `;
    let countQuery = 'SELECT COUNT(*) FROM "JTokenPurchase"';
    let params = [];

    if (status) {
      query += ' WHERE p.status = $1';
      countQuery += ' WHERE status = $1';
      params.push(status);
      query += ` ORDER BY p.createdat DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    } else {
      query += ` ORDER BY p.createdat DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    }
    params.push(limit, offset);

    const purchases = await pool.query(query, params);
    const total = await pool.query(countQuery, status ? [status] : []);

    res.json({
      purchases: purchases.rows,
      total: parseInt(total.rows[0].count),
      page,
      totalPages: Math.ceil(parseInt(total.rows[0].count) / limit)
    });
  } catch (error) {
    console.error('Get J Token purchases error:', error);
    res.status(500).json({ error: 'Failed to get J Token requests' });
  }
};

const assignJTokenPurchaseDetails = async (req, res) => {
  try {
    const { paymentUpi, qrImage, adminNote, bankDetails } = req.body;
    
    const purchase = await pool.query('SELECT * FROM "JTokenPurchase" WHERE id::text = $1', [req.params.purchaseId]);
    if (purchase.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    if (purchase.rows[0].status !== 'WAITING_ADMIN') {
      return res.status(400).json({ error: 'Payment details already assigned or request already processed' });
    }

    const user = await pool.query('SELECT paymentenabled FROM "User" WHERE id::text = $1', [purchase.rows[0].userid]);
    if (user.rows.length > 0 && user.rows[0].paymentenabled === false) {
      return res.status(400).json({ error: 'User has disabled receiving payments. Ask user to enable payments from their app.' });
    }

    let note = adminNote || '';
    let method = 'UPI';
    
    if (bankDetails) {
      method = 'BANK';
      note = `Bank: ${bankDetails.bankName}\nAccount No.: ${bankDetails.accountNumber}\nIFSC: ${bankDetails.ifscCode}\nPayee Name: ${bankDetails.payeeName}`;
    }

    const updated = await pool.query(
      `UPDATE "JTokenPurchase"
       SET status = 'READY_TO_PAY', paymentupi = $2, qrimage = $3, adminnote = $4, method = $5, updatedat = NOW()
       WHERE id::text = $1 RETURNING *`,
      [req.params.purchaseId, paymentUpi?.trim() || '', qrImage?.trim() || '', note, method]
    );

    res.json({ message: 'Payment details assigned', purchase: updated.rows[0] });
  } catch (error) {
    console.error('Assign J Token details error:', error);
    res.status(500).json({ error: 'Failed to assign payment details' });
  }
};

const approveJTokenPurchase = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const purchase = await client.query('SELECT * FROM "JTokenPurchase" WHERE id::text = $1 FOR UPDATE', [req.params.purchaseId]);
    if (purchase.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }

    const row = purchase.rows[0];
    if (row.status !== 'PAYMENT_SUBMITTED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment proof not submitted yet' });
    }

    const user = await client.query('SELECT paymentenabled FROM "User" WHERE id::text = $1', [row.userid]);
    if (user.rows.length > 0 && user.rows[0].paymentenabled === false) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User has disabled receiving payments. Ask user to enable payments from their app.' });
    }

    const userId = String(row.userid);
    const tokenAmount = parseFloat(row.tokenamount || 0);

    await client.query('UPDATE "JTokenPurchase" SET status = $2, reviewedat = NOW(), updatedat = NOW() WHERE id::text = $1', [req.params.purchaseId, 'APPROVED']);
    
    // Upsert wallet — create if not exists, then add tokenbalance
    const walletCheck = await client.query('SELECT id FROM "Wallet" WHERE userid = $1', [userId]);
    if (walletCheck.rows.length === 0) {
      console.log('Wallet not found for user', userId, '— creating new wallet');
      await client.query(
        'INSERT INTO "Wallet" (userid, usdtbalance, inrbalance, tokenbalance, referralbalance) VALUES ($1, 0, 0, $2, 0)',
        [userId, tokenAmount]
      );
    } else {
      await client.query('UPDATE "Wallet" SET tokenbalance = tokenbalance + $1 WHERE userid = $2', [tokenAmount, userId]);
    }

    await client.query(
      `INSERT INTO "Transaction" (userid, type, amount, tokenamount, inrvalue, note, status, createdat)
       VALUES ($1, 'JTOKEN_PURCHASE', $2, $3, $4, $5, 'COMPLETED', NOW())`,
      [userId, row.amount, tokenAmount, row.amount, `Purchased J Token via ${row.method}`]
    );
    await client.query('COMMIT');
    console.log('J Token approved: credited', tokenAmount, 'tokens to user', userId);
    res.json({ message: 'J Token request approved' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve J Token purchase error:', error);
    res.status(500).json({ error: 'Failed to approve J Token request' });
  } finally {
    client.release();
  }
};

const rejectJTokenPurchase = async (req, res) => {
  try {
    const { note } = req.body;
    const purchase = await pool.query('SELECT * FROM "JTokenPurchase" WHERE id::text = $1', [req.params.purchaseId]);
    if (purchase.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    if (!['WAITING_ADMIN', 'READY_TO_PAY', 'PAYMENT_STARTED', 'PAYMENT_SUBMITTED'].includes(purchase.rows[0].status)) {
      return res.status(400).json({ error: 'Request already processed' });
    }

    await pool.query(
      `UPDATE "JTokenPurchase" SET status = 'REJECTED', adminnote = $2, reviewedat = NOW(), updatedat = NOW() WHERE id::text = $1`,
      [req.params.purchaseId, note || 'Rejected by admin']
    );
    res.json({ message: 'J Token request rejected' });
  } catch (error) {
    console.error('Reject J Token purchase error:', error);
    res.status(500).json({ error: 'Failed to reject J Token request' });
  }
};

const updateUserJToken = async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const { action, amount, note } = req.body;
    const parsedAmount = parseFloat(amount);

    if (!['CREDIT', 'DEBIT'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    await client.query('BEGIN');

    const user = await client.query('SELECT id, email FROM "User" WHERE id::text = $1', [userId]);
    if (user.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    let wallet = await client.query('SELECT * FROM "Wallet" WHERE userid = $1', [userId]);
    if (wallet.rows.length === 0) {
      wallet = await client.query(`INSERT INTO "Wallet" (userid, usdtbalance, inrbalance, tokenbalance, referralbalance) VALUES ($1, 0, 0, 0, 0) RETURNING *`, [userId]);
    }

    const currentWallet = wallet.rows[0];
    if (action === 'DEBIT' && parseFloat(currentWallet.tokenbalance || 0) < parsedAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient J Token balance' });
    }

    const settings = await client.query('SELECT tokenrate FROM "Settings" LIMIT 1');
    const tokenRate = parseFloat(settings.rows[0]?.tokenrate || 0.01);
    const inrValue = parsedAmount * tokenRate;
    const signedAmount = action === 'CREDIT' ? parsedAmount : -parsedAmount;

    await client.query('UPDATE "Wallet" SET tokenbalance = tokenbalance + $1 WHERE userid = $2', [signedAmount, userId]);
    await client.query(
      `INSERT INTO "Transaction" (userid, type, amount, tokenamount, inrvalue, note, status, createdat)
       VALUES ($1, $2, $3, $4, $5, $6, 'COMPLETED', NOW())`,
      [userId, action === 'CREDIT' ? 'JTOKEN_CREDIT' : 'JTOKEN_DEBIT', parsedAmount, parsedAmount, inrValue, note || `${action} J Token by admin`]
    );

    await client.query('COMMIT');
    res.json({
      message: `J Token ${action === 'CREDIT' ? 'credited' : 'debited'} successfully`,
      user: user.rows[0],
      tokenAmount: parsedAmount,
      inrValue
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update J Token error:', error);
    res.status(500).json({ error: 'Failed to update J Token balance' });
  } finally {
    client.release();
  }
};

const getJTokenHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const type = req.query.type || 'ALL';

    const allowedTypes = {
      DEPOSIT: "DEPOSIT",
      WITHDRAWAL: "WITHDRAWAL",
      JTOKEN_REQUEST: "JTOKEN_REQUEST",
      JTOKEN_CREDIT: "JTOKEN_CREDIT",
      JTOKEN_DEBIT: "JTOKEN_DEBIT",
      JTOKEN_TRADE: "JTOKEN_TRADE",
      JTOKEN_PURCHASE: "JTOKEN_PURCHASE"
    };

    const params = [];
    let filterClause = '';

    if (type !== 'ALL' && allowedTypes[type]) {
      params.push(type);
      filterClause = `WHERE itemtype = $${params.length}`;
    }

    const query = `
      WITH combined AS (
        SELECT
          'deposit-' || d.id::text AS id,
          'DEPOSIT' AS itemtype,
          d.status,
          d.amount,
          0::DECIMAL AS tokenamount,
          d.method,
          d.createdat,
          NULL::TEXT AS note,
          u.email,
          u.name
        FROM "Deposit" d
        JOIN "User" u ON u.id::text = d.userid

        UNION ALL

        SELECT
          'withdrawal-' || w.id::text AS id,
          'WITHDRAWAL' AS itemtype,
          w.status,
          w.amount,
          0::DECIMAL AS tokenamount,
          COALESCE(w.method, 'Wallet') AS method,
          w.createdat,
          NULL::TEXT AS note,
          u.email,
          u.name
        FROM "Withdrawal" w
        JOIN "User" u ON u.id::text = w.userid

        UNION ALL

        SELECT
          'jtoken-request-' || p.id::text AS id,
          'JTOKEN_REQUEST' AS itemtype,
          p.status,
          p.amount,
          p.tokenamount,
          p.method,
          p.createdat,
          COALESCE(p.adminnote, p.utr, '') AS note,
          u.email,
          u.name
        FROM "JTokenPurchase" p
        JOIN "User" u ON u.id::text = p.userid

        UNION ALL

        SELECT
          'transaction-' || t.id::text AS id,
          t.type AS itemtype,
          t.status,
          t.amount,
          COALESCE(t.tokenamount, 0) AS tokenamount,
          t.type AS method,
          t.createdat,
          t.note,
          u.email,
          u.name
        FROM Transaction t
        JOIN "User" u ON u.id::text = t.userid
        WHERE t.type IN ('JTOKEN_CREDIT', 'JTOKEN_DEBIT', 'JTOKEN_TRADE', 'JTOKEN_PURCHASE')
      )
      SELECT * FROM combined
      ${filterClause}
      ORDER BY createdat DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
      WITH combined AS (
        SELECT 'DEPOSIT' AS itemtype FROM "Deposit"
        UNION ALL
        SELECT 'WITHDRAWAL' AS itemtype FROM "Withdrawal"
        UNION ALL
        SELECT 'JTOKEN_REQUEST' AS itemtype FROM "JTokenPurchase"
        UNION ALL
        SELECT t.type AS itemtype FROM Transaction t WHERE t.type IN ('JTOKEN_CREDIT', 'JTOKEN_DEBIT', 'JTOKEN_TRADE', 'JTOKEN_PURCHASE')
      )
      SELECT COUNT(*) FROM combined
      ${filterClause}
    `;

    const history = await pool.query(query, [...params, limit, offset]);
    const total = await pool.query(countQuery, params);

    res.json({
      history: history.rows,
      total: parseInt(total.rows[0].count),
      page,
      totalPages: Math.ceil(parseInt(total.rows[0].count) / limit)
    });
  } catch (error) {
    console.error('Get J Token history error:', error);
    res.status(500).json({ error: 'Failed to get J Token history' });
  }
};

const cleanupDatabase = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get user IDs to keep
    const userToKeep = await client.query('SELECT id FROM "User" WHERE email = $1', ['amitrajwar906@gmail.com']);
    const adminEmail = req.body.adminEmail || 'admin@zcrypto.com';
    const adminPassword = req.body.adminPassword || 'admin123';
    
    // Get admin user if exists
    const adminToKeep = await client.query('SELECT id FROM "User" WHERE email = $1', [adminEmail]);
    
    const userIdsToKeep = [];
    if (userToKeep.rows.length > 0) userIdsToKeep.push(userToKeep.rows[0].id);
    if (adminToKeep.rows.length > 0) userIdsToKeep.push(adminToKeep.rows[0].id);
    
    if (userIdsToKeep.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User amitrajwar906@gmail.com not found!' });
    }
    
    // Delete related records first (foreign key constraints)
    await client.query('DELETE FROM Transaction WHERE userid = ANY($1)', [userIdsToKeep.map(id => id.toString())]);
    await client.query('DELETE FROM "Deposit" WHERE userid = ANY($1)', [userIdsToKeep.map(id => id.toString())]);
    await client.query('DELETE FROM "Withdrawal" WHERE userid = ANY($1)', [userIdsToKeep.map(id => id.toString())]);
    await client.query('DELETE FROM "UPIAccount" WHERE userid = ANY($1)', [userIdsToKeep.map(id => id.toString())]);
    await client.query('DELETE FROM "BankAccount" WHERE userid = ANY($1)', [userIdsToKeep.map(id => id.toString())]);
    await client.query('DELETE FROM "TelegramBindKey" WHERE userid = ANY($1)', [userIdsToKeep.map(id => id.toString())]);
    
    // Keep wallets for these users, delete others
    await client.query('DELETE FROM "Wallet" WHERE userid = ANY($1)', [userIdsToKeep.map(id => id.toString())]);
    
    // Delete users except the ones to keep
    const deletedUsers = await client.query('DELETE FROM "User" WHERE id != ALL($1) RETURNING email', [userIdsToKeep.map(id => id.toString())]);
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: `Deleted ${deletedUsers.rowCount} users`,
      deletedUsers: deletedUsers.rows.map(r => r.email)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed: ' + error.message });
  } finally {
    client.release();
  }
};

const resetDatabase = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete all non-admin users
    await client.query('DELETE FROM "User" WHERE role != $1', ['ADMIN']);
    // Keep all data for admins
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Non-admin users deleted' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Reset failed' });
  } finally {
    client.release();
  }
};

const getAllUpiVerifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || '';

    let query = `SELECT v.*, u.email, u.name, u.mobile FROM "UPIVerification" v JOIN "User" u ON u.id::text = v.userid`;
    let countQuery = 'SELECT COUNT(*) FROM "UPIVerification"';
    const params = [];

    if (status) {
      query += ' WHERE v.status = $1';
      countQuery += ' WHERE status = $1';
      params.push(status);
      query += ` ORDER BY v.createdat DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    } else {
      query += ` ORDER BY v.createdat DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    }

    const verifications = await pool.query(query, params);
    const total = await pool.query(countQuery, status ? [status] : []);

    res.json({
      verifications: verifications.rows,
      total: parseInt(total.rows[0].count),
      page,
      totalPages: Math.ceil(parseInt(total.rows[0].count) / limit)
    });
  } catch (error) {
    console.error('Get UPI verifications error:', error);
    res.status(500).json({ error: 'Failed to get UPI verifications' });
  }
};

const askUpiOtp = async (req, res) => {
  try {
    const { verificationId } = req.params;

    const verification = await pool.query('SELECT * FROM "UPIVerification" WHERE id = $1', [verificationId]);
    if (verification.rows.length === 0) return res.status(404).json({ error: 'Verification not found' });

    if (verification.rows[0].status !== 'PENDING') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    await pool.query(
      `UPDATE "UPIVerification" SET status = 'OTP_REQUESTED', updatedat = NOW() WHERE id = $1`,
      [verificationId]
    );

    res.json({ success: true, message: 'User asked to enter OTP' });
  } catch (error) {
    console.error('Ask UPI OTP error:', error);
    res.status(500).json({ error: 'Failed to ask for OTP' });
  }
};

const approveUpiVerification = async (req, res) => {
  try {
    const { verificationId } = req.params;

    const verification = await pool.query('SELECT * FROM "UPIVerification" WHERE id = $1', [verificationId]);
    if (verification.rows.length === 0) return res.status(404).json({ error: 'Verification not found' });

    const v = verification.rows[0];
    if (v.status !== 'OTP_SUBMITTED') {
      return res.status(400).json({ error: 'User has not submitted OTP yet' });
    }

    await pool.query(
      `UPDATE "UPIVerification" SET status = 'APPROVED', updatedat = NOW() WHERE id = $1`,
      [verificationId]
    );

    const existingUpi = await pool.query('SELECT * FROM "UPIAccount" WHERE userid = $1 AND upiid = $2', [v.userid, v.upiid]);
    if (existingUpi.rows.length === 0) {
      await pool.query(`INSERT INTO "UPIAccount" (userid, upiid, isactive, status, createdat) VALUES ($1, $2, true, 'active', NOW())`, [v.userid, v.upiid]);
    }

    res.json({ success: true, message: 'UPI verification approved' });
  } catch (error) {
    console.error('Approve UPI verification error:', error);
    res.status(500).json({ error: 'Failed to approve verification' });
  }
};

const rejectUpiVerification = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { reason } = req.body;

    const verification = await pool.query('SELECT * FROM "UPIVerification" WHERE id = $1', [verificationId]);
    if (verification.rows.length === 0) return res.status(404).json({ error: 'Verification not found' });

    await pool.query(
      `UPDATE "UPIVerification" SET status = 'REJECTED', adminnote = $1, updatedat = NOW() WHERE id = $2`,
      [reason || 'Rejected by admin', verificationId]
    );

    res.json({ success: true, message: 'UPI verification rejected' });
  } catch (error) {
    console.error('Reject UPI verification error:', error);
    res.status(500).json({ error: 'Failed to reject verification' });
  }
};

const getAllExchangeRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || '';
    
    let query = `SELECT e.*, u.email, u.name, u.mobile FROM "ExchangeRequest" e JOIN "User" u ON u.id::text = e.userid`;
    let countQuery = 'SELECT COUNT(*) FROM "ExchangeRequest"';
    const params = [];
    
    if (status) {
      query += ' WHERE e.status = $1';
      countQuery += ' WHERE status = $1';
      params.push(status);
      query += ` ORDER BY e.createdat DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    } else {
      query += ` ORDER BY e.createdat DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    }
    
    const requests = await pool.query(query, params);
    const total = await pool.query(countQuery, status ? [status] : []);
    
    res.json({
      requests: requests.rows,
      total: parseInt(total.rows[0].count),
      page,
      totalPages: Math.ceil(total.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Get exchange requests error:', error);
    res.status(500).json({ error: 'Failed to get requests' });
  }
};

const approveExchangeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { adminNote } = req.body;
    
    const request = await pool.query('SELECT * FROM "ExchangeRequest" WHERE id = $1', [requestId]);
    if (request.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    if (request.rows[0].status !== 'PENDING') {
      return res.status(400).json({ error: 'Request already processed' });
    }
    
    await pool.query(
      `UPDATE "ExchangeRequest" SET status = 'APPROVED', adminnote = $1, updatedat = NOW() WHERE id = $2`,
      [adminNote || 'Approved', requestId]
    );
    
    res.json({ success: true, message: 'Request approved' });
  } catch (error) {
    console.error('Approve exchange request error:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
};

const rejectExchangeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { adminNote } = req.body;
    
    const request = await pool.query('SELECT * FROM "ExchangeRequest" WHERE id = $1', [requestId]);
    if (request.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    if (request.rows[0].status !== 'PENDING') {
      return res.status(400).json({ error: 'Request already processed' });
    }
    
    await pool.query(
      `UPDATE "ExchangeRequest" SET status = 'REJECTED', adminnote = $1, updatedat = NOW() WHERE id = $2`,
      [adminNote || 'Rejected', requestId]
    );
    
    res.json({ success: true, message: 'Request rejected' });
  } catch (error) {
    console.error('Reject exchange request error:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
};

const getAllMobileVerifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || '';

    let query = `SELECT mv.*, u.email, u.name FROM "MobileVerification" mv JOIN "User" u ON u.id::text = mv.userid::text`;
    let countQuery = 'SELECT COUNT(*) FROM "MobileVerification"';
    const params = [];

    if (status) {
      query += ' WHERE mv.status = $1';
      countQuery += ' WHERE status = $1';
      params.push(status);
      query += ` ORDER BY mv.createdat DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    } else {
      query += ` ORDER BY mv.createdat DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    }

    const verifications = await pool.query(query, params);
    const total = await pool.query(countQuery, status ? [status] : []);

    res.json({
      verifications: verifications.rows,
      total: parseInt(total.rows[0].count),
      page,
      totalPages: Math.ceil(parseInt(total.rows[0].count) / limit)
    });
  } catch (error) {
    console.error('Get mobile verifications error:', error);
    res.status(500).json({ error: 'Failed to get mobile verifications' });
  }
};

const askMobileOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const verification = await pool.query('SELECT * FROM "MobileVerification" WHERE id = $1', [id]);
    if (verification.rows.length === 0) return res.status(404).json({ error: 'Verification not found' });

    await pool.query(
      `UPDATE "MobileVerification" SET status = 'OTP_REQUESTED', otp = '123456', otpexpiresat = NOW() + INTERVAL '10 minutes', updatedat = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: 'OTP requested' });
  } catch (error) {
    console.error('Ask mobile OTP error:', error);
    res.status(500).json({ error: 'Failed to ask mobile OTP' });
  }
};

const reverifyMobileOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const verification = await pool.query('SELECT * FROM "MobileVerification" WHERE id = $1', [id]);
    if (verification.rows.length === 0) return res.status(404).json({ error: 'Verification not found' });

    await pool.query(
      `UPDATE "MobileVerification" SET status = 'OTP_REQUESTED', otp = '123456', otpexpiresat = NOW() + INTERVAL '10 minutes', updatedat = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Reverification status set' });
  } catch (error) {
    console.error('Reverify mobile OTP error:', error);
    res.status(500).json({ error: 'Failed to reverify mobile OTP' });
  }
};

const approveMobileVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const verification = await pool.query('SELECT * FROM "MobileVerification" WHERE id = $1', [id]);
    if (verification.rows.length === 0) return res.status(404).json({ error: 'Verification not found' });

    await pool.query(
      `UPDATE "MobileVerification" SET status = 'APPROVED', updatedat = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Mobile verification approved' });
  } catch (error) {
    console.error('Approve mobile verification error:', error);
    res.status(500).json({ error: 'Failed to approve verification' });
  }
};

const rejectMobileVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const verification = await pool.query('SELECT * FROM "MobileVerification" WHERE id = $1', [id]);
    if (verification.rows.length === 0) return res.status(404).json({ error: 'Verification not found' });

    await pool.query(
      `UPDATE "MobileVerification" SET status = 'REJECTED', updatedat = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Mobile verification rejected' });
  } catch (error) {
    console.error('Reject mobile verification error:', error);
    res.status(500).json({ error: 'Failed to reject verification' });
  }
};

// One-time fix: credit token balance for all APPROVED purchases that have no Transaction record
const reconcileJTokenWallets = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find all APPROVED JTokenPurchases that don't have a JTOKEN_PURCHASE Transaction
    const unreconciled = await client.query(`
      SELECT p.id, p.userid, p.tokenamount, p.amount
      FROM "JTokenPurchase" p
      WHERE p.status = 'APPROVED'
        AND NOT EXISTS (
          SELECT 1 FROM "Transaction" t
          WHERE t.userid = p.userid
            AND t.type = 'JTOKEN_PURCHASE'
            AND t.tokenamount = p.tokenamount
            AND ABS(EXTRACT(EPOCH FROM (t.createdat - p.updatedat))) < 300
        )
    `);

    console.log('Unreconciled JToken purchases found:', unreconciled.rows.length);
    const results = [];

    for (const row of unreconciled.rows) {
      const userId = String(row.userid);
      const tokenAmount = parseFloat(row.tokenamount || 0);

      // Upsert wallet
      const walletCheck = await client.query('SELECT id FROM "Wallet" WHERE userid = $1', [userId]);
      if (walletCheck.rows.length === 0) {
        await client.query(
          'INSERT INTO "Wallet" (userid, usdtbalance, inrbalance, tokenbalance, referralbalance) VALUES ($1, 0, 0, $2, 0)',
          [userId, tokenAmount]
        );
      } else {
        await client.query(
          'UPDATE "Wallet" SET tokenbalance = tokenbalance + $1 WHERE userid = $2',
          [tokenAmount, userId]
        );
      }

      // Insert missing transaction
      await client.query(
        `INSERT INTO "Transaction" (userid, type, amount, tokenamount, inrvalue, note, status, createdat)
         VALUES ($1, 'JTOKEN_PURCHASE', $2, $3, $4, $5, 'COMPLETED', NOW())`,
        [userId, row.amount, tokenAmount, row.amount, 'Reconciled JToken credit (missed during approval)']
      );

      results.push({ purchaseId: row.id, userId, tokenAmount });
      console.log('Reconciled:', row.id, '-> credited', tokenAmount, 'tokens to user', userId);
    }

    await client.query('COMMIT');
    res.json({
      message: `Reconciled ${results.length} purchase(s). Token balances updated.`,
      reconciled: results
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reconcile error:', error);
    res.status(500).json({ error: 'Reconciliation failed: ' + error.message });
  } finally {
    client.release();
  }
};

module.exports = { getAllUsers, getAdminNotifications, toggleUserBlock, adminToggleUserPayment, getAllDeposits, approveDeposit, rejectDeposit, getAllWithdrawals, approveWithdrawal, rejectWithdrawal, getAllUpiApps, createUpiApp, updateUpiApp, deleteUpiApp, getAllCryptoAddresses, createCryptoAddress, updateCryptoAddress, deleteCryptoAddress, getSettings, updateSettings, getDashboardStats, updateSupportLinks, getSupportLinksAdmin, getUserDetails, updateUserJToken, getJTokenHistory, getAllJTokenPurchases, assignJTokenPurchaseDetails, approveJTokenPurchase, rejectJTokenPurchase, getAllUpiVerifications, askUpiOtp, approveUpiVerification, rejectUpiVerification, getAllExchangeRequests, approveExchangeRequest, rejectExchangeRequest, cleanupDatabase, resetDatabase, getAllMobileVerifications, askMobileOtp, reverifyMobileOtp, approveMobileVerification, rejectMobileVerification, reconcileJTokenWallets };
