const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const TargetEP = require("../end-point/Target-ep");

const router = express.Router();

router.get(
  "/get-saved-center-crops/:id",
  authMiddleware,
  TargetEP.getSavedCenterCrops
);

router.patch(
  "/update-target-crop-qty",
  authMiddleware,
  TargetEP.updateTargetQty
);

router.post(
  "/add-new-center-target",
  authMiddleware,
  TargetEP.addNewCenterTarget
);

router.get(
  "/get-center-crops/:id",
  authMiddleware,
  TargetEP.getCenterCenterCrops
);

router.post(
  "/add-center-crops",
  authMiddleware,
  TargetEP.addOrRemoveCenterCrops
);

router.get(
  '/get-selected-officer-target-data',
  authMiddleware,
  TargetEP.getSelectedOfficerTarget
)

module.exports = router;
