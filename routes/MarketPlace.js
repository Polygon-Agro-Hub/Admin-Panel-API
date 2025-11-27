const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const marketPlaceEp = require("../end-point/MarketPlace-ep");
const upload = require("../middlewares/uploadMiddleware");
const path = require("path");
const multer = require("multer");

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
  "/get-crop-category",
  // authMiddleware,
  marketPlaceEp.getAllCropCatogory
);

router.post(
  "/add-market-product",
  authMiddleware,
  marketPlaceEp.createMarketProduct
);

router.get("/get-market-items", marketPlaceEp.getMarketplaceItems);

router.delete(
  "/delete-product/:id",
  // authMiddleware,
  marketPlaceEp.deleteMarketplaceItem
);

router.post("/create-coupen", authMiddleware, marketPlaceEp.createCoupen);

router.post("/update-coupen", authMiddleware, marketPlaceEp.updateCoupen);

router.get("/get-all-coupen", authMiddleware, marketPlaceEp.getAllCoupen);

router.delete(
  "/delete-coupen/:id",
  authMiddleware,
  marketPlaceEp.deleteCoupenById
);

router.delete(
  "/delete-all-coupen",
  authMiddleware,
  marketPlaceEp.deleteAllCoupen
);

router.get(
  "/get-product-category",
  authMiddleware,
  marketPlaceEp.getAllProductCropCatogory
);

router.post(
  "/add-package",
  authMiddleware,
  upload.single("file"),
  marketPlaceEp.createPackage
);

router.get(
  "/get-product-by-id/:id",
  authMiddleware,
  marketPlaceEp.getProductById
);

router.patch(
  "/edit-market-product/:id",
  authMiddleware,
  marketPlaceEp.editMarketProduct
);

router.get(
  "/get-all-package-list",
  authMiddleware,
  marketPlaceEp.getAllMarketplacePackages
);

router.get(
  "/get-all-package-list-date",
  authMiddleware,
  marketPlaceEp.getMarketplacePackagesByDate
);

router.delete(
  "/delete-packages/:id",
  // authMiddleware,
  marketPlaceEp.deleteMarketplacePackages
);

router.patch(
  "/edit-market-packages/:id",
  authMiddleware,
  marketPlaceEp.updateMarketplacePackage
);

router.get(
  "/get-package-by-id/:id",
  authMiddleware,
  marketPlaceEp.getMarketplacePackageById
);

router.get(
  "/get-packagedetails-by-id/:id",
  authMiddleware,
  marketPlaceEp.getMarketplacePackageWithDetailsById
);

router.patch("/edit-product/:id", authMiddleware, marketPlaceEp.updatePackage);

router.get(
  "/next-reatil-banner-number",
  // authMiddleware,
  marketPlaceEp.getNextBannerIndexRetail
);

router.get(
  "/next-wholesale-banner-number",
  // authMiddleware,
  marketPlaceEp.getNextBannerIndexWholesale
);

router.post(
  "/upload-banner",
  authMiddleware,
  upload.single("image"),
  marketPlaceEp.uploadBanner
);

router.post(
  "/upload-banner-wholesale",
  authMiddleware,
  upload.single("image"),
  marketPlaceEp.uploadBannerWholesale
);

router.get(
  "/get-all-banners",
  // authMiddleware,
  marketPlaceEp.getAllBanners
);

router.get(
  "/get-all-banners-wholesale",
  // authMiddleware,
  marketPlaceEp.getAllBannersWholesale
);

router.put("/update-banner-order", marketPlaceEp.updateBannerOrder);

router.delete(
  "/delete-banner-retail/:id",
  authMiddleware,
  marketPlaceEp.deleteBannerRetail
);

router.delete(
  "/delete-banner-whole/:id",
  authMiddleware,
  marketPlaceEp.deleteBannerWhole
);

router.post(
  "/create-product-type",
  authMiddleware,
  marketPlaceEp.createProductType
);

router.get(
  "/view-all-product-type",
  authMiddleware,
  marketPlaceEp.viewProductType
);
router.get(
  "/marketplace-users",
  authMiddleware,
  marketPlaceEp.getMarketplaceUsers
);

router.delete(
  "/marketplace-dltusers/:userId",
  authMiddleware,
  marketPlaceEp.deleteMarketplaceUser
);
router.get("/get-product-type", authMiddleware, marketPlaceEp.getProductType);

router.post(
  "/edit-package/:id",
  authMiddleware,
  upload.single("image"),
  marketPlaceEp.editPackage
);

router.get(
  "/get-product-type-by-id/:id",
  authMiddleware,
  marketPlaceEp.getProductTypeById
);

router.patch(
  "/edit-product-type/:id",
  authMiddleware,
  marketPlaceEp.editProductType
);

router.delete(
  "/delete-product-type/:id",
  authMiddleware,
  marketPlaceEp.deleteProductType
);

router.get(
  "/get-all-retail-orders",
  authMiddleware,
  marketPlaceEp.getAllRetailOrders
);

router.get(
  "/get-all-delivery-charges",
  authMiddleware,
  marketPlaceEp.getAllDeliveryCharges
);

router.post(
  "/upload-delivery-charges",
  authMiddleware,
  upload.single("file"),
  marketPlaceEp.uploadDeliveryCharges
);

router.post(
  "/edit-delivery-charge/:id",
  authMiddleware,
  marketPlaceEp.editDeliveryCharge
);

router.get(
  "/check-package-name",
  authMiddleware,
  marketPlaceEp.checkPackageDisplayNameExists
);

router.get(
  "/get-all-retails-customers",
  authMiddleware,
  marketPlaceEp.getAllRetailCustomers
);

router.get(
  "/get-define-package-details/:id",
  authMiddleware,
  marketPlaceEp.getOrderDetailsById
);

router.get(
  "/get-marketplace-item/:id",
  authMiddleware,
  marketPlaceEp.getAllMarketplaceItems
);

router.post(
  "/create-package-with-items",
  authMiddleware,
  marketPlaceEp.createDefinePackageWithItems
);

router.get(
  "/get-all-wholesale-customers",
  authMiddleware,
  marketPlaceEp.getAllWholesaleCustomers
);

router.get(
  "/get-user-orders/:userId",
  authMiddleware,
  marketPlaceEp.getUserOrders
);

router.get("/get-coupen/:coupenId", authMiddleware, marketPlaceEp.getCoupen);

router.post("/update-coupen", authMiddleware, marketPlaceEp.updateCoupen);

router.get(
  "/invoice/:processOrderId",
  authMiddleware,
  marketPlaceEp.getInvoiceDetails
);

router.get(
  "/get-all-wholesale-orders",
  authMiddleware,
  marketPlaceEp.getAllWholesaleOrders
);

router.get(
  "/market-dashbord-details",
  authMiddleware,
  marketPlaceEp.marketDashbordDetails
);


router.get(
  "/get-marketplace-package-before-date/:id",
  authMiddleware,
  marketPlaceEp.getMarketplacePackageBeforeDate
);

router.patch(
  "/change-package-status",
  authMiddleware,
  marketPlaceEp.changePackageStatus
);

router.get(
  "/postinvoice/:processOrderId",
  authMiddleware,
  marketPlaceEp.getPostInvoiceDetails
);




module.exports = router;
