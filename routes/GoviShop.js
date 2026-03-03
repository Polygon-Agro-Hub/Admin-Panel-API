const express = require("express");
const GoviShopEp = require("../end-point/GoviShop-ep");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

// router.post(
//   "/example",
//   authMiddleware,
//   GoviShopEp.example
// );

router.get(
  "/view-govi-shop-supplier/:id",
  authMiddleware,
  GoviShopEp.viewGoviShopSupplierById,
);

module.exports = router;
