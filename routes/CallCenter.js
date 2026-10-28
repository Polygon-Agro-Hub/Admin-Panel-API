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

router.get("/dashboard", asyncHandler(CallCenterEP.getCallCenterDashbord));
router.get("/ivr-live-calls", asyncHandler(CallCenterEP.getIvrLiveCalls));

router.get(
    "/ivr/call-summary",
    authMiddleware,
    asyncHandler(CallCenterEP.getIvrCallSummary)
);

module.exports = router;
