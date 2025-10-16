const express = require("express");

const StakeholderEp = require("../end-point/stakeholder-ep");
const bodyParser = require("body-parser");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const upload = require("../middlewares/uploadMiddleware");

const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");

const router = express.Router();

router.get(
    "/get-admin-user-data",
    authMiddleware,
    StakeholderEp.getAdminUserData
);

// ✅ Get all field officers
router.get(
  "/get-all-field-officers",
  authMiddleware,
  StakeholderEp.getAllFieldOfficers
);

// Update status and send password field officers
router.put(
  "/update-status-send-password/:id/:status",
  StakeholderEp.UpdateStatusAndSendPassword
);


module.exports = router;