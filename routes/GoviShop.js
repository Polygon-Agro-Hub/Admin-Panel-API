const express = require("express");
const GoviShopEp = require("../end-point/GoviShop-ep");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get(
  "/view-govi-shop-users",
  authMiddleware,
  GoviShopEp.getAllGoviShopUsers,
);

router.delete(
  "/delete-govi-shop-user/:id",
  authMiddleware,
  GoviShopEp.deleteGoviShopUser
);

module.exports = router;
