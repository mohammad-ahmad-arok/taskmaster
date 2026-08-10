const express = require('express');
const router = express.Router();
const templateController = require('../controllers/template.controller');
const verifyToken = require('../middlewares/auth');
const { requireRole } = require('../middlewares/rbac');

router.get('/getall', verifyToken, requireRole('ceo', 'team_manager'), templateController.listTemplates);
router.get('/getone/:id', verifyToken, requireRole('ceo', 'team_manager'), templateController.getTemplate);
router.post('/addnew', verifyToken, requireRole('ceo', 'team_manager'), templateController.createTemplate);
router.post('/apply', verifyToken, requireRole('ceo', 'team_manager'), templateController.createProjectFromTemplate);

module.exports = router;
