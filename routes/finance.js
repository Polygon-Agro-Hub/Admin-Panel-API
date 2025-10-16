const express = require('express');
const router = express.Router();
const financeController = require('../end-point/finance-ep');

router.get('/dashboard', financeController.getDashboardData);

module.exports = router;