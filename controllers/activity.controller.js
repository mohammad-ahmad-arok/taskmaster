const db = require('../config/db');
const presence = require('../sockets/presenceStore');

// Full activity feed — CEO / team managers / QA only (enforced by route).
exports.getActivityLog = (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  db.query(
    'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?',
    [limit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, data: rows });
    }
  );
};

// Activity for a single account. Employees may only view their own;
// managers/QA/CEO may view anyone's (checked in controller since it
// depends on the :roleTable/:roleId params, not just the route role).
exports.getActivityForAccount = (req, res) => {
  const { roleTable, roleId } = req.params;
  const requester = req.user;

  const isSelf = requester.roleTable === roleTable && String(requester.id) === String(roleId);
  const isPrivileged = ['ceo', 'team_manager', 'qa'].includes(requester.role);

  if (!isSelf && !isPrivileged) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.query(
    'SELECT * FROM activity_log WHERE role_table = ? AND role_id = ? ORDER BY created_at DESC LIMIT 200',
    [roleTable, roleId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, data: rows });
    }
  );
};

// Current online/offline snapshot for every account.
exports.getPresenceSnapshot = (req, res) => {
  presence.getAll((err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, data: rows });
  });
};
