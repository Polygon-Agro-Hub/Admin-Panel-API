const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const certificateCompanyEp = require("../end-point/CertificateCompany-ep");
const multer = require("multer");
const router = express.Router();

// Multer setup for memory storage (in-memory buffer)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Only PDF and image files are allowed (jpg, png, webp)"),
        false
      );
    }
  },
});

// Create new certificate company
router.post(
  "/create-certificate-company",
  authMiddleware,
  upload.single("logo"),
  certificateCompanyEp.createCertificateCompany
);

// Get all certificate companies
router.get(
  "/get-all-certificate-companies",
  authMiddleware,
  certificateCompanyEp.getAllCertificateCompanies
);

// Get by ID
router.get(
  "/get-certificate-company-by-id/:id",
  authMiddleware,
  certificateCompanyEp.getCertificateCompanyById
);

// Update certificate company
router.put(
  "/update-certificate-company/:id",
  authMiddleware,
  upload.single("logo"),
  certificateCompanyEp.updateCertificateCompany
);

// Delete certificate company by ID
router.delete(
  "/delete-certificate-company/:id",
  authMiddleware,
  certificateCompanyEp.deleteCertificateCompany
);

// Get all certificate companies
router.get(
  "/get-all-certificate-companies-names-only",
  authMiddleware,
  certificateCompanyEp.getAllCertificateCompaniesNamesAndIdOnly
);

// Create certificate
router.post(
  "/create-certificate",
  authMiddleware,
  upload.fields([
    { name: "tearmsFile", maxCount: 1 },
    { name: "logo", maxCount: 1 },
  ]),
  certificateCompanyEp.createCertificate
);

// Get all certificates
router.get(
  "/get-all-certificates",
  authMiddleware,
  certificateCompanyEp.getAllCertificates
);

// Get certificate by ID
router.get(
  "/get-certificate-details/:id",
  authMiddleware,
  certificateCompanyEp.getCertificateDetailsById
);

// Update certificate
router.put(
  "/update-certificate/:id",
  authMiddleware,
  upload.fields([
    { name: "tearmsFile", maxCount: 1 },
    { name: "logo", maxCount: 1 },
  ]),
  certificateCompanyEp.updateCertificate
);

// Delete certificate
router.delete(
  "/delete-certificate/:id",
  authMiddleware,
  certificateCompanyEp.deleteCertificate
);

// Create questionnaire
router.post(
  "/create-questionnaire",
  authMiddleware,
  certificateCompanyEp.createQuestionnaire
);

// Get list by certificate questionnaires
router.get(
  "/get-qestionnaire-list/:certificateId",
  authMiddleware,
  certificateCompanyEp.getQuestionnaireList
);

// Update questionnaire
router.put(
  "/update-questionnaire/:id",
  authMiddleware,
  certificateCompanyEp.updateQuestionnaire
);

// Delete questionnaire
router.delete(
  "/delete-questionnaire/:id",
  authMiddleware,
  certificateCompanyEp.deleteQuestionnaire
);

// Create farmer cluster with bulk farmers
router.post(
  "/create-farmer-cluster",
  authMiddleware,
  certificateCompanyEp.createFarmerCluster
);

// Add single farmer to existing cluster
router.post(
  "/add-single-farmer-to-cluster/:clusterId",
  authMiddleware,
  certificateCompanyEp.addSingleFarmerToCluster
);

// Get all farmer clusters
router.get(
  "/get-farmer-clusters",
  authMiddleware,
  certificateCompanyEp.getAllFarmerClusters
);

// Delete a farmer cluster and all its associated farmers
router.delete(
  "/delete-farmer-cluster/:id",
  authMiddleware,
  certificateCompanyEp.deleteFarmerCluster
);

// Get users of a cluster
router.get(
  "/get-cluster-users/:clusterId",
  authMiddleware,
  certificateCompanyEp.getClusterUsers
);

// Delete specific user from cluster
router.delete(
  "/delete-farmer-clusters/:clusterId/users/:farmerId",
  authMiddleware,
  certificateCompanyEp.deleteClusterUser
);

// Update farmer cluster name
router.put(
  "/update-farmer-cluster/:clusterId",
  authMiddleware,
  certificateCompanyEp.updateFarmerCluster
);

// Get farmer cluster certificates (name and ID only)
router.get(
  "/get-farmer-cluster-certificates",
  authMiddleware,
  certificateCompanyEp.getFarmerClusterCertificates
);

// Update farmer cluster status
router.patch(
  "/update-cluster-status",
  authMiddleware,
  certificateCompanyEp.updateClusterStatus
);

// Get field audits
router.get(
  "/get-field-audits",
  authMiddleware,
  certificateCompanyEp.getFieldAudits
);

// Get crops by field audit id
router.get(
  '/crops-by-field-audit/:fieldAuditId', 
  authMiddleware, 
  certificateCompanyEp.getCropsByFieldAuditId
);

module.exports = router;
