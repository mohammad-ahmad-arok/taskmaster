const db = require('../config/db');

const PushSubscription = {
    upsert: (roleTable, roleId, subscription, callback) => {
        const endpoint = subscription.endpoint;
        const p256dh = subscription.keys?.p256dh || '';
        const auth = subscription.keys?.auth || '';

        db.query('SELECT id FROM push_subscriptions WHERE endpoint = ?', [endpoint], (err, results) => {
            if (err) return callback(err);

            if (results.length > 0) {
                db.query(
                    'UPDATE push_subscriptions SET role_table = ?, role_id = ?, p256dh = ?, auth = ?, updated_at = NOW() WHERE endpoint = ?',
                    [roleTable, roleId, p256dh, auth, endpoint],
                    callback
                );
            } else {
                db.query(
                    'INSERT INTO push_subscriptions (role_table, role_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)',
                    [roleTable, roleId, endpoint, p256dh, auth],
                    callback
                );
            }
        });
    },

    getByRecipient: (roleTable, roleId, callback) => {
        db.query('SELECT * FROM push_subscriptions WHERE role_table = ? AND role_id = ?', [roleTable, roleId], callback);
    },

    getByRecipients: (recipients, callback) => {
        // recipients: [{ roleTable, roleId }, ...]
        if (!recipients || recipients.length === 0) return callback(null, []);
        const clauses = recipients.map(() => '(role_table = ? AND role_id = ?)').join(' OR ');
        const params = recipients.flatMap(r => [r.roleTable, r.roleId]);
        db.query(`SELECT * FROM push_subscriptions WHERE ${clauses}`, params, callback);
    },

    getManagerSubscriptions: (callback) => {
        db.query("SELECT * FROM push_subscriptions WHERE role_table = 'team_managers'", callback);
    },

    deleteByEndpoint: (endpoint, callback) => {
        db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint], callback);
    },

    deleteByRecipient: (roleTable, roleId, callback) => {
        db.query('DELETE FROM push_subscriptions WHERE role_table = ? AND role_id = ?', [roleTable, roleId], callback);
    }
};

module.exports = PushSubscription;
