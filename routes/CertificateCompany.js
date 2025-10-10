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
  upload.single("tearmsFile"),
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
  upload.single("tearmsFile"),
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

module.exports = router;
