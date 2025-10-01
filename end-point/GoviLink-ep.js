const GoviLinkDAO = require("../dao/GoviLink-dao");
const uploadFileToS3 = require("../middlewares/s3upload");
const GoviLinkValidation = require("../validations/GoviLink-validation");
const deleteFromS3 = require("../middlewares/s3delete");

exports.createCompany = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    console.log(req.body);

    // Extract user ID from JWT token (if available in your auth middleware)
    const tokenUserId = req.user?.id || req.user?.userId; // Adjust based on your auth middleware
    
    // Validate the request body based on DAO parameters
    const {
      regNumber,
      companyName,
      email,
      financeOfficerName,
      accName,
      accNumber,
      bank,
      branch,
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      logo: logoBase64,
      modifyBy, // This comes from frontend, but we can override with token user ID for security
    } = req.body;

    // Use token user ID if available, otherwise use the one from request body
    const finalModifyBy = tokenUserId || modifyBy || 'system';

    // Check if company name or registration number already exists
    const checkCompany = await GoviLinkDAO.checkCompanyDisplayNameDao(
      companyName,
      regNumber,
      null
    );

    if (checkCompany.exists) {
      let message = "Company already exists";
      if (checkCompany.nameExists && checkCompany.regNumberExists) {
        message = "Company Name and Registration Number already exist";
      } else if (checkCompany.nameExists) {
        message = "Company Name already exists";
      } else if (checkCompany.regNumberExists) {
        message = "Registration Number already exists";
      }

      return res.json({
        status: false,
        message: message,
      });
    }

    // Process logo if provided
    let logoUrl = null;
    if (logoBase64) {
      try {
        const matches = logoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 15);
          const extension = mimeType.split("/")[1] || "png";
          const filename = `logo_${timestamp}_${random}.${extension}`;
          logoUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
        }
      } catch (error) {
        console.error("Error processing logo:", error);
      }
    }

    // Create company using DAO with correct parameters - use finalModifyBy
    const companyId = await GoviLinkDAO.createCompany(
      regNumber,
      companyName,
      email,
      financeOfficerName,
      accName,
      accNumber,
      bank,
      branch,
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      logoUrl,
      finalModifyBy // Use the secure modifyBy value
    );

    console.log("Company creation success");
    return res.status(201).json({
      status: true,
      message: "Company created successfully",
      id: companyId,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while creating company" });
  }
};

exports.getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;

    const results = await GoviLinkDAO.getCompanyDAO(id);

    if (results.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    console.log("Successfully retrieved company");
    console.log(results[0]);

    res.json(results[0]);
  } catch (err) {
    console.error("Error fetching company:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching the company" });
  }
};



exports.saveOfficerService = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const { englishName, tamilName, sinhalaName,  srvFee } = req.body;

    // Validation (basic check)
    if (!englishName || !tamilName || !sinhalaName) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Save data through DAO
    const result = await GoviLinkDAO.saveOfficerService(
      englishName,
      tamilName,
      sinhalaName,
      srvFee
    );

    console.log("Officer service saved successfully");
    res.status(201).json(result);
  } catch (err) {
    console.error("Error saving officer service:", err);
    res.status(500).json({ error: "An error occurred while saving data." });
  }
};

exports.updateOfficerService = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const { id } = req.params; // get ID from frontend URL
    const { englishName, tamilName, sinhalaName, srvFee } = req.body;

    // Validation (basic check)
    if (!englishName || !tamilName || !sinhalaName) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Update via DAO
    const result = await GoviLinkDAO.updateOfficerService(
      id,
      englishName,
      tamilName,
      sinhalaName,
      srvFee
    );

    console.log(`Officer service with ID ${id} updated successfully`);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error updating officer service:", err);
    res.status(500).json({ error: "An error occurred while updating data." });
  }
};

exports.getOfficerServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await GoviLinkDAO.getOfficerServiceById(id);

    res.status(200).json(service);
  } catch (err) {
    console.error("Error fetching officer service:", err);
    res.status(404).json({ error: err.message });
  }
};
