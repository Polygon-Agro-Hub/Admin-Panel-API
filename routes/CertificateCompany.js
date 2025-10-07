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
router.post("/", 
  authMiddleware, 
  certificateCompanyEp.createCertificateCompany
);

// Get all certificate companies
router.get(
  "/all",
  authMiddleware,
  certificateCompanyEp.getAllCertificateCompanies
);

// Get by ID
router.get(
  "/:id", 
  authMiddleware,
  certificateCompanyEp.getCertificateCompanyById
);

// Update
router.put(
  "/:id", 
  authMiddleware,
  certificateCompanyEp.updateCertificateCompany
);

// Delete company by ID
router.delete(
  "/:id",
  authMiddleware,
  certificateCompanyEp.deleteCertificateCompany
);

// Get all certificate companies 
router.get(
  "/all/names-only",
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

module.exports = router;
