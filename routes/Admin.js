const express = require("express");

const AdminEp = require("../end-point/Admin-ep");
const bodyParser = require("body-parser");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const upload = require("../middlewares/uploadMiddleware");

const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");

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

router.post(
  "/create-plant-care-user",
  authMiddleware,
  upload.single("image"),
  AdminEp.createPlantCareUser
);

router.post("/login", AdminEp.loginAdmin);

router.get("/get-all-admin-users", authMiddleware, AdminEp.getAllAdminUsers);

router.delete(
  "/delete-admin-user/:id",
  authMiddleware,
  AdminEp.deleteAdminUser
);

router.post("/update-admin/:id", authMiddleware, AdminEp.editAdminUser);

router.get("/get-admin-by-id/:id", authMiddleware, AdminEp.getAdminById);

router.post("/create-admin", authMiddleware, AdminEp.createAdmin);

router.delete(
  "/delete-plant-care-user/:id",
  authMiddleware,
  AdminEp.deletePlantCareUser
);

router.post(
  "/edit-admin-user-without-id",
  authMiddleware,
  AdminEp.editAdminUserWithoutId
);

router.get("/get-me", authMiddleware, AdminEp.getMe);

router.post("/admin-create-user", authMiddleware, AdminEp.adminCreateUser);

router.get("/get-all-users", authMiddleware, AdminEp.getAllUsers);

// router.post('/admin-create-crop-cellender',
//     authMiddleware,
//     AdminEp.createCropCallender
// );

router.post(
  "/admin-create-ongoing-cultivations",
  authMiddleware,
  AdminEp.createOngoingCultivations
);

router.post(
  "/admin-create-news",
  authMiddleware,
  upload.single("image"),
  AdminEp.createNews
);

router.get("/get-all-contents", authMiddleware, AdminEp.getAllNews);

router.get("/get-news-by-id/:id", authMiddleware, AdminEp.getNewsById);

router.post("/edit-news-status/:id", authMiddleware, AdminEp.editNewsStatus);

router.post(
  "/admin-add-crop-calender-add-task",
  authMiddleware,

  AdminEp.createCropCalenderAddTask
);

router.get("/get-user-by-id/:id", AdminEp.getUserById);

router.get(
  "/get-cropcalender-by-id/:id",
  authMiddleware,
  AdminEp.getCropCalenderById
);

router.get("/get-all-market-price", authMiddleware, AdminEp.getAllMarketPrice);

router.delete(
  "/delete-market-price/:id",
  authMiddleware,
  AdminEp.deleteMarketPrice
);

router.post(
  "/edit-market-price-status/:id",
  authMiddleware,
  AdminEp.editMarketPriceStatus
);

router.post(
  "/admin-create-market-price",
  authMiddleware,
  upload.single("image"),
  AdminEp.createMarketPrice
);

router.get(
  "/get-market-price-by-id/:id",
  authMiddleware,
  AdminEp.getMarketPriceById
);

router.put(
  "/edit-market-price/:id",
  authMiddleware,
  upload.single("image"),
  AdminEp.editMarketPrice
);

router.get(
  "/get-all-ongoing-culivations",
  authMiddleware,
  AdminEp.getAllOngoingCultivations
);

router.get(
  "/get-ongoing-cultivation-by-id/:cultivationId/:userId",
  authMiddleware,
  AdminEp.getOngoingCultivationsById
);

router.put(
  "/update-plant-care-user/:id",
  authMiddleware,
  upload.single("image"),
  AdminEp.updatePlantCareUser
);

router.post(
  "/create-plantcare-user",
  authMiddleware,
  upload.single("image"),
  AdminEp.createPlantCareUser
);

router.get(
  "/get-fixed-assets/:id/:category/:farmId",
  authMiddleware,
  AdminEp.getFixedAssetsByCategory
);

router.get(
  "/get-fixed-assets/building-ownership/:buildingAssetId",
  authMiddleware,
  AdminEp.getBuildingOwnershipDetails
);
router.get(
  "/get-fixed-assets/land-ownership/:landAssetId",
  authMiddleware,
  AdminEp.getLandOwnershipDetails
);

router.get(
  "/get-current-assets-view/:id/:category/:farmId",
  authMiddleware,
  AdminEp.getCurrentAssetsByCategory
);

router.post(
  "/admin-change-password/",
  authMiddleware,
  AdminEp.editAdminUserPassword
);

//Report current assert --- get-assert-using-userid
router.get(
  "/get-current-assert/:id/:farmId",
  authMiddleware,
  AdminEp.getCurrentAssertGroup
);

router.get(
  "/get-current-asset-report/:id",
  authMiddleware,
  AdminEp.getCurrentAssetRecordById
);

//crop task delete function
router.delete(
  "/delete-crop-task/:id/:cropId/:indexId",
  authMiddleware,
  AdminEp.deleteCropTask
);

router.post("/edit-crop-task/:id", authMiddleware, AdminEp.editTask);

router.get(
  "/get-crop-task/:id",
  authMiddleware,
  AdminEp.getCropCalendarDayById
);

router.get(
  "/get-all-users-crop-task/:cropId/:userId",
  authMiddleware,
  AdminEp.getAllUsersTaskByCropId
);

router.delete(
  "/delete-user-task/:id/:cropId/:indexId/:userId",
  authMiddleware,
  AdminEp.deleteUserCropTask
);

router.post(
  "/edit-user-task-status/:id",
  authMiddleware,
  AdminEp.editUserTaskStatus
);

router.get(
  "/get-slave-crop-task/:id",
  authMiddleware,
  AdminEp.getSlaveCropCalendarDayById
);

router.post("/edit-user-crop-task/:id", authMiddleware, AdminEp.editUserTask);

router.get(
  "/get-post",
  // authMiddleware,
  AdminEp.getAllPostyById
);

router.post("/send-message/:chatId", authMiddleware, AdminEp.sendMessage);

//get each post reply
router.get(
  "/get-all-reply/:postId",
  // authMiddleware,
  AdminEp.getAllReplyByPost
);

router.get(
  "/get-count-reply",
  // authMiddleware,
  AdminEp.getReplyCountByChatId
);

router.delete(
  "/delete-reply/:postId",
  // authMiddleware,
  AdminEp.DeleteReply
);

router.delete(
  "/delete-post/:postId",
  // authMiddleware,
  AdminEp.DeletPublicForumPost
);

//Pasan tsk
router.post(
  "/add-new-task/:cropId/:indexId",
  authMiddleware,
  AdminEp.addNewTask
);

router.post(
  "/add-new-task-user/:cropId/:indexId/:userId/:onCulscropID",
  authMiddleware,
  AdminEp.addNewTaskU
);

router.post(
  "/upload-user-xlsx",
  // authMiddleware,
  uploadfile.single("file"),
  AdminEp.uploadUsersXLSX
);

router.get("/get-all-roles", authMiddleware, AdminEp.getAllRoles);

router.get("/get-all-position", authMiddleware, AdminEp.getAllPosition);

router.get(
  "/farmer-payments/:officerID",
  authMiddleware,
  AdminEp.getPaymentSlipReport
);

router.get(
  "/farmer-list-report/:id/:userId",
  // authMiddleware,
  AdminEp.getFarmerListReport
);

router.post("/create-feedback", authMiddleware, AdminEp.createFeedback);

router.get("/opt-out-feedbacks", AdminEp.getUserFeedbackDetails);

router.get(
  "/next-order-number",
  // authMiddleware,
  AdminEp.getNextOrderNumber
);

router.get(
  "/get-all-feedbacks",
  // authMiddleware,
  AdminEp.getAllfeedackList
);

router.put("/update-feedback-order", AdminEp.updateFeedbackOrder);

router.delete("/feedback/:id", authMiddleware, AdminEp.deleteFeedback);

router.get(
  "/get-all-feedbacks-for-bar-chart",
  authMiddleware,
  AdminEp.getAllfeedackListForBarChart
);

router.get("/plantcare-dashboard", authMiddleware, AdminEp.plantcareDashboard);

router.put(
  "/update-role-permission",
  authMiddleware,
  AdminEp.updateAdminRoleById
);

router.delete(
  "/ongoing-cultivations/:id",
  authMiddleware,
  AdminEp.deleteOngoingCultivationsById
);

router.get("/get-all-farmer-staff", authMiddleware, AdminEp.getFarmerStaff);

router.get("/get-farm-owner", authMiddleware, AdminEp.getFarmOwner);

router.put("/update-farm-owner/:id", authMiddleware, AdminEp.updateFarmOwner);

router.get("/get-all-farmer-farms", authMiddleware, AdminEp.getUserFarmDetails);

router.delete("/delete-farm", authMiddleware, AdminEp.deleteFarms);

router.get("/get-farms-by-user", authMiddleware, AdminEp.getFarmsByUser);

// Delete a farm by ID
router.delete("/delete-farm/:farmId", authMiddleware, AdminEp.deleteFarm);

// Forgot Password
router.post("/forgot-password", AdminEp.forgotPassword);

// Reset password
router.post("/reset-password", AdminEp.resetPassword);

// Reset password
router.post("/resend-reset-password", AdminEp.resendResetLink);

router.get("/get-all-companies", authMiddleware, AdminEp.getAllCompanies);

router.get("/get-all-manager-list", authMiddleware, AdminEp.getAllManagerList);

router.get("/get-last-emp-id/:role", authMiddleware, AdminEp.getForCreateId);

router.post(
  "/create-field-officer",
  authMiddleware,
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "nicFront", maxCount: 1 },
    { name: "nicBack", maxCount: 1 },
    { name: "passbook", maxCount: 1 },
    { name: "contract", maxCount: 1 },
  ]),
  AdminEp.createFieldOfficer
);

router.get(
  "/get-field-officer/:id",
  authMiddleware,
  AdminEp.getFieldOfficerById
);

router.delete(
  "/delete-field-officer/:id",
  authMiddleware,
  AdminEp.deleteFieldOfficer
);

router.put(
  "/update-field-officers/:id",
  authMiddleware,
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "nicFront", maxCount: 1 },
    { name: "nicBack", maxCount: 1 },
    { name: "passbook", maxCount: 1 },
    { name: "contract", maxCount: 1 },
  ]),
  AdminEp.updateFieldOfficer
);

router.delete(
  "/delete-farm-staff/:id",
  authMiddleware,
  AdminEp.deleteFarmStaff
);

router.get(
  "/field-officer-complains",
  authMiddleware,
  AdminEp.getAllFiealdofficerComplains
);

router.get(
  "/field-officer-complains-by-id/:id",
  authMiddleware,
  AdminEp.getFiealdOfficerComplainById
);

router.get(
  "/farmer-pension-details",
  authMiddleware,
  AdminEp.getFarmerPensionDetails
);

router.get(
  "/get-cultivation-for-pension/:id",
  authMiddleware,
  AdminEp.getCultivationForPension
);

module.exports = router;
