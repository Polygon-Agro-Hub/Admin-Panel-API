const marketPriceDao = require('../dao/MarketPrice-dao');
const xlsx = require('xlsx');
const path = require('path');
const ValidateSchema = require("../validations/Admin-validation");


exports.createMarketPriceXLSX = async (req, res) => {
  let xlindex = null;

  try {
    const { xlName } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const allowedExtensions = [".xlsx", ".xls"];
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({
        error: "Invalid file type. Only XLSX and XLS files are allowed.",
      });
    }

    const xlcount = await marketPriceDao.getAllxlsxlistCount();
    if (xlcount.total != 0) {
      return res.status(400).json({
        error: "There is an existing file. Please first delete that and try upload again",
      });
    }

    let workbook;
    try {
      if (req.file.buffer) {
        workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      } else if (req.file.path) {
        workbook = xlsx.readFile(req.file.path);
      } else {
        throw new Error("Neither file buffer nor path is available for reading.");
      }
    } catch (error) {
      console.error("Error reading XLSX file:", error);
      return res.status(400).json({
        error: "Unable to read the uploaded file. Ensure it's a valid XLSX or XLS file.",
      });
    }

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res.status(400).json({ error: "The uploaded file is empty or invalid." });
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ error: "The uploaded file contains no valid data." });
    }

    const requiredColumns = ["Variety Id", "Grade", "Price"];
    const missingColumns = requiredColumns.filter((col) => !(col in data[0]));
    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: `Invalid file format. Missing column(s): ${missingColumns.join(", ")}`,
      });
    }

    const isEmpty = (v) => v === undefined || v === null || String(v).trim() === "";

    const formatRows = (rows, limit = 10) => {
    const shown = rows.slice(0, limit).map((r) => `Row ${r}`).join(", ");
    return rows.length > limit
      ? `${shown} and ${rows.length - limit} more`
      : shown;
    };

    const emptyRows = [];
    const invalidPriceRows = [];

    data.forEach((row, i) => {
      const rowNo = i + 2;

    if (
      isEmpty(row["Variety Id"]) ||
      isEmpty(row["Grade"]) ||
      isEmpty(row["Price"])
    ) {
      emptyRows.push(rowNo);
    } else if (isNaN(Number(row["Price"])) || Number(row["Price"]) < 0) {
      invalidPriceRows.push(rowNo);
    }
  });

  const errors = [];
  if (emptyRows.length > 0) {
    errors.push(`Empty values found (${formatRows(emptyRows)})`);
  }
  if (invalidPriceRows.length > 0) {
    errors.push(`Invalid price found (${formatRows(invalidPriceRows)})`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(". ") });
  }

    xlindex = await marketPriceDao.createxlhistory(xlName);

    const marketPriceResult = await marketPriceDao.insertMarketPriceXLSXData(xlindex, data);

    return res.status(200).json({
      message: "File uploaded and data inserted successfully",
      xlindex,
      marketPriceResult,
    });
    } catch (error) {
    console.error("Error processing XLSX file:", error);

    if (xlindex) {
      try {
        await marketPriceDao.rollbackXlUpload(xlindex);
      } catch (cleanupErr) {
        console.error("Failed to roll back upload:", cleanupErr);
      }
    }

    return res.status(500).json({
      error: "An error occurred while processing the XLSX file. Please try again.",
    });
  }
};


exports.getAllxlsxlist = async (req, res) => {
  try {
    const { page, limit } =
      await ValidateSchema.getAllAdminUsersSchema.validateAsync(req.query);
    const offset = (page - 1) * limit;

    const { total, items } = await marketPriceDao.getAllxlsxlist(limit, offset);

    console.log("Successfully fetched admin users");
    res.json({
      items,
      total,
    });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.deleteXl = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    // Validate the request parameters (id)
    const { id } = await ValidateSchema.deleteAdminUserSchema.validateAsync(
      req.params
    );

    // Delete admin user by id from DAO
    const results = await marketPriceDao.deleteXl(id);

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Admin user not found" });
    }

    console.log("Admin user deleted successfully");
    return res.status(200).json({ message: "Admin user deleted successfully" });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error deleting admin user:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting admin user" });
  }
};



exports.downloadXLSXFile = async (req, res) => {
  try {
    const { fileName } = req.params;
    
    // Fetch file path from DAO if stored in DB or directly if on server
    const filePath = await marketPriceDao.getXLSXFilePath(fileName);

    // Check if the file exists
    if (!filePath) {
      return res.status(404).json({ message: 'File not found.' });
    }

    // Serve the file for download
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('File download error:', err);
        res.status(500).json({ message: 'Error downloading the file.' });
      }
    });
  } catch (error) {
    console.error('Error in downloadXLSXFile:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};


//get all market price
// exports.getAllMarketPrice = async (req, res) => {
//   const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
//   console.log(fullUrl);

//   try {
//     const {page, limit,crop,grade} = req.query
//     console.log(page, limit,crop,grade);
//     const offset = (page - 1) * limit;
    

//       const {results,total} = await marketPriceDao.getAllMarketPriceDAO(limit, offset, crop, grade);
//       console.log(results,total);
      

//       console.log("Successfully fetched marcket price");
//       return res.status(200).json({results,total});
//   } catch (error) {
//       if (error.isJoi) {
//           // Handle validation error
//           return res.status(400).json({ error: error.details[0].message });
//       }

//       console.error("Error fetching collection officers:", error);
//       return res.status(500).json({ error: "An error occurred while fetching collection officers" });
//   }
// };

exports.getAllMarketPrice = async (req, res) => {
  try {
    const {crop, grade, search } = req.query;

    // Calculate offset
    // const offset = (page - 1) * limit;

    // Fetch data from DAO
    const { results, total } = await marketPriceDao.getAllMarketPriceDAO(crop, grade, search);

    console.log("Successfully fetched market prices");
    return res.status(200).json({ results, total });
  } catch (error) {
    console.error("Error fetching market prices:", error.message || error);
    return res.status(500).json({ error: "An error occurred while fetching market prices" });
  }
};

exports.getAllCropName = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {

      const result = await marketPriceDao.getAllCropNameDAO();

      console.log("Successfully fetched marcket price");
      return res.status(200).json(result);
  } catch (error) {
      if (error.isJoi) {
          // Handle validation error
          return res.status(400).json({ error: error.details[0].message });
      }

      console.error("Error fetching collection officers:", error);
      return res.status(500).json({ error: "An error occurred while fetching collection officers" });
  }
};

exports.getAllMarketPriceAgro = async (req, res) => {
  try {
    const {crop, grade, search, centerId } = req.query;

    // Calculate offset
    // const offset = (page - 1) * limit;

    // Fetch data from DAO
    const { results, total } = await marketPriceDao.getAllMarketPriceAgroDAO(crop, grade, search, centerId, 1);

    console.log("Successfully fetched market prices for AgroWorld");
    return res.status(200).json({ results, total });
  } catch (error) {
    console.error("Error fetching market prices:", error.message || error);
    return res.status(500).json({ error: "An error occurred while fetching market prices" });
  }
};