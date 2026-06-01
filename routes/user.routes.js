const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const verifyToken = require('../middlewares/auth');

router.get('/getall', userController.getUsers);
router.post('/addnew', verifyToken, userController.createUser);
router.delete('/delete/:id', verifyToken, userController.deleteUser);

module.exports = router;
