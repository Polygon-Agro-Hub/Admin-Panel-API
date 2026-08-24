const express = require("express");

const DashEp = require("../end-point/Dash-ep");

const db = require("../startup/database");
const bodyParser = require("body-parser");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const upload = require("../middlewares/uploadMiddleware");

const path = require("path");

const router = express.Router();

const uploadfile = multer({
  
  fileFilter: function (req, file, callback) {
    var ext = path.extname(file.originalname);
    if (ext !== ".xlsx" && ext !== ".xls") {
      return callback(new Error("Only Excel files are allowed"));
    }
    callback(null, true);
  },
});

router.get(
    "/get-all-customers",
    authMiddleware,
    DashEp.getAllCustomers
)

router.patch(
  '/update-dash-customer-rating/:id',
  authMiddleware,
  DashEp.updateDashCustomerRating,
);

router.get(
    "/get-all-sales-agents",
    authMiddleware,
    DashEp.getAllSalesAgents
)

router.delete(
    "/delete-sales-agent/:id", 
    authMiddleware, 
    DashEp.deleteSalesAgent
  );

router.get(
    "/get-last-sales-agent-id", 
    authMiddleware, 
    DashEp.getForCreateId
  );

router.post(
    "/create-sales-agent",
    authMiddleware,
    upload.single("image"),
    DashEp.createSalesAgent
);

router.get(
    "/get-sales-agent-details/:id",
    authMiddleware,
    DashEp.getSalesAgentDataById
  );

router.put(
    "/update-sales-agent-details/:id",
    authMiddleware,
    upload.single("image"),
    DashEp.updateSalesAgentDetails
);

router.get(
  "/update-status/:id/:status",
  authMiddleware,
  DashEp.UpdateStatusAndSendPassword
);

router.get(
  "/get-all-orders",
  authMiddleware,
  DashEp.getAllOrders
)

router.get(
  "/get-dash-user-orders/:userId",
  authMiddleware,
  DashEp.getDashUserOrders
);
module.exports = router;