const db = require('../config/db');

// Fire-and-forget activity logging. Never throws into the caller's
// request/socket handler — logging failures must not break the feature
// that triggered them.
function logActivity({ roleTable, roleId, actorName, actionType, metadata = null }) {
  db.query(
    'INSERT INTO activity_log (role_table, role_id, actor_name, action_type, metadata) VALUES (?, ?, ?, ?, ?)',
    [roleTable, roleId, actorName || null, actionType, metadata ? JSON.stringify(metadata) : null],
    (err) => { if (err) console.error('activity_log insert failed:', err.message); }
  );
}

module.exports = { logActivity };
