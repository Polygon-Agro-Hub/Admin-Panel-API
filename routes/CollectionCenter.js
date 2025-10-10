const express = require("express");
const db = require("../startup/database");
const bodyParser = require("body-parser");
const authMiddleware = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");
const path = require("path");
const CollectionCenterEp = require("../end-point/CollectionCenter-ep");

const router = express.Router();

router.post(
  "/add-collection-center",
  authMiddleware,
  CollectionCenterEp.addNewCollectionCenter
);

router.get(
  "/get-all-center",
  authMiddleware,
  CollectionCenterEp.getAllCollectionCenter
);

router.get(
  "/get-all-center-by-company/:companyId",
  authMiddleware,
  CollectionCenterEp.getAllCollectionCenterByCompany
);

//delete collection centre
router.delete(
  "/delete-collection-center/:id",
  authMiddleware,
  CollectionCenterEp.deleteCollectionCenter
);

//get all complains
router.get(
  "/get-all-complains",
  authMiddleware,
  CollectionCenterEp.getAllComplains
);

router.get(
  "/get-all-center-complains",
  authMiddleware,
  CollectionCenterEp.getAllCenterComplains
);

router.get(
  "/get-complain-by-id/:id",
  authMiddleware,
  CollectionCenterEp.getComplainById
);

router.get(
  "/get-center-complain-by-id/:id",
  authMiddleware,
  CollectionCenterEp.getCenterComplainById
);

router.post(
  "/create-collection-center",
  authMiddleware,
  CollectionCenterEp.createCollectionCenter
);

router.get(
  "/get-all-centerpage",
  authMiddleware,
  CollectionCenterEp.getAllCollectionCenterPage
);

router.get(
  "/get-center-by-id/:id",
  authMiddleware,
  CollectionCenterEp.getCenterById
);

router.patch(
  "/update-center/:id",
  authMiddleware,
  CollectionCenterEp.updateCollectionCenter
);

router.put(
  "/reply-complain/:id/",
  authMiddleware,
  CollectionCenterEp.sendComplainReply
);

router.put(
  "/reply-center-complain/:id/",
  authMiddleware,
  CollectionCenterEp.sendCenterComplainReply
);

router.get(
  "/get-last-emp-id/:role",
  authMiddleware,
  CollectionCenterEp.getForCreateId
);

router.post(
  "/create-company",
  authMiddleware,
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
  ]),
  CollectionCenterEp.createCompany
);

router.get(
  "/get-all-company",
  // authMiddleware,
  CollectionCenterEp.getAllCompanies
);

router.get(
  "/get-all-company-list",
  authMiddleware,
  CollectionCenterEp.getAllCompanyList
);

router.get(
  "/get-all-manager-list/:companyId/:centerId",
  authMiddleware,
  CollectionCenterEp.getAllManagerList
);

router.post("/generate-regcode", CollectionCenterEp.generateRegCode);

router.patch(
  "/update-company/:id",
  // authMiddleware,
  CollectionCenterEp.updateCompany
);

router.get(
  "/get-company-by-id/:id",
  // authMiddleware,
  CollectionCenterEp.getCompanyById
);

router.delete(
  "/delete-company/:id",
  // authMiddleware,
  CollectionCenterEp.deleteCompany
);

router.get(
  "/get-center-dashboard/:id",
  authMiddleware,
  CollectionCenterEp.getCenterDashbord
);

router.get(
  "/get-crop-category",
  authMiddleware,
  CollectionCenterEp.getAllCropCatogory
);

router.post(
  "/create-daily-target",
  authMiddleware,
  CollectionCenterEp.addDailyTarget
);

router.get(
  "/get-company-head",
  authMiddleware,
  CollectionCenterEp.getCompanyHead
);

router.delete(
  "/delete-company-head/:id",
  authMiddleware,
  CollectionCenterEp.deleteCompanyHead
);

router.get(
  "/get-all-complain-category-list/:roleId/:appId",
  authMiddleware,
  CollectionCenterEp.GetComplainCategoriesByRole
);

router.get(
  "/get-all-complain-category-list-super/:appId",
  authMiddleware,
  CollectionCenterEp.GetComplainCategoriesByRoleSuper
);

router.get(
  "/get-all-comppany-for-officer-complain",
  authMiddleware,
  CollectionCenterEp.GetAllCompanyForOfficerComplain
);

router.get(
  "/get-all-centerpage-aw",
  authMiddleware,
  CollectionCenterEp.getAllCollectionCenterPageAW
);

router.get(
  "/check-company-name",
  authMiddleware,
  CollectionCenterEp.checkCompanyDisplayNameDao
);

router.get(
  "/get-all-center-payments",
  authMiddleware,
  CollectionCenterEp.getAllCenterPayments
);

router.get(
  "/download-center-payment-report",
  authMiddleware,
  CollectionCenterEp.downloadAllCenterPayments
);

router.get(
  "/get-center-target",
  authMiddleware,
  CollectionCenterEp.getCenterTarget
)

router.get(
  "/download-current-target-report",
  authMiddleware,
  CollectionCenterEp.downloadCurrentTarget
)

module.exports = router;
