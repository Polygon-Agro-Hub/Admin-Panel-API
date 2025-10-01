const express = require('express');
const GoviLinkEp = require('../end-point/GoviLink-ep');
const authMiddleware = require('../middlewares/authMiddleware');
const multer = require('multer');
const upload = require("../middlewares/uploadMiddleware");


const router = express.Router();

router.post(
  "/create-company",
  authMiddleware,
  GoviLinkEp.createCompany
);

router.get(
  "/get-company-by-id/:id",
  // authMiddleware,
  GoviLinkEp.getCompanyById
);

router.post(
  "/save-officer-service",
  authMiddleware,
    GoviLinkEp.saveOfficerService
);

router.put("/update-officer-service/:id",  authMiddleware,
    GoviLinkEp.updateOfficerService);

router.get("/get-officer-service-by-id/:id", authMiddleware, GoviLinkEp.getOfficerServiceById);

module.exports = router;