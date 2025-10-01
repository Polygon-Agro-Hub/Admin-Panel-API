const express = require("express");
const GoviLinkEp = require("../end-point/GoviLink-ep");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.post("/create-company", authMiddleware, GoviLinkEp.createCompany);

router.get("/get-company-by-id/:id", authMiddleware, GoviLinkEp.getCompanyById);

router.post(
  "/save-officer-service",
  authMiddleware,
  GoviLinkEp.saveOfficerService
);

router.get("/get-all-companies", authMiddleware, GoviLinkEp.getAllCompanies);

router.patch("/update-company/:id", authMiddleware, GoviLinkEp.updateCompany);
module.exports = router;
