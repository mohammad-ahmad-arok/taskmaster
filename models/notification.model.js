const db = require('../config/db');

// Notifications are addressed by (role_table, role_id) — matches the
// separated role tables instead of a single user id space.
const Notification = {
    getByRecipient: (roleTable, roleId, callback) => {
        db.query(
            'SELECT * FROM notifications WHERE role_table = ? AND role_id = ? ORDER BY created_at DESC LIMIT 50',
            [roleTable, roleId],
            callback
        );
    },

    getUnreadCount: (roleTable, roleId, callback) => {
        db.query(
            'SELECT COUNT(*) as count FROM notifications WHERE role_table = ? AND role_id = ? AND is_read = 0',
            [roleTable, roleId],
            callback
        );
    },

    create: (notification, callback) => {
        db.query('INSERT INTO notifications SET ?', notification, callback);
    },

    createBulk: (notifications, callback) => {
        if (!notifications || notifications.length === 0) return callback(null, []);
        const query = 'INSERT INTO notifications (role_table, role_id, type, title, message, task_id, is_read, created_at) VALUES ?';
        const values = notifications.map(n => [
            n.role_table, n.role_id, n.type, n.title, n.message, n.task_id || null, 0, new Date()
        ]);
        db.query(query, [values], callback);
    },

    markAsRead: (notificationId, roleTable, roleId, callback) => {
        db.query(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND role_table = ? AND role_id = ?',
            [notificationId, roleTable, roleId],
            callback
        );
    },

    markAllAsRead: (roleTable, roleId, callback) => {
        db.query(
            'UPDATE notifications SET is_read = 1 WHERE role_table = ? AND role_id = ?',
            [roleTable, roleId],
            callback
        );
    },

    deleteOldRead: (callback) => {
        db.query(
            'DELETE FROM notifications WHERE is_read = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)',
            callback
        );
    }
};

module.exports = Notification;
