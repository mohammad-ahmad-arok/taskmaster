const db = require('../config/db');

const Notification = {
    // Get all notifications for a user
    getByUserId: (userId, callback) => {
        const query = `
            SELECT * FROM notifications 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 50
        `;
        db.query(query, [userId], callback);
    },

    // Get unread count for a user
    getUnreadCount: (userId, callback) => {
        db.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [userId],
            callback
        );
    },

    // Create notification
    create: (notification, callback) => {
        db.query('INSERT INTO notifications SET ?', notification, callback);
    },

    // Create bulk notifications (for multiple users)
    createBulk: (notifications, callback) => {
        if (!notifications || notifications.length === 0) return callback(null, []);
        const query = 'INSERT INTO notifications (user_id, type, title, message, task_id, is_read, created_at) VALUES ?';
        const values = notifications.map(n => [
            n.user_id, n.type, n.title, n.message, n.task_id || null, 0, new Date()
        ]);
        db.query(query, [values], callback);
    },

    // Mark notification as read
    markAsRead: (notificationId, userId, callback) => {
        db.query(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [notificationId, userId],
            callback
        );
    },

    // Mark all notifications as read for a user
    markAllAsRead: (userId, callback) => {
        db.query(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
            [userId],
            callback
        );
    },

    // Delete old read notifications (cleanup)
    deleteOldRead: (callback) => {
        db.query(
            'DELETE FROM notifications WHERE is_read = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)',
            callback
        );
    }
};

module.exports = Notification;
