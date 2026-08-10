const db = require('../config/db');

/**
 * Builds a small CRUD model bound to one physical role table.
 * Each role table is completely separate (no shared "users" table) —
 * this factory just avoids re-typing the same five queries four times.
 */
function makeRoleModel(tableName, safeColumns) {
  const cols = safeColumns.join(', ');

  return {
    tableName,

    getAll: (callback) => {
      db.query(`SELECT ${cols} FROM \`${tableName}\` ORDER BY id`, callback);
    },

    getById: (id, callback) => {
      db.query(`SELECT ${cols} FROM \`${tableName}\` WHERE id = ? LIMIT 1`, [id], callback);
    },

    // Includes password hash — only ever used internally by auth logic.
    getByEmailWithSecret: (email, callback) => {
      db.query(`SELECT * FROM \`${tableName}\` WHERE email = ? LIMIT 1`, [email], callback);
    },

    create: (row, callback) => {
      db.query(`INSERT INTO \`${tableName}\` SET ?`, row, callback);
    },

    updateLastLogin: (id, callback) => {
      db.query(`UPDATE \`${tableName}\` SET last_login = NOW() WHERE id = ?`, [id], callback);
    },

    delete: (id, callback) => {
      db.query(`DELETE FROM \`${tableName}\` WHERE id = ?`, [id], callback);
    },
  };
}

module.exports = makeRoleModel;
