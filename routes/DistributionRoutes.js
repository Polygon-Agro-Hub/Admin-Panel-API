const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const distributionEp = require("../end-point/Distribution-ep");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.post(
  "/create-distribution-center",
  authMiddleware,
  distributionEp.createDistributionCenter
);

router.get(
  "/get-all-distribution-centre",
  authMiddleware,
  distributionEp.getAllDistributionCentre
);

router.get(
  "/get-all-companies",
  authMiddleware,
  distributionEp.getAllCompanies
);

router.get(
  "/get-companies",
  // authMiddleware,
  distributionEp.getCompanies
);

router.delete(
  "/delete-company/:id",
  // authMiddleware,
  distributionEp.deleteCompany
);

router.get(
  "/get-distributioncompany-head",
  authMiddleware,
  distributionEp.getAllDistributionCentreHead
);

router.post(
  "/create-distribution-head",
  authMiddleware,
  upload.single("image"),
  distributionEp.createDistributionHead
);

router.get(
  "/get-all-company-list",
  authMiddleware,
  distributionEp.getAllCompanyList
);

router.get(
  "/get-all-centers-by-company/:companyId",
  authMiddleware,
  distributionEp.getAllDistributedCentersByCompany
);

router.get("/get-company", authMiddleware, distributionEp.getCompany);

router.delete(
  "/delete-officer/:id",
  authMiddleware,
  distributionEp.deleteDistributionHead
);

router.get(
  "/get-distribution-head/:id",
  authMiddleware,
  distributionEp.getDistributionHeadDetailsById
);

router.put(
  "/update-collection-officer/:id",
  authMiddleware,
  distributionEp.updateCollectionOfficerDetails
);

router.get(
  "/get-distribution-centre/:id",
  authMiddleware,
  distributionEp.getDistributionCentreById
);

router.delete(
  "/delete-distributed-center/:id",
  authMiddleware,
  distributionEp.deleteDistributedCenter
);

router.put(
  "/update-distribution-centre/:id",
  authMiddleware,
  distributionEp.updateDistributionCentreDetails
);

router.delete(
  "/delete-distribution-centre/:id",
  authMiddleware,
  distributionEp.deleteDistributionCenter
);

router.post("/generate-regcode", distributionEp.generateRegCode);
router.get(
  "/check-name-exists",
  distributionEp.checkDistributionCenterNameExists
);

router.get(
  "/get-all-distribution-officers",
  authMiddleware,
  distributionEp.getAllDistributionOfficers
);

router.get(
  "/get-all-distributed-center-names",
  authMiddleware,
  distributionEp.getAllDistributedCenterNames
);

router.get(
  "/get-all-distribution-manager-names/:id",
  authMiddleware,
  distributionEp.getAllDistributionManagerNames
);

router.delete(
  "/delete-distribution-officer/:id",
  authMiddleware,
  distributionEp.deleteDistributionOfficer
);

router.get(
  "/update-status/:id/:status",
  authMiddleware,
  distributionEp.UpdateStatusAndSendPassword
);

router.get(
  "/get-all-company-names",
  authMiddleware,
  distributionEp.getAllCompanyNames
);

router.post(
  "/create-distribution-officer",
  authMiddleware,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "licFront", maxCount: 1 },
    { name: "licBack", maxCount: 1 },
    { name: "insFront", maxCount: 1 },
    { name: "insBack", maxCount: 1 },
    { name: "vehiFront", maxCount: 1 },
    { name: "vehiBack", maxCount: 1 },
    { name: "vehiSideA", maxCount: 1 },
    { name: "vehiSideB", maxCount: 1 },
  ]),
  distributionEp.createDistributionOfficer
);

router.get(
  "/get-all-distribution-center-by-company/:companyId",
  authMiddleware,
  distributionEp.getAllDistributionCenterByCompany
);

router.get(
  "/get-all-distribution-manager-list/:companyId/:centerId",
  authMiddleware,
  distributionEp.getAllDistributionManagerList
);

router.get(
  "/get-last-emp-id/:role",
  authMiddleware,
  distributionEp.getForCreateId
);

router.get(
  "/get-all-assigning-cities/:provine/:district",
  authMiddleware,
  distributionEp.getAllAssigningCities
);

router.post(
  "/assign-city-to-distributed-center",
  authMiddleware,
  distributionEp.assignCityToDistributedCcenter
);

router.post(
  "/remove-assign-city-to-distributed-center",
  authMiddleware,
  distributionEp.removeAssignCityToDistributedCcenter
);

router.get(
  "/get-center-target",
  authMiddleware,
  distributionEp.getDistributedCenterTarget
);

router.get(
  "/get-distribution-officers",
  authMiddleware,
  distributionEp.getDistributedCenterOfficers
);

router.get(
  "/get-center-out-for-dlvry-orders",
  authMiddleware,
  distributionEp.getDistributionOutForDlvrOrder
);

router.get(
  "/officer-details-monthly/:id",
  // authMiddleware,
  distributionEp.getOfficerByIdMonthly
);

router.put(
  "/update-distribution-officer-details/:id",
  authMiddleware,
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'licFront', maxCount: 1 },
    { name: 'licBack', maxCount: 1 },
    { name: 'insFront', maxCount: 1 },
    { name: 'insBack', maxCount: 1 },
    { name: 'vehiFront', maxCount: 1 },
    { name: 'vehiBack', maxCount: 1 },
    { name: 'vehiSideA', maxCount: 1 },
    { name: 'vehiSideB', maxCount: 1 }
  ]),
  distributionEp.updateDistributionOfficerDetails
);

router.get(
  "/officer-daily-distribution-target/:id/:date",
  authMiddleware,
  distributionEp.getOfficerDailyDistributionTarget
);

router.get(
  "/get-selected-officer-targets",
  authMiddleware,
  distributionEp.dcmGetSelectedOfficerTargets
);

router.patch(
  "/claim-distributed-Officer",
  authMiddleware,
  distributionEp.claimDistributedOfficer
);

router.get(
  "/get-officer-details/:id",
  // authMiddleware,
  distributionEp.getOfficerById
);

router.get(
  "/get-all-distribution-center-list/:companyId",
  authMiddleware,
  distributionEp.getAllDistributionCenterList
);

// Get all reasons
router.get(
  "/get-all-return-reasons",
  authMiddleware,
  distributionEp.getAllReasons
);

// Get reason by ID
router.get(
  "/get-return-reason/:id",
  authMiddleware,
  distributionEp.getReasonById
);

// Create new reason
router.post(
  "/create-return-reason",
  authMiddleware,
  distributionEp.createReason
);

// Delete reason
router.delete(
  "/delete-return-reason/:id",
  authMiddleware,
  distributionEp.deleteReason
);

// Update indexes after reordering
router.post(
  "/update-return-reason-indexes",
  authMiddleware,
  distributionEp.updateIndexes
);

// Get next available index
router.get(
  "/get-next-return-reason-index",
  authMiddleware,
  distributionEp.getNextIndex
);

//--hold reasons ---

router.get(
  "/get-all-hold-reasons",
  authMiddleware,
  distributionEp.getAllHoldReasons
);

// Get hold reason by ID
router.get(
  "/get-hold-reason/:id",
  authMiddleware,
  distributionEp.getHoldReasonById
);

// Create new hold reason
router.post(
  "/create-hold-reason",
  authMiddleware,
  distributionEp.createHoldReason
);

// Delete hold reason
router.delete(
  "/delete-hold-reason/:id",
  authMiddleware,
  distributionEp.deleteHoldReason
);

// Update indexes after reordering
router.post(
  "/update-hold-reason-indexes",
  authMiddleware,
  distributionEp.updateHoldReasonIndexes
);

// Get next available index
router.get(
  "/get-next-hold-reason-index",
  authMiddleware,
  distributionEp.getNextHoldReasonIndex
);

router.get(
  "/get-todays-deliveries",
  authMiddleware,
  distributionEp.getTodaysDeliverieData
);

router.get(
  "/get-targeted-customers-orders",
  authMiddleware,
  distributionEp.getTargetedCustomerOrders
);

module.exports = router;
