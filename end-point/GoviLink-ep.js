const GoviLinkDAO = require("../dao/GoviLink-dao");
const uploadFileToS3 = require("../middlewares/s3upload");
const GoviLinkValidation = require("../validations/GoviLink-validation");
const deleteFromS3 = require("../middlewares/s3delete");

exports.createCompany = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    console.log("Request Body:", req.body);
    console.log("Files:", req.files);

    // Extract user ID from JWT token
    const tokenUserId = req.user?.id || req.user?.userId;

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
      modifyBy,
    } = req.body;

    // Use token user ID if available, otherwise use the one from request body
    const finalModifyBy = tokenUserId || modifyBy || "system";

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

    // Handle file upload from multipart form (logo)
    let logoUrl = undefined;

    // Process logo image from multipart form - FIXED THIS PART
    if (req.files && req.files.logo && req.files.logo[0]) {
      try {
        const file = req.files.logo[0];
        console.log("Logo file details:", {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        });

        const fileExtension = file.originalname.split(".").pop();
        const fileName = `${companyName.replace(
          /\s+/g,
          "_"
        )}_logo.${fileExtension}`;

        logoUrl = await uploadFileToS3(file.buffer, fileName, "company/logo");
        console.log("Company logo uploaded:", logoUrl);
      } catch (err) {
        console.error("Error processing company logo:", err);
        return res.status(400).json({
          status: false,
          error: "Invalid logo image format",
        });
      }
    } else {
      console.log("No logo file found in request");
    }

    // Create company using DAO with correct parameters
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
      logoUrl, // This will be undefined if no logo was uploaded
      finalModifyBy
    );

    console.log("Company creation success, ID:", companyId);
    return res.status(201).json({
      status: true,
      message: "Company created successfully",
      id: companyId,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({
        status: false,
        error: err.details[0].message,
      });
    }

    console.error("Error executing query:", err);
    return res.status(500).json({
      status: false,
      error: "An error occurred while creating company",
    });
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
    const { englishName, tamilName, sinhalaName, srvFee } = req.body;

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

exports.getAllCompanies = async (req, res) => {
  try {
    console.log(req.query);
    const { search } = req.query;
    const results = await GoviLinkDAO.getAllCompanyDAO(search);

    console.log("Successfully retrieved all companies");
    res.json({
      results,
      total: results.length,
    });
  } catch (err) {
    console.error("Error fetching companies:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching companies" });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    // Properly format and log the full URL
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log(`Full URL: ${fullUrl}`);

    // Extract user ID from JWT token (if available in your auth middleware)
    const tokenUserId = req.user?.id || req.user?.userId; // Adjust based on your auth middleware

    // Extract the company ID from request parameters
    const id = req.params.id;
    if (!id) {
      return res
        .status(400)
        .json({ message: "Company ID is required", status: false });
    }

    // Destructure request body to get the fields
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
      modifyBy,
    } = req.body;

    // Use token user ID if available, otherwise use the one from request body
    const finalModifyBy = tokenUserId || modifyBy || "system";

    // Validate required fields
    if (!regNumber || !companyName) {
      return res.status(400).json({
        message: "Registration number and company name are required",
        status: false,
      });
    }

    // Check if company name or registration number already exists (excluding current company)
    const checkResult = await GoviLinkDAO.checkCompanyDisplayNameDao(
      companyName,
      regNumber,
      id
    );

    if (checkResult.exists) {
      const errors = [];
      if (checkResult.nameExists) {
        errors.push("Company name already exists");
      }
      if (checkResult.regNumberExists) {
        errors.push("Registration number already exists");
      }

      return res.status(409).json({
        message: errors.join(" and "),
        nameExists: checkResult.nameExists,
        regNumberExists: checkResult.regNumberExists,
        status: false,
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

          // Note: You'll need to save the buffer to the file system here
          // Example: await saveFileToUploads(filename, buffer);
        }
      } catch (error) {
        console.error("Error processing logo:", error);
      }
    }

    // Call DAO function to update the company record - use finalModifyBy and logoUrl
    const result = await GoviLinkDAO.updateCompany(
      id,
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
      logoUrl, // Use the processed logo URL instead of raw base64
      finalModifyBy // Use the secure modifyBy value
    );

    // Check if any rows were affected (successful update)
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({
        message: "Company not found or no changes made",
        status: false,
      });
    }

    console.log("Company update success");
    return res
      .status(200)
      .json({ message: "Company updated successfully", status: true });
  } catch (err) {
    // Log unexpected errors
    console.error("Error executing query:", err);
    return res.status(500).json({
      error: "An error occurred while updating the company",
      status: false,
    });
  }
};
exports.deleteCompany = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const id = req.params.id;

    const affectedRows = await GoviLinkDAO.deleteCompanyById(id);

    if (affectedRows === 0) {
      return res.status(404).json({ message: "Company not found" });
    } else {
      console.log("Company deleted successfully");
      return res.status(200).json({ status: true });
    }
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error deleting company:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting the company" });
  }
};

exports.updateOfficerService = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const { id } = req.params; // get ID from frontend URL
    const { englishName, tamilName, sinhalaName, srvFee, modifyBy } = req.body;

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
      srvFee,
      modifyBy
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
exports.getAllOfficerServices = async (req, res) => {
  try {
    const services = await GoviLinkDAO.getAllOfficerServices();
    res.status(200).json(services);
  } catch (err) {
    console.error("Error fetching officer services:", err);
    res.status(500).json({ error: "Failed to fetch officer services" });
  }
};

// Delete officer service by ID
exports.deleteOfficerService = async (req, res) => {
  const id = req.params.id; // get ID from URL params

  try {
    const result = await GoviLinkDAO.deleteOfficerServiceById(id); // call DAO function
    if (result.affectedRows > 0) {
      res.status(200).json({ message: "Service deleted successfully" });
    } else {
      res.status(404).json({ message: "Service not found" });
    }
  } catch (err) {
    console.error("Error deleting officer service:", err);
    res.status(500).json({ error: "Failed to delete officer service" });
  }
};

exports.getAllCompanies = async (req, res) => {
  try {
    console.log(req.query);
    const { search } = req.query;
    const results = await GoviLinkDAO.getAllCompanyDAO(search);

    console.log("Successfully retrieved all companies");
    res.json({
      results,
      total: results.length,
    });
  } catch (err) {
    console.error("Error fetching companies:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching companies" });
  }
};

// Get all govi link jobs with filters
exports.getAllGoviLinkJobs = async (req, res) => {
  try {
    const { search, district, status, assignStatus, date } = req.query;

    const results = await GoviLinkDAO.getAllGoviLinkJobsDAO({
      search,
      district,
      status,
      assignStatus,
      date,
    });

    console.log("Successfully retrieved all GoviLink jobs");

    res.json({
      results,
      total: results.length,
    });
  } catch (err) {
    console.error("Error fetching GoviLink jobs:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching GoviLink jobs" });
  }
};

// Get field officers by job role
exports.getOfficersByJobRole = async (req, res) => {
  try {
    const { jobRole } = req.query;

    if (!jobRole) {
      return res.status(400).json({ error: "JobRole parameter is required" });
    }

    const officers = await GoviLinkDAO.getOfficersByJobRoleDAO(jobRole);

    console.log(`Successfully retrieved officers with job role: ${jobRole}`);

    res.json({
      success: true,
      data: officers,
      total: officers.length,
    });
  } catch (err) {
    console.error("Error fetching officers by job role:", err);
    res.status(500).json({
      error: "An error occurred while fetching officers",
      details: err.message,
    });
  }
};

// Assign officer to job with automatic deactivation of previous assignments
exports.assignOfficerToJob = async (req, res) => {
  try {
    const { jobId, officerId } = req.body;

    if (!jobId || !officerId) {
      return res.status(400).json({
        success: false,
        error: "jobId and officerId are required",
      });
    }

    const result = await GoviLinkDAO.assignOfficerToJobDAO(jobId, officerId);

    if (result.success) {
      res.json({
        success: true,
        message: "Officer assigned successfully",
        data: result.data,
      });
    } else {
      // Handle specific error cases
      if (
        result.error.includes("not found") ||
        result.error.includes("inactive")
      ) {
        return res.status(404).json({
          success: false,
          error: result.error,
        });
      } else if (result.error.includes("completed")) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    }
  } catch (err) {
    console.error("Error assigning officer to job:", err);
    res.status(500).json({
      success: false,
      error: "An error occurred while assigning officer",
      details: err.message,
    });
  }
};

// Get basic job details by ID
exports.getJobBasicDetailsById = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({ 
        success: false,
        error: "jobId parameter is required" 
      });
    }

    const jobDetails = await GoviLinkDAO.getJobBasicDetailsByIdDAO(jobId);

    if (jobDetails) {
      res.json({
        success: true,
        data: jobDetails
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Job not found"
      });
    }
  } catch (err) {
    console.error("Error fetching job details:", err);
    res.status(500).json({ 
      success: false,
      error: "An error occurred while fetching job details",
      details: err.message 
    });
  }
};