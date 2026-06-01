const Notification = require('../models/notification.model');

// Get notifications for current user
exports.getMyNotifications = (req, res) => {
    const { id: userId } = req.user;

    Notification.getByUserId(userId, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json({ success: true, data: results });
    });
};

// Get unread count
exports.getUnreadCount = (req, res) => {
    const { id: userId } = req.user;

    Notification.getUnreadCount(userId, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json({ success: true, data: { count: results[0].count } });
    });
};

// Mark notification as read
exports.markAsRead = (req, res) => {
    const { id: userId } = req.user;
    const { notificationId } = req.params;

    Notification.markAsRead(notificationId, userId, (err, result) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json({ success: true });
    });
};

// Mark all as read
exports.markAllAsRead = (req, res) => {
    const { id: userId } = req.user;

    Notification.markAllAsRead(userId, (err) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json({ success: true });
    });
};
