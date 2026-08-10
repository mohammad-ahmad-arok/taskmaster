const db = require('../config/db');
const { tableForRole } = require('../config/roles');

// Looks up a display name in the correct physical role table.
// Used anywhere we need "who did this" (notes, notifications, etc.)
// without maintaining a duplicate/shared users table.
function getAccountName(role, id, callback) {
  let table;
  try {
    table = tableForRole(role);
  } catch (e) {
    return callback(e);
  }
  db.query(`SELECT name FROM \`${table}\` WHERE id = ? LIMIT 1`, [id], (err, rows) => {
    if (err) return callback(err);
    if (rows.length === 0) return callback(new Error('Account not found'));
    callback(null, rows[0].name);
  });
}

module.exports = { getAccountName };
