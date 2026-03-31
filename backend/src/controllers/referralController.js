const { pool } = require('../database/index');

const getTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's referral code
    const userResult = await pool.query(
      'SELECT referralcode FROM "User" WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const referralCode = userResult.rows[0].referralcode;
    
    // Get all referrals (team members)
    const referralsResult = await pool.query(
      `SELECT u.id, u.email, u.name, u.createdat, u.mobile, u.isverified,
              w.inrbalance, w.usdtbalance, w.referralbalance
       FROM "User" u
       LEFT JOIN "Wallet" w ON u.id::text = w.userid
       WHERE u.referredby = $1
       ORDER BY u.createdat DESC`,
      [referralCode]
    );
    
    // Total referrals count
    const totalReferrals = referralsResult.rows.length;
    
    // Get this month's new referrals
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newTeamThisMonth = referralsResult.rows.filter(
      r => new Date(r.createdat) >= startOfMonth
    ).length;
    
    // Get today's date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Calculate today's earnings (from REFERRAL transactions)
    const todayEarningsResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM "Transaction" 
       WHERE userid = $1 
         AND type = 'REFERRAL' 
         AND status = 'COMPLETED'
         AND createdat >= $2`,
      [userId, today]
    );
    
    // Calculate yesterday's earnings
    const yesterdayEarningsResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM "Transaction" 
       WHERE userid = $1 
         AND type = 'REFERRAL' 
         AND status = 'COMPLETED'
         AND createdat >= $2 
         AND createdat < $3`,
      [userId, yesterday, today]
    );
    
    // Calculate total referral earnings
    const totalEarningsResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM "Transaction" 
       WHERE userid = $1 
         AND type = 'REFERRAL' 
         AND status = 'COMPLETED'`,
      [userId]
    );
    
    // Calculate earnings from each referral member
    const referralsWithEarnings = await Promise.all(
      referralsResult.rows.map(async (ref) => {
        const earningsResult = await pool.query(
          `SELECT COALESCE(SUM(amount), 0) as total 
           FROM "Transaction" 
           WHERE userid = $1 
             AND type = 'REFERRAL' 
             AND referralid = $2
             AND status = 'COMPLETED'`,
          [userId, ref.id]
        );
        
        // Get last activity (last transaction)
        const lastActivityResult = await pool.query(
          `SELECT createdat FROM "Transaction" 
           WHERE referralid = $1 
           ORDER BY createdat DESC LIMIT 1`,
          [ref.id]
        );
        
        return {
          id: ref.id,
          email: ref.email,
          name: ref.name || ref.email.split('@')[0],
          mobile: ref.mobile,
          isverified: ref.isverified,
          joinDate: ref.createdat,
          lastActive: lastActivityResult.rows[0]?.createdat || null,
          inrBalance: parseFloat(ref.inrbalance || 0),
          usdtBalance: parseFloat(ref.usdtbalance || 0),
          totalEarnings: parseFloat(earningsResult.rows[0]?.total || 0)
        };
      })
    );
    
    res.json({
      referralCode: referralCode,
      totalReferrals: totalReferrals,
      newTeamThisMonth: newTeamThisMonth,
      todayEarnings: parseFloat(todayEarningsResult.rows[0]?.total || 0),
      yesterdayEarnings: parseFloat(yesterdayEarningsResult.rows[0]?.total || 0),
      totalEarnings: parseFloat(totalEarningsResult.rows[0]?.total || 0),
      referrals: referralsWithEarnings
    });
    
  } catch (error) {
    console.error('Error in getTeam:', error);
    res.status(500).json({ error: 'Failed to fetch team data' });
  }
};

module.exports = { getTeam };
