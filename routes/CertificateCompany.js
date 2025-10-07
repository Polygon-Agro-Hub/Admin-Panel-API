const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const certificateCompanyEp = require("../end-point/CertificateCompany-ep");
const multer = require("multer");
const router = express.Router();

// Multer setup for memory storage (in-memory buffer)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"), false);
  },
});


// Create new certificate company
router.post(
  "/company/", 
  authMiddleware, 
  certificateCompanyEp.createCertificateCompany
);

// Get all certificate companies
router.get(
  "/company/all",
  authMiddleware,
  certificateCompanyEp.getAllCertificateCompanies
);

// Get by ID
router.get(
  "/company/:id", 
  authMiddleware,
  certificateCompanyEp.getCertificateCompanyById
);

// Update
router.put(
  "/company/:id", 
  authMiddleware,
  certificateCompanyEp.updateCertificateCompany
);

// Delete company by ID
router.delete(
  "/company/:id",
  authMiddleware,
  certificateCompanyEp.deleteCertificateCompany
);

// Get all certificate companies 
router.get(
  "/company/all/names-only",
  authMiddleware,
  certificateCompanyEp.getAllCertificateCompaniesNamesAndIdOnly
);

// Create certificate
router.post(
  "/certificate/create",
  authMiddleware,
  upload.single("tearmsFile"),
  certificateCompanyEp.createCertificate
);

// Create questionnaire
router.post(
  "/questionnaire/create",
  authMiddleware,
  certificateCompanyEp.createQuestionnaire
);

//All certificates
router.get(
  "/certificates/all-certificates",
  authMiddleware,
  certificateCompanyEp.getAllCertificates
);

// Get list by certificate questionnaires
router.get(
  "/questionnaire/:certificateId",  
  authMiddleware,
  certificateCompanyEp.getQuestionnaireList
);

// Update questionnaire
router.put(
  "/questionnaire/:id",   
  authMiddleware,
  certificateCompanyEp.updateQuestionnaire
);

// Delete questionnaire
router.delete(
  "/questionnaire/:id",   
  authMiddleware,
  certificateCompanyEp.deleteQuestionnaire
);

module.exports = router;
