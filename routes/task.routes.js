const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const verifyToken = require('../middlewares/auth');

router.get('/getall', verifyToken, taskController.getTasks);
router.get('/getmytasks', verifyToken, taskController.getMyTasks);
router.get('/getone/:id', verifyToken, taskController.getOneTask);
router.post('/addnew', verifyToken, taskController.createTack);
router.put('/:id/status', verifyToken, taskController.updateTaskStatus);
router.put('/:taskId/extension-request/:requestId', verifyToken, taskController.updateExtensionRequestStatus);
router.post('/:id/extension-request', verifyToken, taskController.addExtensionRequest);
router.delete('/delete/:id', verifyToken, taskController.deleteTask);

module.exports = router;
