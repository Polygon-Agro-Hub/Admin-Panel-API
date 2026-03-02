const express = require("express");
const GoviShopEp = require("../end-point/GoviShop-ep");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

// router.post(
//   "/example",
//   authMiddleware,
//   GoviShopEp.example
// );

module.exports = router;
