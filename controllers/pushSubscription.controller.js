const PushSubscription = require('../models/pushSubscription.model');
require('dotenv').config();

// Save subscription from browser
exports.subscribe = (req, res) => {
    const { id: userId } = req.user;
    const subscription = req.body;

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription object' });
    }

    PushSubscription.upsert(userId, subscription, (err) => {
        if (err) {
            console.error('Subscribe error:', err);
            return res.status(500).json({ error: 'Failed to save subscription' });
        }
        res.status(201).json({ success: true, message: 'Subscribed successfully' });
    });
};

// Remove subscription (user unsubscribes)
exports.unsubscribe = (req, res) => {
    const { id: userId } = req.user;

    PushSubscription.deleteByUserId(userId, (err) => {
        if (err) return res.status(500).json({ error: 'Failed to remove subscription' });
        res.json({ success: true });
    });
};

// Get VAPID public key for the client
exports.getVapidPublicKey = (req, res) => {
    res.json({ success: true, data: { publicKey: process.env.VAPID_PUBLIC_KEY } });
};
