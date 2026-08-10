const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const verifyToken = require('../middlewares/auth');
const { requireRole } = require('../middlewares/rbac');

router.get('/getall', verifyToken, requireRole('ceo', 'team_manager', 'qa'), taskController.getTasks);
router.get('/getmytasks', verifyToken, requireRole('employee'), taskController.getMyTasks);
router.get('/getone/:id', verifyToken, taskController.getOneTask);
router.post('/addnew', verifyToken, requireRole('ceo', 'team_manager'), taskController.createTack);
router.put('/:id/status', verifyToken, taskController.updateTaskStatus);
router.put('/:id/review', verifyToken, requireRole('ceo', 'team_manager', 'qa'), taskController.reviewTask);

// Timer (Financial Module input)
router.post('/:id/timer/start', verifyToken, taskController.startTimer);
router.post('/:id/timer/pause', verifyToken, taskController.pauseTimer);
router.post('/:id/timer/stop', verifyToken, taskController.stopTimer);

router.put('/:taskId/extension-request/:requestId', verifyToken, requireRole('ceo', 'team_manager'), taskController.updateExtensionRequestStatus);
router.post('/:id/extension-request', verifyToken, requireRole('employee'), taskController.addExtensionRequest);
router.delete('/delete/:id', verifyToken, requireRole('ceo', 'team_manager'), taskController.deleteTask);

module.exports = router;
