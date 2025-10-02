// Route to check for duplicate crop calendar

const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const cropCalendarEp = require('../end-point/CropCalendar-ep');
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
    "/crop-groups",
    authMiddleware,
    cropCalendarEp.allCropGroups
);


router.post(
    "/create-crop-group",
    authMiddleware,
    upload.single("image"),
    cropCalendarEp.createCropGroup
);

router.get(
    "/get-all-crop-groups",
    authMiddleware,
    cropCalendarEp.getAllCropGroups
);
router.post(
    "/check-duplicate-crop-calendar",
    authMiddleware,
    cropCalendarEp.checkDuplicateCropCalendar
);

router.delete(
    "/delete-crop-group/:id",
    authMiddleware,
    cropCalendarEp.deleteCropGroup
);


router.post(
    "/create-crop-variety",
    authMiddleware,
    upload.single("image"),
    cropCalendarEp.createCropVariety
);


router.get(
    "/crop-variety/:cropGroupId",
    authMiddleware,
    cropCalendarEp.allCropVariety
);


router.post(
    "/admin-add-crop-calender",
    authMiddleware,
    upload.single("image"),
    cropCalendarEp.createCropCallender
);


router.post(
    "/upload-xlsx/:id",
    authMiddleware,
    uploadfile.single("file"),
    cropCalendarEp.uploadXLSX
);


router.get(
    "/crop-variety-by-group/:cropGroupId",
    authMiddleware,
    cropCalendarEp.getAllVarietyByGroup
);


router.delete(
    "/delete-crop-variety/:id",
    authMiddleware,
    cropCalendarEp.deleteCropVariety
);


router.get(
    "/crop-group-by-id/:id",
    authMiddleware,
    cropCalendarEp.getGroupById
);

router.get(
    "/crop-variety-by-id/:id",
    authMiddleware,
    cropCalendarEp.getVarietyById
);

router.put(
    '/update-crop-group/:id/:name',
    authMiddleware,
    upload.single('image'),
    cropCalendarEp.updateGroup);

router.get(
    "/get-all-crop-calender",
    authMiddleware,
    cropCalendarEp.getAllCropCalender
);

router.put(
    '/update-crop-variety/:id',
    // authMiddleware,
    upload.single("image"),
    cropCalendarEp.updateCropVariety
)


router.put(
    "/edit-cropcalender/:id",
    authMiddleware,
    upload.single("image"), // Handle image upload (Multer)
    cropCalendarEp.editCropCalender
);

router.delete(
    "/delete-crop/:id",
    authMiddleware,
    cropCalendarEp.deleteCropCalender
);


router.get(
    "/get-all-crop-task/:id",
    authMiddleware,
    cropCalendarEp.getAllTaskByCropId
);


router.put(
    '/update-crop-variety/:id',
    authMiddleware,
    upload.single('image'),
    cropCalendarEp.updateVariety
);

router.get(
    "/get-crop-groups-for-filters", 
    authMiddleware, 
    cropCalendarEp.getCropGroupsForFilter
);

router.get(
    "/get-all-crop-groups-names-only",
    authMiddleware,
    cropCalendarEp.getAllCropGroupNamesOnly
);

module.exports = router;
