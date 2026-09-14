const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const financeController = require("../end-point/finance-ep");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.get("/dashboard", financeController.getDashboardData);
router.get("/package-payments", financeController.getAllPackagePayments);
router.get(
  "/certificate-dashboard",
  financeController.getCertificateDashboardData
);

// Get govi job dashboard data
router.get(
  "/govi-job-dashboard-data",
  financeController.getGovijobDashboardData
);

router.get("/service-payments", financeController.getAllServicePayments);
router.get(
  "/certificate-payments",
  financeController.getAllCertificatePayments
);

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

router.post(
  "/payment-history",
  authMiddleware,
  upload.single("file"),
  financeController.createPaymentHistory
);
router.put(
  "/payment-history/:id",
  authMiddleware,
  upload.single("file"),
  financeController.updatePaymentHistory
);
router.get(
  "/payment-history/:id",
  authMiddleware,
  financeController.getPaymentHistoryById
);
router.get(
  "/payment-history",
  authMiddleware,
  financeController.getAllPaymentHistory
);
router.delete(
  "/payment-history/:id",
  authMiddleware,
  financeController.deletePaymentHistory
);

router.get(
  "/govicare-requests",
  authMiddleware,
  financeController.getAllInvestmentRequests
);

// Get single investment request by ID
router.get(
  "/govicare-requests/:id",
  authMiddleware,
  financeController.getInvestmentRequestById
);

router.get(
  "/get-all-published-projects",
  authMiddleware,
  financeController.getAllPublishedProjects
);

router.get(
  "/officers",
  financeController.getOfficersByDistrictAndRoleForInvestment
);
router.post(
  "/assign-officer",
  authMiddleware,
  financeController.assignOfficerToInvestmentRequest
);

router.get(
  "/rejected-investment-requests",
  authMiddleware,
  financeController.getAllRejectedInvestmentRequests
);

router.get(
  "/approved-govicare-requests",
  authMiddleware,
  financeController.GetAllApprovedInvestmentRequests
);

router.put(
  "/govicare-requests/:id/publish",
  authMiddleware,
  financeController.UpdateInvestmentRequestPublishStatus
);

router.get(
  "/project-investments",
  authMiddleware,
  financeController.GetProjectInvestment
);
router.get(
  "/get-all-investments",
  authMiddleware,
  financeController.getALlInvestments
);

router.put(
  '/approve-investment-status/:id',
  authMiddleware, 
  financeController.ApproveInvestmentRequestEp
);


router.put(
  '/reject-investment-status/:id',
  authMiddleware, 
  financeController.RejectInvestmentRequestEp
);

router.get(
  '/get-inspection-details/:id',
  // authMiddleware, 
  financeController.getInspectionDerailsEp
);

router.get(
  "/audited-govicare-requests",
  authMiddleware,
  financeController.GetAllAuditedInvestmentRequests
);

router.post(
  "/devide-shares",
  authMiddleware,
  financeController.devideSharesRequestEp
);

router.post(
  "/reject-request",
  authMiddleware,
  financeController.rejectRequestEp
);

router.patch(
  "/approve-request",
  authMiddleware,
  financeController.approveInvenstmentRequest
);

router.get(
  "/get-sales-agent-for-filter",
  authMiddleware,
  financeController.getSalesAgentForFilter
);

router.post(
  "/get-agent-commissions",
  authMiddleware,
  financeController.getAgentCommitions
);

router.get(
  "/pension-requests",
  authMiddleware,
  financeController.getAllPensionRequests
);

router.get(
  "/pension-request/:id",
  authMiddleware,
  financeController.getPensionRequestById
);

router.put(
  "/update-pension-request/:id",
  authMiddleware,
  financeController.updatePensionRequestStatus
);

router.get(
  "/get-cultivation-for-pension/:id",
  authMiddleware,
  financeController.getCultivationForPension
);

router.get(
  "/farmer-pension-details",
  authMiddleware,
  financeController.getFarmerPensionDetails
);

router.get(
  "/main-dashboard",
  authMiddleware,     
  financeController.getFinanceMainDashboard
);

router.get('/govicare-investment-users', authMiddleware, financeController.getGocicareAllInvestmentUsers);

router.get(
  "/get-all-transactions",
  authMiddleware,
  financeController.getAllTransactionsEp
);

router.get(
  "/get-all-transaction-orders/:id",
  authMiddleware,
  financeController.getAllTransactionOrdersEp,
);

router.get(
  "/view-transaction-document/:id",
  authMiddleware,
  financeController.getViewTransactionDocument
);

router.put(
  "/update-transaction-status/:id",
  authMiddleware,
  financeController.updateTransactionStatus
);

router.get("/get-all-shortage-submission",authMiddleware, financeController.getAllShortageSubmissionEp);
router.get("/view-submission-document/:id",authMiddleware, financeController.ViewSubmissionDocumentEp);
router.put("/update-submission-status/:id",authMiddleware, financeController.updateSubmissionStatusEp);
router.get("/get-all-cop-transactions", authMiddleware, financeController.getAllCOPTransactionsEp);
router.get("/pickup-handover-summary/:id", authMiddleware, financeController.getPickupHandOverSummaryEp);

router.get("/view-cop-transaction-document/:id",authMiddleware, financeController.viewCopTransactionDocumentEp);
router.put("/update-cop-transaction-status/:id",authMiddleware, financeController.updateCopTransactionStatusEp);

router.get(
  "/get-all-completed-orders", 
  authMiddleware, 
  financeController.getAllCompletedOrdersEp
);

router.get(
  '/download-completed-orders', 
  authMiddleware, 
  financeController.downloadCompletedOrders
);

module.exports = router;
