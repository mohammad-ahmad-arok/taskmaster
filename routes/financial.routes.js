const express = require('express');
const router = express.Router();
const financialController = require('../controllers/financial.controller');
const verifyToken = require('../middlewares/auth');
const { requireRole } = require('../middlewares/rbac');

// Everything in this router is CEO-only.
router.use(verifyToken, requireRole('ceo'));

router.get('/dashboard', financialController.getDashboard);
router.get('/project/:projectId', financialController.getProjectProfitability);
router.get('/employee-rates', financialController.getEmployeeCostRates);
router.put('/employee-rates/:employeeId', financialController.setEmployeeCostRate);

module.exports = router;
