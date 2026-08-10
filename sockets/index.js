const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const presence = require('./presenceStore');
const { logActivity } = require('../utils/activityLogger');

function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', credentials: true },
  });

  presence.attachIO(io);

  // Auth handshake: client connects with { auth: { token } }
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { id, email, role, roleTable }
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { roleTable, id: roleId, role, email } = socket.user;

    presence.markOnline(roleTable, roleId);
    logActivity({ roleTable, roleId, actorName: email, actionType: 'online' });

    // Everyone joins a broadcast room so presence changes reach all clients,
    // plus a personal room for targeted notifications.
    socket.join('presence-room');
    socket.join(`user:${roleTable}:${roleId}`);
    if (role === 'ceo' || role === 'team_manager' || role === 'qa') {
      socket.join('reviewers-room');
    }

    // Client can request the full current presence snapshot on load.
    socket.on('presence:request-snapshot', () => {
      presence.getAll((err, rows) => {
        if (!err) socket.emit('presence:snapshot', rows);
      });
    });

    // Lightweight "I'm still active" ping from the frontend (e.g. every 60s
    // or on task interaction) feeds the Activity Log without a full reload.
    socket.on('activity:ping', (payload = {}) => {
      logActivity({
        roleTable,
        roleId,
        actorName: email,
        actionType: 'task_view',
        metadata: payload,
      });
    });

    socket.on('disconnect', () => {
      presence.markOffline(roleTable, roleId);
      logActivity({ roleTable, roleId, actorName: email, actionType: 'offline' });
    });
  });

  return io;
}

module.exports = initSockets;
