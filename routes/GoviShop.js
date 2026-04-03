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

router.put(
  "/reneve-govi-shop-user/:id",
  authMiddleware,
  GoviShopEp.reneveGoviShopUser,
);

router.put(
  "/reject-govi-shop-user/:id",
  authMiddleware,
  GoviShopEp.rejectGoviShopUser,
);

router.delete(
  "/delete-govishop-supplier/:id",
  authMiddleware,
  GoviShopEp.deleteGoviShopSupplierEp
);

router.get(
  "/get-all-shops-by-owner",
  authMiddleware,
  GoviShopEp.getAllShopsByOwnerEp
);

router.get(
  "/get-supplier-by-id/:id",
  authMiddleware,
  GoviShopEp.getGoviShopSupplierById,
);

router.post(
  "/update-govi-shop-user",
  authMiddleware,
  GoviShopEp.updateGoviShopUser,
);

router.get(
  "/get-all-shop-requests",
  authMiddleware,
  GoviShopEp.getAllShopRequests
);

router.get(
  "/get-govi-shop-by-id/:id",
  authMiddleware,
  GoviShopEp.getGoviShopById,
);


router.post(
  "/update-govi-shop",
  authMiddleware,
  GoviShopEp.updateGoviShopUser,
);

router.get(
  "/get-shop-by-id/:id",
  authMiddleware,
  GoviShopEp.getGoviShopById,
);

router.get("/users", authMiddleware, GoviShopEp.getUsers);

module.exports = router;
