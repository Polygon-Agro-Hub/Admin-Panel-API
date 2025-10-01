const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const certificateCompanyEp = require("../end-point/CertificateCompany-ep");

const router = express.Router();

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

module.exports = router;
