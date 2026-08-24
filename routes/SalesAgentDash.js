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

module.exports = router;