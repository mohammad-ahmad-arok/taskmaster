const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const verifyToken = require('../middlewares/auth');
const { requireRole } = require('../middlewares/rbac');

router.get('/getall', verifyToken, requireRole('ceo', 'team_manager', 'qa'), employeeController.getAllEmployee);
router.get('/getone/:id', verifyToken, employeeController.getOneEmployee); // self-or-privileged check inside controller
router.post('/addnew', verifyToken, requireRole('ceo', 'team_manager'), employeeController.addEmployee);
router.delete('/delete/:id', verifyToken, requireRole('ceo', 'team_manager'), employeeController.deleteemployee);

module.exports = router;
