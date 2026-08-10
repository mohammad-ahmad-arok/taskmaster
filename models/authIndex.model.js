const db = require('../config/db');

// IMPORTANT: auth_index stores ONLY routing info (email -> role/table/id).
// It is never used as a substitute users table. Profile/business data
// always lives in the role-specific table (ceo, team_managers,
// qa_reviewers, employees) and must be fetched from there.
const AuthIndex = {
  findByEmail: (email, callback) => {
    db.query('SELECT * FROM auth_index WHERE email = ? LIMIT 1', [email], callback);
  },

  create: (entry, callback) => {
    // entry: { email, role, role_table, role_id }
    db.query('INSERT INTO auth_index SET ?', entry, callback);
  },

  deleteByRoleRow: (roleTable, roleId, callback) => {
    db.query('DELETE FROM auth_index WHERE role_table = ? AND role_id = ?', [roleTable, roleId], callback);
  },
};

module.exports = AuthIndex;
