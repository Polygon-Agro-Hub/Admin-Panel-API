const express = require("express");
const db = require("../startup/database");
const CollectionOfficerEp = require("../end-point/CollectionOfficer-ep");
const bodyParser = require("body-parser");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const upload = require("../middlewares/uploadMiddleware");
const collectionofficerDao = require("../dao/CollectionOfficer-dao");
const XLSX = require('xlsx');
const fs = require('fs');

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

router.post(
  "/collection-officer/create-collection-officer",
  authMiddleware,
  upload.single("image"),
  CollectionOfficerEp.createCollectionOfficer
);



router.get(
  "/collection-officer/get-all-collection-officers",
  authMiddleware,
  CollectionOfficerEp.getAllCollectionOfficers
);

router.get(
  "/collection-officer/get-all-collection-officers-status",
  authMiddleware,
  CollectionOfficerEp.getAllCollectionOfficersStatus
);

router.get(
  "/collection-officer/get-collection-officer-report/:id/:date",
  // authMiddleware,
  CollectionOfficerEp.getCollectionOfficerReports
);

router.get(
  "/collection-officer/district-report/:district",
  authMiddleware,
  CollectionOfficerEp.getCollectionOfficerDistrictReports
);

//province report
router.get(
  "/collection-officer/province-report/:province",
  authMiddleware,
  CollectionOfficerEp.getCollectionOfficerProvinceReports
);

router.get(
  "/collection-officer/get-all-company-names",
  authMiddleware,
  CollectionOfficerEp.getAllCompanyNames
);

router.get(
  "/collection-officer/update-status/:id/:status",
  authMiddleware,
  CollectionOfficerEp.UpdateStatusAndSendPassword
);

router.delete(
  "/collection-officer/delete-officer/:id",
  authMiddleware,
  CollectionOfficerEp.deleteCollectionOfficer
);

router.get(
  "/collection-officer-by-id/:id",
  authMiddleware,
  CollectionOfficerEp.getOfficerById
);

router.put(
  "/update-officer-details/:id",
  authMiddleware,
  upload.single("image"),
  CollectionOfficerEp.updateCollectionOfficerDetails
);

router.get(
  "/officer-details-monthly/:id",
  // authMiddleware,
  CollectionOfficerEp.getOfficerByIdMonthly
);

// Define the new route to fetch daily data for a specific collection officer
router.get(
  "/get-daily-report",
  // authMiddleware,
  CollectionOfficerEp.getDailyReport
);

router.get(
  "/collection-officer/get-collection-officer/:id",
  authMiddleware,
  CollectionOfficerEp.getCollectionOfficerById
);

router.put(
  "/disclaim-officer/:id",
  authMiddleware,
  CollectionOfficerEp.disclaimOfficer
);

router.put(
  "/claim-officer/:id",
  authMiddleware,
  CollectionOfficerEp.claimOfficer
)

router.post(
  "/collection-officer/create-center-head",
  authMiddleware,
  upload.single("image"),
  CollectionOfficerEp.createCenterHead
);

router.put(
  "/update-center-head-details/:id",
  authMiddleware,
  upload.single("image"),
  CollectionOfficerEp.updateCenterHeadDetails
);

router.get(
  "/collection-officer/get-all-center-names",
  authMiddleware,
  CollectionOfficerEp.getAllCenterNames
);

router.get(
  "/collection-officer/get-all-collection-manager-names/:centerId",
  authMiddleware,
  CollectionOfficerEp.getAllCollectionManagerNames
);





router.get(
  "/get-purchase-report",
  authMiddleware,
  CollectionOfficerEp.getPurchaseReport
);

router.get(
  "/get-centers-for-purchase-report",
  // authMiddleware,
  CollectionOfficerEp.getAllCentersForPurchaseReport
);






router.get('/download-purchase-report', async (req, res) => {
  try {

    const { centerId, startDate, endDate, search } = req.query;
    // Fetch data from the database
    const data = await collectionofficerDao.downloadPurchaseReport(
      centerId,
      startDate,
      endDate,
      search);

    // Format data for Excel
    const formattedData = data.flatMap(item => [
      {
        'GRN': item.grnNumber,
        'Amount': item.amount,
        'Centre Reg Code': item.regCode,
        'Centre Name': item.centerName,
        'Farmer NIC': item.nic,
        'Farmer Name': item.firstName + ' ' + item.lastName,
        'Farmer contact': item.phoneNumber,
        'Account holder name': item.accHolderName,
        'Account Number': item.accNumber,
        'Bank Name': item.bankName,
        'Branch Name': item.branchName,
        'Officer EMP ID': item.empId,
        'Collected time': item.createdAt,
        'Collected Date': item.createdDate

      },

    ]);


    // Create a worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    worksheet['!cols'] = [
      { wch: 25 }, // GRN
      { wch: 15 }, // Amount
      { wch: 20 }, // Center Reg Code
      { wch: 25 }, // Center Name
      { wch: 18 }, // Farmer NIC
      { wch: 25 }, // Farmer Name
      { wch: 15 }, // Farmer Contact
      { wch: 25 }, // Account Holder Name
      { wch: 20 }, // Account Number
      { wch: 20 }, // Bank Name
      { wch: 20 }, // Branch Name
      { wch: 15 }, // Officer EMP ID
      { wch: 15 },  // Collected Time
      { wch: 15 }  // Collected Time
    ];


    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Market Price Template');

    // Write the workbook to a buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Disposition', 'attachment; filename="Market Price Template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Send the file to the client
    res.send(excelBuffer);
  } catch (err) {
    console.error('Error generating Excel file:', err);
    res.status(500).send('An error occurred while generating the file.');
  }
});




router.get(
  "/get-collection-report",
  // authMiddleware,
  CollectionOfficerEp.getCollectionReport
);

router.get('/download-collection-report', async (req, res) => {
  try {

    const { centerId, startDate, endDate, search } = req.query;
    // Fetch data from the database
    const data = await collectionofficerDao.downloadCollectionReport(
      centerId,
      startDate,
      endDate,
      search);

    // Format data for Excel
    const formattedData = data.flatMap(item => [
      {
        'Reg Code': item.regCode,
        'Centre Name': item.centerName,
        'Crop Name': item.cropGroupName,
        'Variety Name': item.varietyName,
        'Grade A (Kg)': item.gradeAquan,
        'Grade B (Kg)': item.gradeBquan,
        'Grade C (Kg)': item.gradeCquan,
        'Total (Kg)': item.amount
      },

    ]);


    // Create a worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    worksheet['!cols'] = [
      { wch: 25 }, // regCode
      { wch: 15 }, // centerName
      { wch: 20 }, // cropGroupName
      { wch: 25 }, // varietyName
      { wch: 18 }, // gradeAquan
      { wch: 25 }, // gradeBquan
      { wch: 15 }, // gradeCquan
      { wch: 25 }, // amount
    ];


    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Market Price Template');

    // Write the workbook to a buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Disposition', 'attachment; filename="Market Price Template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Send the file to the client
    res.send(excelBuffer);
  } catch (err) {
    console.error('Error generating Excel file:', err);
    res.status(500).send('An error occurred while generating the file.');
  }
});


router.get(
  "/get-farmer-report-invoice-details/:invNo",
  authMiddleware,
  CollectionOfficerEp.getFarmerReportInvoice
)

router.get(
  "/collection-officer/centers",
  authMiddleware,
  CollectionOfficerEp.getCollectionCenterForReport
)

router.get(
  "/driver/view-all-drivers",
  authMiddleware,
  CollectionOfficerEp.getAllDrivers
);

router.get(
  "/driver/get-all-distribution-center-names",
  authMiddleware,
  CollectionOfficerEp.getAllDistributionCenterNames
);

//distribution manager list for claim
router.get(
  "/driver/get-all-distribution-manager-names/:centerId",
  authMiddleware,
  CollectionOfficerEp.getAllDistributionManagerNames
);

router.put(
  "/driver/claim-driver/:id",
  authMiddleware,
  CollectionOfficerEp.claimDriver
)

router.put(
  "/driver/disclaim-driver/:id",
  authMiddleware,
  CollectionOfficerEp.disclaimDriver
);
module.exports = router;
