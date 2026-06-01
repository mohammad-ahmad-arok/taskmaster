const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const verifyToken = require('../middlewares/auth');

router.post('/login', authController.login);
router.get('/me', verifyToken, authController.getCurrentUser);
router.post('/logout', verifyToken, authController.logout);

module.exports = router;
