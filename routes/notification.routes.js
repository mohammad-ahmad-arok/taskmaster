const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const verifyToken = require('../middlewares/auth');

router.get('/', verifyToken, notificationController.getMyNotifications);
router.get('/unread-count', verifyToken, notificationController.getUnreadCount);
router.put('/:notificationId/read', verifyToken, notificationController.markAsRead);
router.put('/mark-all-read', verifyToken, notificationController.markAllAsRead);

module.exports = router;
