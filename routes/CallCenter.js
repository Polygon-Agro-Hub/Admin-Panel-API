const express = require("express");
const CallCenterEP = require("../end-point/CallCenter-ep");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();
const asyncHandler = require("../middlewares/asyncHandler");


router.get(
    "/call-center-dashbord",
    authMiddleware,
    CallCenterEP.getCallCenterDashbord
);

router.get(
    "/trigger-officer-status",
    authMiddleware,
    CallCenterEP.triggerRejectOffficerCache
);

router.get("/header-banner", asyncHandler(CallCenterEP.getHeaderBanner));

module.exports = router;
