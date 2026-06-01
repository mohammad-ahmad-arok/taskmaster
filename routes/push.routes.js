const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushSubscription.controller');
const verifyToken = require('../middlewares/auth');

router.get('/vapid-public-key', pushController.getVapidPublicKey);
router.post('/subscribe', verifyToken, pushController.subscribe);
router.delete('/unsubscribe', verifyToken, pushController.unsubscribe);

module.exports = router;
