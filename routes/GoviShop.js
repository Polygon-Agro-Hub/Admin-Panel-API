const express = require("express");
const GoviShopEp = require("../end-point/GoviShop-ep");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();
const upload = require("../middlewares/uploadMiddleware");

router.get(
  "/view-govi-shop-users",
  authMiddleware,
  GoviShopEp.getAllGoviShopUsers,
);

router.delete(
  "/delete-govi-shop-user/:id",
  authMiddleware,
  GoviShopEp.deleteGoviShopUser,
);

router.post(
  "/create-govi-shop-user",
  authMiddleware,
  upload.fields([
    { name: "file", maxCount: 1 }
  ]),
  GoviShopEp.createGoviShopUser,
);

router.post(
  "/check-phone",
  authMiddleware,
  GoviShopEp.checkPhone,
);

router.post(
  "/send-otp",
  authMiddleware,
  GoviShopEp.sendOtp,
);

router.get(
  "/view-govi-shop-supplier/:id",
  authMiddleware,
  GoviShopEp.viewGoviShopSupplierById,
);

router.get(
  "/get-all-shop-view-action",
  authMiddleware,
  GoviShopEp.getAllShowViewActionEp,
);

router.get(
  "/govi-shop-view-document/:id",
  authMiddleware,
  GoviShopEp.goviShopViewDocumentById,
);

router.put(
  "/update-govi-shop-user-status/:id",
  authMiddleware,
  GoviShopEp.updateGoviShopUserStatus,
);

router.delete(
  "/delete-govishop-supplier/:id",
  authMiddleware,
  GoviShopEp.deleteGoviShopSupplierEp
);

module.exports = router;
