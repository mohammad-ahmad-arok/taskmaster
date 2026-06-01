const db = require('../config/db');

const PushSubscription = {
    // Save or update a subscription for a user
    upsert: (userId, subscription, callback) => {
        const endpoint = subscription.endpoint;
        const p256dh = subscription.keys?.p256dh || '';
        const auth = subscription.keys?.auth || '';

        // Check if endpoint already exists
        db.query('SELECT id FROM push_subscriptions WHERE endpoint = ?', [endpoint], (err, results) => {
            if (err) return callback(err);

            if (results.length > 0) {
                // Update existing
                db.query(
                    'UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, updated_at = NOW() WHERE endpoint = ?',
                    [userId, p256dh, auth, endpoint],
                    callback
                );
            } else {
                // Insert new
                db.query(
                    'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)',
                    [userId, endpoint, p256dh, auth],
                    callback
                );
            }
        });
    },

    // Get all subscriptions for a user
    getByUserId: (userId, callback) => {
        db.query(
            'SELECT * FROM push_subscriptions WHERE user_id = ?',
            [userId],
            callback
        );
    },

    // Get all subscriptions for multiple users
    getByUserIds: (userIds, callback) => {
        if (!userIds || userIds.length === 0) return callback(null, []);
        db.query(
            'SELECT * FROM push_subscriptions WHERE user_id IN (?)',
            [userIds],
            callback
        );
    },

    // Get subscriptions for all managers
    getManagerSubscriptions: (callback) => {
        db.query(
            "SELECT ps.* FROM push_subscriptions ps JOIN user u ON u.id = ps.user_id WHERE u.role = 'manager'",
            callback
        );
    },

    // Delete a subscription by endpoint (when push fails)
    deleteByEndpoint: (endpoint, callback) => {
        db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint], callback);
    },

    // Delete all subscriptions for a user
    deleteByUserId: (userId, callback) => {
        db.query('DELETE FROM push_subscriptions WHERE user_id = ?', [userId], callback);
    }
};

module.exports = PushSubscription;
