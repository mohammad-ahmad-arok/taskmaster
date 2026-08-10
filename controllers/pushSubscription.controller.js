const PushSubscription = require('../models/pushSubscription.model');
require('dotenv').config();

exports.subscribe = (req, res) => {
    const { id, roleTable } = req.user;
    const subscription = req.body;

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription object' });
    }

    PushSubscription.upsert(roleTable, id, subscription, (err) => {
        if (err) {
            console.error('Subscribe error:', err);
            return res.status(500).json({ error: 'Failed to save subscription' });
        }
        res.status(201).json({ success: true, message: 'Subscribed successfully' });
    });
};

exports.unsubscribe = (req, res) => {
    const { id, roleTable } = req.user;

    PushSubscription.deleteByRecipient(roleTable, id, (err) => {
        if (err) return res.status(500).json({ error: 'Failed to remove subscription' });
        res.json({ success: true });
    });
};

exports.getVapidPublicKey = (req, res) => {
    res.json({ success: true, data: { publicKey: process.env.VAPID_PUBLIC_KEY } });
};
