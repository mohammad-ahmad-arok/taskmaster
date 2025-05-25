const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const verifyToken = require('../middlewares/auth');

router.get('/getall', verifyToken, employeeController.getAllEmployee);
router.get('/getone/:id', verifyToken, employeeController.getOneEmployee);
router.post('/addnew', verifyToken, employeeController.addEmployee);
router.delete('/delete/:id', verifyToken, employeeController.deleteemployee);

module.exports = router;
