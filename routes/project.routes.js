const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const verifyToken = require('../middlewares/auth');

router.get('/getall', verifyToken, projectController.getProjects);
router.get('/getone/:id', verifyToken, projectController.getOneProject);
router.post('/addnew', verifyToken, projectController.createProjects);

module.exports = router;
