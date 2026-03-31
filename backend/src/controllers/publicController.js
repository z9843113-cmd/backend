const { pool } = require('../database/index');

const getUpiApps = async (req, res) => {
  const apps = await pool.query('SELECT * FROM "UPIApp" WHERE isactive = true');
  res.json(apps.rows);
};

const getCryptoAddresses = async (req, res) => {
  const addresses = await pool.query('SELECT * FROM "CryptoAddress" WHERE isactive = true');
  res.json(addresses.rows);
};

module.exports = { getUpiApps, getCryptoAddresses };
