const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const AuthIndex = require('../models/authIndex.model');
const { logActivity } = require('../utils/activityLogger');
const presence = require('../sockets/presenceStore');

const roleModels = {
  ceo: require('../models/ceo.model'),
  team_manager: require('../models/teamManager.model'),
  qa: require('../models/qa.model'),
  employee: require('../models/employee.model'),
};

// Login flow:
// 1. Look up the email in auth_index -> tells us which of the four
//    physically separate tables the account lives in.
// 2. Fetch the row (with password hash) from THAT table only.
// 3. Verify password, issue a JWT carrying { id, email, role, roleTable }.
// No cross-table scan, no shared users table.
exports.login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Enter email and password' });

  AuthIndex.findByEmail(email, async (err, indexResults) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    if (indexResults.length === 0)
      return res.status(401).json({ error: 'User not found' });

    const { role, role_table: roleTable, role_id: roleId } = indexResults[0];
    const model = roleModels[role];
    if (!model) return res.status(500).json({ error: 'Account routing error' });

    model.getByEmailWithSecret(email, async (err2, rows) => {
      if (err2) return res.status(500).json({ error: 'Database error' });
      if (rows.length === 0) return res.status(401).json({ error: 'User not found' });

      const account = rows[0];

      if (account.is_active === 0) {
        return res.status(403).json({ error: 'Account is deactivated' });
      }

      const isMatch = await bcrypt.compare(password, account.password);
      if (!isMatch) return res.status(401).json({ error: 'Incorrect password' });

      model.updateLastLogin(account.id, () => {});

      const token = jwt.sign(
        { id: account.id, email: account.email, role, roleTable },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      logActivity({ roleTable, roleId: account.id, actorName: account.name, actionType: 'login' });
      presence.markOnline(roleTable, account.id);

      res.json({
        success: true,
        data: {
          token,
          user: { id: account.id, name: account.name, email: account.email, role },
        },
      });
    });
  });
};

// get current user info from the role-specific table
exports.getCurrentUser = (req, res) => {
  const { id, role } = req.user;
  const model = roleModels[role];
  if (!model) return res.status(500).json({ error: 'Account routing error' });

  model.getById(id, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(404).json({ message: 'User not found' });

    model.updateLastLogin(id, () => {});

    res.json({ success: true, data: { ...results[0], role } });
  });
};

exports.logout = (req, res) => {
  if (req.user) {
    const { roleTable, id, email } = req.user;
    logActivity({ roleTable, roleId: id, actorName: email, actionType: 'logout' });
    presence.markOffline(roleTable, id);
  }
  res.json({ message: 'Logged out' });
};

// Self-service password change — any authenticated role, own account only.
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { id, role, roleTable } = req.user;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const model = roleModels[role];
  if (!model) return res.status(500).json({ error: 'Account routing error' });

  model.getByEmailWithSecret(req.user.email, async (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (rows.length === 0) return res.status(404).json({ error: 'Account not found' });

    const account = rows[0];
    const isMatch = await bcrypt.compare(currentPassword, account.password);
    if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    db.query(`UPDATE \`${roleTable}\` SET password = ? WHERE id = ?`, [hashed, id], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: 'Failed to update password' });
      logActivity({ roleTable, roleId: id, actorName: account.name, actionType: 'login', metadata: { event: 'password_changed' } });
      res.json({ success: true, message: 'Password updated successfully' });
    });
  });
};
