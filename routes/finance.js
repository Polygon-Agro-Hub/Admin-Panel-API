const express = require('express');
const router = express.Router();
const financeController = require('../end-point/finance-ep');

router.get('/dashboard', financeController.getDashboardData);
router.get('/package-payments', financeController.getAllPackagePayments);

// Get govi job dashboard data
router.get('/govi-job-dashboard-data', financeController.getGovijobDashboardData);

module.exports = router;