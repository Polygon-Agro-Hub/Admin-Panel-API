const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const financeController = require("../end-point/finance-ep");
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

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

router.get(
  "/get-all-farmer-payments",
  // authMiddleware,
  financeController.getALlFarmerPayments
);

router.post('/payment-history', authMiddleware, upload.single('file'), financeController.createPaymentHistory);
router.put('/payment-history/:id', authMiddleware, upload.single('file'),financeController.updatePaymentHistory);
router.get('/payment-history/:id', authMiddleware, financeController.getPaymentHistoryById);
router.get('/payment-history', authMiddleware, financeController.getAllPaymentHistory);
router.delete('/payment-history/:id', authMiddleware, financeController.deletePaymentHistory);

router.get(
  '/govicare-requests',
  authMiddleware,
  financeController.getAllInvestmentRequests
);

// Get single investment request by ID
router.get(
  '/govicare-requests/:id',
  authMiddleware,
  financeController.getInvestmentRequestById
);

router.get(
  "/get-all-published-projects",
  authMiddleware,
  financeController.getAllPublishedProjects
)


router.get('/officers', financeController.getOfficersByDistrictAndRoleForInvestment);
router.post('/assign-officer',authMiddleware,  financeController.assignOfficerToInvestmentRequest);

router.get('/rejected-investment-requests', authMiddleware, financeController.getAllRejectedInvestmentRequests);
router.get('/approved-govicare-requests', financeController.GetAllApprovedInvestmentRequests);
router.put('/govicare-requests/:id/publish',authMiddleware, financeController.UpdateInvestmentRequestPublishStatus);

module.exports = router;
