const express = require("express");
const DispatchEP = require("../end-point/Dispatch-ep");
const bodyParser = require("body-parser");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const upload = require("../middlewares/uploadMiddleware");
const procumentDao = require("../dao/Procuments-dao");

const path = require("path");
const fs = require("fs");
const XLSX = require('xlsx');

const router = express.Router();







router.get(
    "/get-premade-packages",
    authMiddleware,
    DispatchEP.getPreMadePackages
  );


  router.get(
    "/get-selected-packages",
    authMiddleware,
    DispatchEP.getSelectedPackages
  );

  router.get(
    "/get-package-items",
    authMiddleware,
    DispatchEP.getPackageItems
  );

  router.post(
    "/update-package-data",
    authMiddleware,
    DispatchEP.updatePackageData
  );

  router.get(
    "/get-all-products",
    authMiddleware,
    DispatchEP.getAllProducts
  );

  router.post(
    "/replace-product-data",
    authMiddleware,
    DispatchEP.replaceProductData
  );

  router.post(
    "/update-additional-item-data",
    authMiddleware,
    DispatchEP.updateAdditionalItemData
  );

  router.get(
    "/get-custom-additional-items",
    authMiddleware,
    DispatchEP.getCustomAdditionalItems
  );


  router.get(
    "/get-Additional-items",
    authMiddleware,
    DispatchEP.getAdditionalItems
  );

  router.post(
    "/update-custom-additional-item-data",
    authMiddleware,
    DispatchEP.updateCustomAdditionalItemData
  );

  router.get(
    "/get-custom-pack-items/:id", 
    authMiddleware, 
    DispatchEP.getCustomOrderDetailsById
);


router.post(
    '/update-custom-pack-items', 
    authMiddleware,
    DispatchEP.updateCustomPackItems);


router.get(
    "/get-additional-pack-items/:id", 
    authMiddleware, 
    DispatchEP.getPackageOrderDetailsById
);


router.post(
  '/update-pack-additiona-items', 
  authMiddleware,
  DispatchEP.updatePackAdditionItems
);

router.get(
  '/marketplace-premade-package', 
  authMiddleware,
  DispatchEP.getMarketPlacePremadePackages
);

router.get(
  '/marketplace-premade-package-items/:id', 
  authMiddleware,
  DispatchEP.getMarketPlacePremadePackagesItems
);













module.exports = router;