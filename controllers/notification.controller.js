const Notification = require('../models/notification.model');

exports.getMyNotifications = (req, res) => {
    const { id, roleTable } = req.user;
    Notification.getByRecipient(roleTable, id, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json({ success: true, data: results });
    });
};

exports.getUnreadCount = (req, res) => {
    const { id, roleTable } = req.user;
    Notification.getUnreadCount(roleTable, id, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json({ success: true, data: { count: results[0].count } });
    });
};

exports.markAsRead = (req, res) => {
    const { id, roleTable } = req.user;
    const { notificationId } = req.params;
    Notification.markAsRead(notificationId, roleTable, id, (err) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json({ success: true });
    });
};

exports.markAllAsRead = (req, res) => {
    const { id, roleTable } = req.user;
    Notification.markAllAsRead(roleTable, id, (err) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json({ success: true });
    });
};
