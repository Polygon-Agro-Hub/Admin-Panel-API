const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const financeController = require("../end-point/finance-ep");

router.get("/dashboard", financeController.getDashboardData);
router.get("/package-payments", financeController.getAllPackagePayments);
router.get(
  "/certificate-dashboard",
  financeController.getCertificateDashboardData
);

// Get govi job dashboard data
router.get('/govi-job-dashboard-data', financeController.getGovijobDashboardData);

router.get('/service-payments', financeController.getAllServicePayments);
router.get('/certificate-payments', financeController.getAllCertificatePayments);

// Get all agent commission
router.get(
  "/get-all-agent-commissions",
  authMiddleware,
  financeController.getAllAgentCommissions
);

// Get agent commission by ID
router.get(
  "/get-agent-commission/:id",
  authMiddleware,
  financeController.getAgentCommissionById
);

// Create new agent commission
router.post(
  "/create-agent-commission",
  authMiddleware,
  financeController.createAgentCommission
);

// Update agent commission
router.put(
  "/update-agent-commission/:id",
  authMiddleware,
  financeController.updateAgentCommission
);

// Delete agent commission
router.delete(
  "/delete-agent-commission/:id",
  authMiddleware,
  financeController.deleteAgentCommission
);

module.exports = router;
