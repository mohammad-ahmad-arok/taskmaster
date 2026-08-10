const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const verifyToken = require('../middlewares/auth');
const { requireRole } = require('../middlewares/rbac');

router.get('/getall', verifyToken, projectController.getProjects);
router.get('/getone/:id', verifyToken, projectController.getOneProject);
router.post('/addnew', verifyToken, requireRole('ceo', 'team_manager'), projectController.createProjects);

module.exports = router;
