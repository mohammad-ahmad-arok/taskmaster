const makeRoleModel = require('./_roleAccountFactory');
const db = require('../config/db');

const TeamManager = makeRoleModel('team_managers', [
  'id', 'name', 'email', 'department', 'last_login', 'is_active', 'created_at',
]);

// Employees supervised by this manager
TeamManager.getTeam = (managerId, callback) => {
  db.query(
    'SELECT id, name, email, position, department, joined_date FROM employees WHERE manager_id = ? ORDER BY id',
    [managerId],
    callback
  );
};

module.exports = TeamManager;
