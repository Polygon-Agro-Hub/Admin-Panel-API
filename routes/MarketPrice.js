const express = require("express");
const MarketPriceEp = require("../end-point/MarketPrice-ep");
const bodyParser = require("body-parser");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const upload = require("../middlewares/uploadMiddleware");
const path = require("path");
const fs = require('fs');
const {plantcare} = require('../startup/database'); // Adjust this to your database connection
const XLSX = require('xlsx');



const uploadfile = multer({
    
    fileFilter: function (req, file, callback) {
        var ext = path.extname(file.originalname);
        if (ext !== ".xlsx" && ext !== ".xls") {
            return callback(new Error("Only Excel files are allowed"));
        }
        callback(null, true);
    },
});


const router = express.Router();

router.post(
    "/upload-market-price-xlsx",
    authMiddleware,
    uploadfile.single("file"),
    MarketPriceEp.createMarketPriceXLSX
);

router.get(
    "/get-all-market-xlsx",
     authMiddleware, 
     MarketPriceEp.getAllxlsxlist
    );

router.delete(
    "/delete-xl-file/:id",
    authMiddleware,
    MarketPriceEp.deleteXl
);

router.get('/download/:fileName', MarketPriceEp.downloadXLSXFile);

router.get(
    "/get-market-prices",
    authMiddleware,
    MarketPriceEp.getAllMarketPrice
)

router.get(
    "/get-all-crop-name",
    authMiddleware,
    MarketPriceEp.getAllCropName
)



const getCropVarietyData = () => {
    const sql = `
      SELECT 
        cropgroup.cropNameEnglish AS cropName,
        cropvariety.varietyNameEnglish AS varietyName,
        cropvariety.id AS varietyId
      FROM 
        cropvariety
      JOIN 
        cropgroup ON cropvariety.cropGroupId = cropgroup.id
      ORDER BY 
        cropgroup.cropNameEnglish ASC,
        cropvariety.varietyNameEnglish ASC
    `;
    return new Promise((resolve, reject) => {
      plantcare.query(sql, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  };



  router.get(
    "/get-market-prices-agroworld",
    authMiddleware,
    MarketPriceEp.getAllMarketPriceAgro
)
  
  // API to download the Excel file
  router.get('/download-crop-data', async (req, res) => {
    try {
      // Fetch data from the database
      const data = await getCropVarietyData();
  
      // Format data for Excel
      const formattedData = data.flatMap(item => [
        {
          'Crop Name': item.cropName,
          'Variety Name': item.varietyName,
          'Variety Id': item.varietyId,
          Grade: 'A',
          Price: '',
        },
        {
          'Crop Name': item.cropName,
          'Variety Name': item.varietyName,
          'Variety Id': item.varietyId,
          Grade: 'B',
          Price: '',
        },
        {
          'Crop Name': item.cropName,
          'Variety Name': item.varietyName,
          'Variety Id': item.varietyId,
          Grade: 'C',
          Price: '',
        },
      ]);
      
  
      // Create a worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
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

module.exports = router;