// Simple Prisma-like wrapper using pg
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: { rejectUnauthorized: false }
});

// Helper to convert Prisma-like queries to pg
const db = {
  user: {
    findUnique: async ({ where }) => {
      if (where.email) {
        const result = await pool.query('SELECT * FROM "User" WHERE email = $1', [where.email]);
        return result.rows[0] || null;
      }
      if (where.id) {
        const result = await pool.query('SELECT * FROM "User" WHERE id = $1', [where.id]);
        return result.rows[0] || null;
      }
      return null;
    },
    findMany: async ({ where, select, orderBy, skip, take }) => {
      let query = 'SELECT * FROM "User"';
      const params = [];
      
      if (where) {
        const conditions = [];
        if (where.email?.contains !== undefined) {
          params.push('%' + where.email.contains + '%');
          conditions.push(`email ILIKE $${params.length}`);
        }
        if (where.referralCode) {
          params.push(where.referralCode);
          conditions.push(`"referralCode" = $${params.length}`);
        }
        if (where.id) {
          params.push(where.id);
          conditions.push(`id = $${params.length}`);
        }
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
      }
      
      if (orderBy) {
        const key = Object.keys(orderBy)[0];
        query += ` ORDER BY "${key}" ${orderBy[key]}`;
      }
      
      if (skip) query += ` OFFSET ${skip}`;
      if (take) query += ` LIMIT ${take}`;
      
      const result = await pool.query(query, params);
      if (select) {
        return result.rows.map(row => {
          const selected = {};
          for (const key of Object.keys(select)) selected[key] = row[key];
          return selected;
        });
      }
      return result.rows;
    },
    create: async ({ data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const query = `INSERT INTO "User" (${fields.join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
      const result = await pool.query(query, values);
      return result.rows[0];
    },
    update: async ({ where, data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
      let query;
      if (where.email) {
        query = `UPDATE "User" SET ${setClause} WHERE email = $${fields.length + 1} RETURNING *`;
        values.push(where.email);
      } else if (where.id) {
        query = `UPDATE "User" SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
        values.push(where.id);
      }
      const result = await pool.query(query, values);
      return result.rows[0];
    },
    delete: async ({ where }) => {
      if (where.email) await pool.query('DELETE FROM "User" WHERE email = $1', [where.email]);
      else if (where.id) await pool.query('DELETE FROM "User" WHERE id = $1', [where.id]);
      return { success: true };
    }
  },
  
  wallet: {
    findUnique: async ({ where }) => {
      const result = await pool.query('SELECT * FROM "Wallet" WHERE "userId" = $1', [where.userId]);
      return result.rows[0] || null;
    },
    upsert: async ({ where, create, update }) => {
      const existing = await pool.query('SELECT * FROM "Wallet" WHERE "userId" = $1', [where.userId]);
      if (existing.rows.length > 0) {
        const fields = Object.keys(update);
        const values = Object.values(update);
        const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
        const query = `UPDATE "Wallet" SET ${setClause} WHERE "userId" = $${fields.length + 1} RETURNING *`;
        return (await pool.query(query, [...values, where.userId])).rows[0];
      } else {
        const fields = Object.keys(create);
        const values = Object.values(create);
        const query = `INSERT INTO "Wallet" (${fields.join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
        return (await pool.query(query, values)).rows[0];
      }
    },
    update: async ({ where, data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
      const query = `UPDATE "Wallet" SET ${setClause} WHERE "userId" = $${fields.length + 1} RETURNING *`;
      return (await pool.query(query, [...values, where.userId])).rows[0];
    }
  },
  
  deposit: {
    create: async ({ data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const query = `INSERT INTO "Deposit" (${fields.join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
      return (await pool.query(query, values)).rows[0];
    },
    findMany: async ({ where, orderBy, skip, take }) => {
      let query = 'SELECT * FROM "Deposit"';
      const params = [];
      if (where?.userId) { params.push(where.userId); query += ` WHERE "userId" = $${params.length}`; }
      if (orderBy?.createdAt) query += ` ORDER BY "createdAt" ${orderBy.createdAt === 'desc' ? 'DESC' : 'ASC'}`;
      if (skip) query += ` OFFSET ${skip}`;
      if (take) query += ` LIMIT ${take}`;
      return (await pool.query(query, params)).rows;
    },
    findFirst: async ({ where }) => {
      let query = 'SELECT * FROM "Deposit"';
      const params = [];
      if (where?.id) { params.push(where.id); query += ` WHERE id = $${params.length}`; }
      return (await pool.query(query + ' LIMIT 1', params)).rows[0] || null;
    },
    update: async ({ where, data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
      return (await pool.query(`UPDATE "Deposit" SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`, [...values, where.id])).rows[0];
    }
  },
  
  withdrawal: {
    create: async ({ data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const query = `INSERT INTO "Withdrawal" (${fields.join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
      return (await pool.query(query, values)).rows[0];
    },
    findMany: async ({ where, orderBy, skip, take }) => {
      let query = 'SELECT * FROM "Withdrawal"';
      const params = [];
      if (where?.userId) { params.push(where.userId); query += ` WHERE "userId" = $${params.length}`; }
      if (orderBy?.createdAt) query += ` ORDER BY "createdAt" ${orderBy.createdAt === 'desc' ? 'DESC' : 'ASC'}`;
      if (skip) query += ` OFFSET ${skip}`;
      if (take) query += ` LIMIT ${take}`;
      return (await pool.query(query, params)).rows;
    },
    findFirst: async ({ where }) => {
      let query = 'SELECT * FROM "Withdrawal"';
      const params = [];
      if (where?.id) { params.push(where.id); query += ` WHERE id = $${params.length}`; }
      return (await pool.query(query + ' LIMIT 1', params)).rows[0] || null;
    },
    update: async ({ where, data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
      return (await pool.query(`UPDATE "Withdrawal" SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`, [...values, where.id])).rows[0];
    }
  },
  
  uPIAccount: {
    create: async ({ data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const query = `INSERT INTO "UPIAccount" (${fields.join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
      return (await pool.query(query, values)).rows[0];
    },
    findMany: async ({ where, orderBy }) => {
      let query = 'SELECT * FROM "UPIAccount"';
      const params = [];
      if (where?.userId) { params.push(where.userId); query += ` WHERE "userId" = $${params.length}`; }
      if (orderBy?.isPrimary) query += ` ORDER BY "isPrimary" DESC`;
      return (await pool.query(query, params)).rows;
    },
    findFirst: async ({ where }) => {
      let query = 'SELECT * FROM "UPIAccount"';
      const params = [];
      if (where?.id) { params.push(where.id); query += ` WHERE id = $${params.length}`; }
      if (where?.userId && where?.isPrimary !== undefined) { params.push(where.userId, where.isPrimary); query += ` WHERE "userId" = $1 AND "isPrimary" = $2`; }
      else if (where?.userId) { params.push(where.userId); query += ` WHERE "userId" = $1`; }
      else if (where?.isPrimary !== undefined) { params.push(where.isPrimary); query += ` WHERE "isPrimary" = $1`; }
      return (await pool.query(query + ' LIMIT 1', params)).rows[0] || null;
    },
    updateMany: async ({ where, data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
      let query = `UPDATE "UPIAccount" SET ${setClause}`;
      const params = [...values];
      if (where?.userId) { params.push(where.userId); query += ` WHERE "userId" = $${params.length}`; }
      return (await pool.query(query, params)).rowCount;
    },
    update: async ({ where, data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
      return (await pool.query(`UPDATE "UPIAccount" SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`, [...values, where.id])).rows[0];
    },
    delete: async ({ where }) => { await pool.query('DELETE FROM "UPIAccount" WHERE id = $1', [where.id]); return { success: true }; }
  },
  
  bankAccount: {
    create: async ({ data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const query = `INSERT INTO "BankAccount" (${fields.join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
      return (await pool.query(query, values)).rows[0];
    },
    findMany: async ({ where, orderBy }) => {
      let query = 'SELECT * FROM "BankAccount"';
      const params = [];
      if (where?.userId) { params.push(where.userId); query += ` WHERE "userId" = $${params.length}`; }
      if (orderBy?.isPrimary) query += ` ORDER BY "isPrimary" DESC`;
      return (await pool.query(query, params)).rows;
    },
    findFirst: async ({ where }) => {
      let query = 'SELECT * FROM "BankAccount"';
      const params = [];
      if (where?.id) { params.push(where.id); query += ` WHERE id = $${params.length}`; }
      if (where?.userId && where?.isPrimary !== undefined) { params.push(where.userId, where.isPrimary); query += ` WHERE "userId" = $1 AND "isPrimary" = $2`; }
      else if (where?.userId) { params.push(where.userId); query += ` WHERE "userId" = $1`; }
      return (await pool.query(query + ' LIMIT 1', params)).rows[0] || null;
    },
    updateMany: async ({ where, data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
      let query = `UPDATE "BankAccount" SET ${setClause}`;
      const params = [...values];
      if (where?.userId) { params.push(where.userId); query += ` WHERE "userId" = $${params.length}`; }
      return (await pool.query(query, params)).rowCount;
    },
    update: async ({ where, data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
      return (await pool.query(`UPDATE "BankAccount" SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`, [...values, where.id])).rows[0];
    },
    delete: async ({ where }) => { await pool.query('DELETE FROM "BankAccount" WHERE id = $1', [where.id]); return { success: true }; }
  },
  
  reward: {
    findUnique: async ({ where }) => (await pool.query('SELECT * FROM "Reward" WHERE "userId" = $1', [where.userId])).rows[0] || null,
    upsert: async ({ where, create, update }) => {
      const existing = await pool.query('SELECT * FROM "Reward" WHERE "userId" = $1', [where.userId]);
      if (existing.rows.length > 0) {
        const fields = Object.keys(update);
        const values = Object.values(update);
        const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
        return (await pool.query(`UPDATE "Reward" SET ${setClause} WHERE "userId" = $${fields.length + 1} RETURNING *`, [...values, where.userId])).rows[0];
      } else {
        const fields = Object.keys(create);
        const values = Object.values(create);
        return (await pool.query(`INSERT INTO "Reward" (${fields.join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, values)).rows[0];
      }
    }
  },
  
  transaction: { create: async ({ data }) => {
    const fields = Object.keys(data);
    const values = Object.values(data);
    return (await pool.query(`INSERT INTO "Transaction" (${fields.join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, values)).rows[0];
  }},
  
  settings: {
    findFirst: async () => (await pool.query('SELECT * FROM "Settings" LIMIT 1')).rows[0] || null,
    upsert: async ({ where, create, update }) => {
      const id = where?.id || 'default';
      const existing = await pool.query('SELECT * FROM "Settings" WHERE id = $1', [id]);
      if (existing.rows.length > 0) {
        const fields = Object.keys(update);
        const values = Object.values(update);
        return (await pool.query(`UPDATE "Settings" SET ${fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ')} WHERE id = $${fields.length + 1} RETURNING *`, [...values, id])).rows[0];
      } else {
        const fields = Object.keys(create);
        const values = Object.values(create);
        return (await pool.query(`INSERT INTO "Settings" (${fields.join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, values)).rows[0];
      }
    },
    update: async ({ where, data }) => {
      const fields = Object.keys(data);
      const values = Object.values(data);
      return (await pool.query(`UPDATE "Settings" SET ${fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ')} WHERE id = $${fields.length + 1} RETURNING *`, [...values, where.id])).rows[0];
    }
  },
  
  uPIApp: {
    findMany: async ({ where }) => {
      let query = 'SELECT * FROM "UPIApp"';
      const params = [];
      if (where?.isActive !== undefined) { params.push(where.isActive); query += ` WHERE "isActive" = $1`; }
      return (await pool.query(query, params)).rows;
    },
    create: async ({ data }) => (await pool.query(`INSERT INTO "UPIApp" (${Object.keys(data).join(', ')}) VALUES (${Object.keys(data).map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, Object.values(data))).rows[0],
    update: async ({ where, data }) => (await pool.query(`UPDATE "UPIApp" SET ${Object.keys(data).map((f, i) => `"${f}" = $${i + 1}`).join(', ')} WHERE id = ${Object.keys(data).length + 1} RETURNING *`, [...Object.values(data), where.id])).rows[0],
    delete: async ({ where }) => { await pool.query('DELETE FROM "UPIApp" WHERE id = $1', [where.id]); return { success: true }; }
  },
  
  cryptoAddress: {
    findMany: async ({ where }) => {
      let query = 'SELECT * FROM "CryptoAddress"';
      const params = [];
      if (where?.isActive !== undefined) { params.push(where.isActive); query += ` WHERE "isActive" = $1`; }
      return (await pool.query(query, params)).rows;
    },
    create: async ({ data }) => (await pool.query(`INSERT INTO "CryptoAddress" (${Object.keys(data).join(', ')}) VALUES (${Object.keys(data).map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, Object.values(data))).rows[0],
    update: async ({ where, data }) => (await pool.query(`UPDATE "CryptoAddress" SET ${Object.keys(data).map((f, i) => `"${f}" = $${i + 1}`).join(', ')} WHERE id = ${Object.keys(data).length + 1} RETURNING *`, [...Object.values(data), where.id])).rows[0],
    delete: async ({ where }) => { await pool.query('DELETE FROM "CryptoAddress" WHERE id = $1', [where.id]); return { success: true }; }
  },
  
  telegramBindKey: {
    create: async ({ data }) => (await pool.query(`INSERT INTO "TelegramBindKey" (${Object.keys(data).join(', ')}) VALUES (${Object.keys(data).map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, Object.values(data))).rows[0],
    findUnique: async ({ where }) => where.key ? (await pool.query('SELECT * FROM "TelegramBindKey" WHERE key = $1', [where.key])).rows[0] || null : null,
    findFirst: async ({ where }) => {
      let query = 'SELECT * FROM "TelegramBindKey"';
      const params = [];
      if (where?.userId) { params.push(where.userId); query += ` WHERE "userId" = $1`; }
      if (where?.used !== undefined) { params.push(where.used); query += params.length > 1 ? ` AND used = $${params.length}` : ` WHERE used = $1`; }
      return (await pool.query(query + ' ORDER BY "createdAt" DESC LIMIT 1', params)).rows[0] || null;
    },
    deleteMany: async ({ where }) => {
      let query = 'DELETE FROM "TelegramBindKey"';
      const params = [];
      if (where?.userId) { params.push(where.userId); query += ` WHERE "userId" = $1`; }
      return (await pool.query(query, params)).rowCount;
    },
    update: async ({ where, data }) => (await pool.query(`UPDATE "TelegramBindKey" SET ${Object.keys(data).map((f, i) => `"${f}" = $${i + 1}`).join(', ')} WHERE id = ${Object.keys(data).length + 1} RETURNING *`, [...Object.values(data), where.id])).rows[0]
  },
  
  otp: {
    create: async ({ data }) => (await pool.query(`INSERT INTO "Otp" (${Object.keys(data).join(', ')}) VALUES (${Object.keys(data).map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, Object.values(data))).rows[0],
    findFirst: async ({ where, orderBy }) => {
      let query = 'SELECT * FROM "Otp"';
      const params = [];
      if (where?.email) { params.push(where.email); query += ` WHERE email = $1`; }
      if (where?.otp) { params.push(where.otp); query += params.length > 1 ? ` AND otp = $${params.length}` : ` WHERE otp = $1`; }
      if (where?.expiresAt?.gt) { params.push(where.expiresAt.gt); query += params.length > 1 ? ` AND "expiresAt" > $${params.length}` : ` WHERE "expiresAt" > $1`; }
      if (orderBy?.createdAt) query += ` ORDER BY "createdAt" ${orderBy.createdAt === 'desc' ? 'DESC' : 'ASC'}`;
      return (await pool.query(query + ' LIMIT 1', params)).rows[0] || null;
    },
    deleteMany: async ({ where }) => { let q = 'DELETE FROM "Otp"'; const p = []; if (where?.email) { p.push(where.email); q += ` WHERE email = $1`; } return (await pool.query(q, p)).rowCount; }
  },
  
  trade: {
    create: async ({ data }) => (await pool.query(`INSERT INTO "Trade" (${Object.keys(data).join(', ')}) VALUES (${Object.keys(data).map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, Object.values(data))).rows[0],
    findMany: async ({ where, orderBy, take }) => {
      let query = 'SELECT * FROM "Trade"';
      const params = [];
      if (where?.status) { params.push(where.status); query += ` WHERE status = $${params.length}`; }
      if (orderBy?.createdAt) query += ` ORDER BY "createdAt" ${orderBy.createdAt === 'desc' ? 'DESC' : 'ASC'}`;
      if (take) query += ` LIMIT ${take}`;
      return (await pool.query(query, params)).rows;
    }
  },
  
  query: pool.query.bind(pool),
  $transaction: async (cb) => { const c = await pool.connect(); try { await c.query('BEGIN'); const r = await cb(c); await c.query('COMMIT'); return r; } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } },
  $disconnect: async () => { await pool.end(); }
};

module.exports = db;
