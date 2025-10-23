const express = require('express');
const router = express.Router();
const financeController = require('../end-point/finance-ep');

router.get('/dashboard', financeController.getDashboardData);
router.get('/package-payments', financeController.getAllPackagePayments);
router.get('/certificate-dashboard', financeController.getCertificateDashboardData);

// Get govi job dashboard data
router.get('/govi-job-dashboard-data', financeController.getGovijobDashboardData);
router.get('/certificate-payments', financeController.getAllCertificatePayments);

module.exports = router;