const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const verifyToken = require('../middlewares/auth');
const { requireRole } = require('../middlewares/rbac');

// Full feed: managers/QA/CEO only
router.get('/', verifyToken, requireRole('ceo', 'team_manager', 'qa'), activityController.getActivityLog);

// Presence snapshot: any authenticated role
router.get('/presence', verifyToken, activityController.getPresenceSnapshot);

// Per-account activity: self, or managers/QA/CEO (checked in controller)
router.get('/:roleTable/:roleId', verifyToken, activityController.getActivityForAccount);

module.exports = router;
