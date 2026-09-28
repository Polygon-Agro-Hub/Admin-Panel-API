const express = require("express");
const CallCenterEP = require("../end-point/CallCenter-ep");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();


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

module.exports = router;
