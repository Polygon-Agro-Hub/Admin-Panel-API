const express = require("express");

const salesAgentDashEp = require("../end-point/salesAgentDash-ep");
const bodyParser = require("body-parser");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const upload = require("../middlewares/uploadMiddleware");

const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");

const router = express.Router();

const upload1 = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype);
    cb(ok ? null : new Error("Only .jpg, .png or .pdf files are allowed"), ok);
  },
});
 
// Turns multer errors (file too big / wrong type) into clean 400 responses
const uploadBrDocument = (req, res, next) => {
  upload1.single("brDocument")(req, res, (err) => {
    if (err) return res.status(400).json({ status: false, error: err.message });
    next();
  });
};
 

router.get(
    '/get-all-sales-agents',
    authMiddleware,
    salesAgentDashEp.getAllSalesAgents
)

router.post(
    '/save-target',
    authMiddleware,
    salesAgentDashEp.saveTarget
)

router.get(
  "/get-pending-wholesale-buyers",
  authMiddleware,
  salesAgentDashEp.getPendingWholesaleBuyers
);

router.get(
  "/get-onboarded-options",
  authMiddleware,
  salesAgentDashEp.getOnboardedOptions
);

router.post(
  "/onboard-wholesale-customer",
  uploadBrDocument,
  salesAgentDashEp.onboardWholesaleCustomer
);


module.exports = router;