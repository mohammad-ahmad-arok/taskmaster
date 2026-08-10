const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const verifyToken = require('../middlewares/auth');
const { requireRole } = require('../middlewares/rbac');

router.get('/getall', verifyToken, requireRole('ceo', 'team_manager', 'qa'), userController.getUsers);
router.post('/addnew', verifyToken, requireRole('ceo', 'team_manager'), userController.createUser);
router.delete('/delete/:id', verifyToken, requireRole('ceo', 'team_manager'), userController.deleteUser);

module.exports = router;
