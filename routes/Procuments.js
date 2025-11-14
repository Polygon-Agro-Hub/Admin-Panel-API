const express = require("express");
const ProcumentsEP = require("../end-point/Procuments-ep");
const bodyParser = require("body-parser");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const upload = require("../middlewares/uploadMiddleware");
const procumentDao = require("../dao/Procuments-dao");

const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const router = express.Router();

router.get(
  "/get-received-orders",
  authMiddleware,
  ProcumentsEP.getRecievedOrdersQuantity
);

router.get(
  "/get-distribution-orders",
  authMiddleware,
  ProcumentsEP.getDistributionOrdersEp
);

router.get("/get-all-distribution-centers", authMiddleware,ProcumentsEP.getAllDistributionCenters);

router.get(
  "/orders-process-info",
  authMiddleware,
  ProcumentsEP.getAllOrdersWithProcessInfo
);

router.get("/download-order-quantity-report", async (req, res) => {
  try {
    const { filterType, date, search } = req.query;
    console.log(filterType, date, search);

    // Fetch data from the database
    const data = await procumentDao.DownloadRecievedOrdersQuantity(
      filterType,
      date,
      search
    );
    const { items } = data;

    // Format data for Excel
    const formattedData = items.map((item) => ({
      "Crop Group": item.cropNameEnglish,
      Variety: item.varietyNameEnglish,
      "Total Quantity (Kg)": item.quantity,
      "Order Date": item.createdAt,
      "Schedule Date": item.scheduleDate,
      "To Collection Centre": item.toCollectionCenter,
      "To Dispatch Centre": item.toDispatchCenter,
    }));

    // Create worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 25 },
      { wch: 25 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Order Quantity Report");

    // Write to buffer
    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    // Set headers for download
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Order_Quantity_Report.xlsx"'
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Send file
    res.send(excelBuffer);
  } catch (err) {
    console.error("Error generating Excel file:", err);
    res.status(500).send("An error occurred while generating the file.");
  }
});

router.get("/get-prduct-type", authMiddleware, ProcumentsEP.getAllProductTypes);

router.get(
  "/get-order-details/:id",
  authMiddleware,
  ProcumentsEP.getOrderDetailsById
);

router.post(
  "/add-order-package-item",
  authMiddleware,
  ProcumentsEP.createOrderPackageItem
);

router.get(
  "/get-marketplace-item/:id",
  authMiddleware,
  ProcumentsEP.getAllMarketplaceItems
);

router.get(
  "/orders-process-info-completed",
  authMiddleware,
  ProcumentsEP.getAllOrdersWithProcessInfoCompleted
);

router.put(
  "/update-order-package-status",
  authMiddleware,
  ProcumentsEP.updateOrderPackagePackingStatus
);

router.get("/order-packages/:orderId", ProcumentsEP.getOrderPackageItemsById);

router.put("/update-order-package-items", ProcumentsEP.updateOrderPackageItems);

router.get(
  "/orders-process-info-dispatched",
  authMiddleware,
  ProcumentsEP.getAllOrdersWithProcessInfoDispatched
);

router.post(
  "/update-define-package-data",
  authMiddleware,
  ProcumentsEP.updateDefinePackageData
);

router.get(
  "/get-excluded-items/:orderId",
  authMiddleware,
  ProcumentsEP.getExcludedItems
);

router.get(
  "/test-func",
  ProcumentsEP.testFunc
);

module.exports = router;
