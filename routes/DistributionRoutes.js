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
  "/get-all-distribution-manager-names",
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
  upload.single("image"),
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
  "/get-all-assigning-cities",
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

module.exports = router;
