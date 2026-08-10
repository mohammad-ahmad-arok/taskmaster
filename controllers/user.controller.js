// Account management across the four separate role tables.
// Creation hierarchy (enforced below, on top of route-level RBAC):
//   - ceo          -> may create team_manager, qa, employee
//   - team_manager -> may create employee only (and only within their own team)
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { createAccount } = require('../utils/createAccount');
const { tableForRole } = require('../config/roles');
const AuthIndex = require('../models/authIndex.model');
const { notifyEmployeeAdded } = require('../utils/notificationHelper');

const CREATION_PERMISSIONS = {
  ceo: ['ceo', 'team_manager', 'qa', 'employee'],
  team_manager: ['employee'],
};

// GET /api/user/getall — a lightweight directory (name/email/role only,
// no passwords, no financial data) assembled by unioning the four tables.
// Available to ceo/team_manager/qa for assigning tasks etc.
exports.getUsers = (req, res) => {
  const sql = `
    SELECT id, name, email, 'ceo' AS role FROM ceo
    UNION ALL
    SELECT id, name, email, 'team_manager' AS role FROM team_managers
    UNION ALL
    SELECT id, name, email, 'qa' AS role FROM qa_reviewers
    UNION ALL
    SELECT id, name, email, 'employee' AS role FROM employees
    ORDER BY role, name
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database Error' });
    res.json({ success: true, data: results });
  });
};

// POST /api/user/addnew — create an account in the role table requested.
exports.createUser = async (req, res) => {
  const { name, email, password, role, ...extra } = req.body;
  const requester = req.user; // { id, role, roleTable }

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }

  const allowedTargets = CREATION_PERMISSIONS[requester.role] || [];
  if (!allowedTargets.includes(role)) {
    return res.status(403).json({ error: `Forbidden: ${requester.role} may not create ${role} accounts` });
  }

  // team_manager-created employees are auto-attached to that manager's team.
  const fields = { name, email, password };
  if (role === 'employee') {
    fields.position = extra.position || null;
    fields.department = extra.department || null;
    fields.joined_date = extra.joined_date || null;
    fields.internal_cost_rate = extra.internalCostRate || 0; // CEO sets this later via financial module
    fields.manager_id = requester.role === 'team_manager' ? requester.id : (extra.managerId || null);
  }
  if (role === 'team_manager') {
    fields.department = extra.department || null;
  }
  if (role === 'qa') {
    fields.specialty = extra.specialty || null;
  }

  createAccount(role, fields, (err, created) => {
    if (err) {
      if (err.message === 'EMAIL_IN_USE') return res.status(409).json({ error: 'Email already in use' });
      console.error('createAccount error:', err);
      return res.status(500).json({ error: 'Error creating account' });
    }

    if (role === 'employee') {
      notifyEmployeeAdded(name, requester.id).catch(() => {});
    }

    res.status(201).json({
      success: true,
      data: { id: created.id, name, email, role },
    });
  });
};

// DELETE /api/user/delete/:id — requires ?role= query param since ids are
// no longer unique across a single table.
exports.deleteUser = (req, res) => {
  const targetId = req.params.id;
  const targetRole = req.query.role;
  const requester = req.user;

  if (!targetRole) return res.status(400).json({ error: 'role query parameter is required' });

  const allowedTargets = CREATION_PERMISSIONS[requester.role] || [];
  if (!allowedTargets.includes(targetRole)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let table;
  try {
    table = tableForRole(targetRole);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  db.query(`DELETE FROM \`${table}\` WHERE id = ?`, [targetId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error deleting account' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Account not found' });

    AuthIndex.deleteByRoleRow(table, targetId, () => {});
    res.status(200).json({ message: 'Account deleted successfully' });
  });
};
