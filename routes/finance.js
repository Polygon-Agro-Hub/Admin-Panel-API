const express = require('express');
const router = express.Router();
const financeController = require('../end-point/finance-ep');

router.get('/dashboard', financeController.getDashboardData);
router.get('/package-payments', financeController.getAllPackagePayments);
router.get('/certificate-dashboard', financeController.getCertificateDashboardData);

module.exports = router;