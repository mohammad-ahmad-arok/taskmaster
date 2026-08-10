const bcrypt = require('bcryptjs');
const db = require('../config/db');
const AuthIndex = require('../models/authIndex.model');
const { tableForRole } = require('../config/roles');

const roleModels = {
  ceo: require('../models/ceo.model'),
  team_manager: require('../models/teamManager.model'),
  qa: require('../models/qa.model'),
  employee: require('../models/employee.model'),
};

/**
 * Creates an account in the correct role table and registers it in
 * auth_index, all guarded by a transaction-like rollback: if the
 * auth_index insert fails (e.g. duplicate email), the role-table row
 * is removed so we never end up with an orphaned, unreachable account.
 */
function createAccount(role, fields, callback) {
  const model = roleModels[role];
  if (!model) return callback(new Error(`Unknown role: ${role}`));

  db.query('SELECT email FROM auth_index WHERE email = ?', [fields.email], (checkErr, existing) => {
    if (checkErr) return callback(checkErr);
    if (existing.length > 0) return callback(new Error('EMAIL_IN_USE'));

    bcrypt.hash(fields.password, 10).then((hashed) => {
      const row = { ...fields, password: hashed };
      model.create(row, (createErr, result) => {
        if (createErr) return callback(createErr);

        const roleId = result.insertId;
        const roleTable = tableForRole(role);

        AuthIndex.create({ email: fields.email, role, role_table: roleTable, role_id: roleId }, (idxErr) => {
          if (idxErr) {
            // Roll back the orphaned role-table row.
            model.delete(roleId, () => {});
            return callback(idxErr);
          }
          callback(null, { id: roleId, roleTable });
        });
      });
    }).catch(callback);
  });
}

module.exports = { createAccount };
