const db = require('../config/db');

// Tracks how many active sockets/sessions each account has, so a user
// with two open tabs doesn't flicker offline when they close one.
const socketCounts = new Map(); // key: `${roleTable}:${roleId}` -> count
let io = null;

function key(roleTable, roleId) {
  return `${roleTable}:${roleId}`;
}

function attachIO(socketIOInstance) {
  io = socketIOInstance;
}

function broadcast(roleTable, roleId, status) {
  if (io) {
    io.emit('presence:update', { roleTable, roleId, status, at: new Date().toISOString() });
  }
}

function upsertRow(roleTable, roleId, status, count) {
  db.query(
    `INSERT INTO presence_status (role_table, role_id, status, last_seen, socket_count)
     VALUES (?, ?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), last_seen = NOW(), socket_count = VALUES(socket_count)`,
    [roleTable, roleId, status, count],
    (err) => { if (err) console.error('presence upsert error:', err.message); }
  );
}

const presence = {
  markOnline(roleTable, roleId) {
    const k = key(roleTable, roleId);
    const next = (socketCounts.get(k) || 0) + 1;
    socketCounts.set(k, next);
    upsertRow(roleTable, roleId, 'online', next);
    if (next === 1) broadcast(roleTable, roleId, 'online');
  },

  markOffline(roleTable, roleId) {
    const k = key(roleTable, roleId);
    const next = Math.max((socketCounts.get(k) || 1) - 1, 0);
    socketCounts.set(k, next);
    upsertRow(roleTable, roleId, next > 0 ? 'online' : 'offline', next);
    if (next === 0) broadcast(roleTable, roleId, 'offline');
  },

  getAll(callback) {
    db.query('SELECT role_table, role_id, status, last_seen FROM presence_status', callback);
  },
};

module.exports = Object.assign(presence, { attachIO });
