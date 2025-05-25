const express = require('express');
const router = express.Router();
const taskNoteController = require('../controllers/taskNote.controller');
const verifyToken = require('../middlewares/auth');

router.get('/getall', verifyToken, taskNoteController.getTaskNotes);
router.post('/addnew', verifyToken, taskNoteController.createTaskNote);

module.exports = router;
