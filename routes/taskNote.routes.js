const express = require('express');
const router = express.Router();
const taskNoteController = require('../controllers/taskNote.controller');
const verifyToken = require('../middlewares/auth');
const upload = require('../utils/upload');

router.get('/getall', verifyToken, taskNoteController.getTaskNotes);
// 'attachment' is the multipart field name the frontend uses for file uploads.
router.post('/addnew', verifyToken, upload.single('attachment'), taskNoteController.createTaskNote);

module.exports = router;
