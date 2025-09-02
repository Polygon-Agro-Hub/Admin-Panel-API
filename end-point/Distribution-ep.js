const bcrypt = require("bcryptjs/dist/bcrypt");
const DistributionDao = require("../dao/Distribution-dao");
const uploadFileToS3 = require("../middlewares/s3upload");
const DistributionValidation = require("../validations/distribution-validation");

exports.createDistributionCenter = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  console.log('request body', req.body);
  try {
    // Validate input with Joi
    const data =
      await DistributionValidation.getDistributionCenterDetailsSchema.validateAsync(
        req.body
      );

    console.log(data);

    // Check for existing records
    const existingChecks = await DistributionDao.checkExistingDistributionCenter({
      name: data.name,
      regCode: data.regCode,
      contact01: data.contact1,
      excludeId: null // For create operation, no ID to exclude
    });

    if (existingChecks.exists) {
      return res.status(409).json({
        success: false,
        error: existingChecks.message
      });
    }

    // Proceed to create
    const result = await DistributionDao.createDistributionCenter(data);

    return res.status(201).json({
      success: true,
      message: "Distribution center created successfully",
      data: result,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({
        success: false,
        error: err.details[0].message,
      });
    }

    console.error("Server error:", err);
    return res.status(500).json({
      success: false,
      error: "An error occurred while creating distribution center",
    });
  }
};

exports.getAllDistributionCentre = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const {
      page,
      limit,
      district,
      province,
      company,
      searchItem,
      centerType,
      city, // Add city parameter
    } =
      await DistributionValidation.getAllDistributionCentreSchema.validateAsync(
        req.query
      );

    const offset = (page - 1) * limit;

    console.log({
      page,
      limit,
      district,
      province,
      company,
      searchItem,
      centerType,
      city, // Log city parameter
    });

    const { total, items } = await DistributionDao.getAllDistributionCentre(
      limit,
      offset,
      district,
      province,
      company,
      searchItem,
      centerType,
      city // Pass city parameter to DAO
    );

    console.log(items);
    console.log(page);
    console.log(limit);
    console.log(searchItem);

    res.json({
      items,
      total,
    });

    console.log({ total, items });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.getAllCompanies = async (req, res) => {
  try {
    console.log(req.query);
    const { status = null, search } = req.query;
    const results = await DistributionDao.getAllCompanyDAO(search);

    console.log("Successfully retrieved all companies");
    res.json({ results, total: results.length });
  } catch (err) {
    if (err.isJoi) {
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching companies:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching companies" });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const id = req.params.id;

    const affectedRows = await DistributionDao.deleteCompanyById(id);

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

exports.getAllDistributionCentreHead = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log(fullUrl);

    const { companyId, page, limit, searchText } = req.query;
    const offset = (page - 1) * limit;

    const { total, items } = await DistributionDao.getAllDistributionCentreHead(
      companyId,
      limit,
      offset,
      searchText
    );

    console.log({ items, total });
    res.json({
      items,
      total,
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.getCompanies = async (req, res) => {
  try {
    const companies = await DistributionDao.getCompanyDAO();

    if (!companies || companies.length === 0) {
      console.warn("No active companies found");
      return res.json({
        success: true,
        message: "No active companies found",
        data: [],
      });
    }

    // console.log(`Successfully retrieved ${companyNames.length} company names`);
    res.json({
      success: true,
      message: "Company names retrieved successfully",
      data: companies,
    });
  } catch (err) {
    console.error("Error fetching company names:", err.message);
    res.status(500).json({
      success: false,
      error: "An error occurred while fetching company names",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

exports.createDistributionHead = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const officerData = JSON.parse(req.body.officerData);

    const isExistingNIC = await DistributionDao.checkNICExist(officerData.nic);
    const isExistingEmail = await DistributionDao.checkEmailExist(
      officerData.email
    );

    if (isExistingNIC) {
      return res.status(500).json({
        error: "NIC already exists",
      });
    }

    if (isExistingEmail) {
      return res.status(500).json({
        error: "Email already exists",
      });
    }


    const isExistingPhone1 = await DistributionDao.checkPhoneExist(officerData.phoneNumber01);
    if (isExistingPhone1) {
      return res.status(500).json({ error: "Mobile number 1 already exists" });
    }

    // ✅ Optional: Check Phone Number 2
    if (officerData.phoneNumber02) {
      const isExistingPhone2 = await DistributionDao.checkPhoneExist(officerData.phoneNumber02);
      if (isExistingPhone2) {
        return res.status(500).json({ error: "Mobile number 2 already exists" });
      }
    }

    let profileImageUrl = null; // Default to null if no image is provided

    // Check if an image file is provided
    if (req.body.file) {
      try {
        const base64String = req.body.file.split(",")[1]; // Extract the Base64 content
        const mimeType = req.body.file.match(/data:(.*?);base64,/)[1]; // Extract MIME type
        const fileBuffer = Buffer.from(base64String, "base64"); // Decode Base64 to buffer

        const fileExtension = mimeType.split("/")[1]; // Extract file extension from MIME type
        const fileName = `${officerData.firstNameEnglish}_${officerData.lastNameEnglish}.${fileExtension}`;

        // Upload image to S3
        profileImageUrl = await uploadFileToS3(
          fileBuffer,
          fileName,
          "collectionofficer/image"
        );
      } catch (err) {
        console.error("Error processing image file:", err);
        return res
          .status(400)
          .json({ error: "Invalid file format or file upload error" });
      }
    }

    const newEmpId = await DistributionDao.getDistributedIdforCreateEmpIdDao(officerData.jobRole)

    // Save officer data (without image if no image is uploaded)
    const resultsPersonal =
      await DistributionDao.createDistributionHeadPersonal(
        officerData,
        profileImageUrl,
        newEmpId
      );

    console.log("Distribution Head created successfully");
    return res.status(201).json({
      message: "Distribution Head created successfully",
      id: resultsPersonal.insertId,
      status: true,
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error creating collection officer:", error);
    return res.status(500).json({
      error: "An error occurred while creating the collection officer",
    });
  }
};

exports.getAllCompanyList = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  try {
    const result = await DistributionDao.GetAllCompanyList();

    if (result.length === 0) {
      return res
        .status(404)
        .json({ message: "No news items found", data: result });
    }

    console.log("Successfully retrieved all collection center");
    res.json(result);
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching news:", err);
    res.status(500).json({ error: "An error occurred while fetching news" });
  }
};

exports.getAllDistributedCentersByCompany = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const companyId = req.params.companyId;
    const result = await DistributionDao.GetDistributedCenterByCompanyIdDAO(
      companyId
    );

    if (result.length === 0) {
      return res.status(404).json({
        message: "No distributed centers found for this company",
        data: [],
      });
    }

    console.log("Successfully retrieved all distributed centers for company");
    res.status(200).json({
      message: "Distributed centers retrieved successfully",
      data: result,
    });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({
        error: "Validation error",
        details: err.details[0].message,
      });
    }

    console.error("Error fetching distributed centers:", err);
    res.status(500).json({
      error: "An error occurred while fetching distributed centers",
      details: err.message,
    });
  }
};

exports.getCompany = async (req, res) => {
  try {
    const results = await DistributionDao.getCompanyDetails();
    console.log(results);

    console.log("Successfully retrieved company names");
    res.json({
      success: true,
      message: "Company names retrieved successfully",
      data: results,
    });
  } catch (err) {
    console.error("Error fetching company names:", err);
    res.status(500).json({
      success: false,
      error: "An error occurred while fetching company names",
    });
  }
};

exports.deleteDistributionHead = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const { id } = req.params;

    const results = await DistributionDao.DeleteDistributionHeadDao(id);

    console.log("Successfully Deleted Distribution Head");
    if (results.affectedRows > 0) {
      res.status(200).json({ results: results, status: true });
    } else {
      res.json({ results: results, status: false });
    }
  } catch (error) {
    if (error.isJoi) {
      return res
        .status(400)
        .json({ error: error.details[0].message, status: false });
    }

    console.error("Error deleting Distribution Head:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting Distribution Head" });
  }
};

exports.getDistributionHeadDetailsById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Distribution Head ID is required",
      });
    }

    const officerDetails =
      await DistributionDao.GetDistributionHeadDetailsByIdDao(id);

    if (!officerDetails) {
      return res.status(404).json({
        success: false,
        error: "Distribution Head not found",
      });
    }

    console.log("Successfully retrieved Distribution Head details");
    res.json({
      success: true,
      message: "Distribution Head details retrieved successfully",
      data: officerDetails,
    });
  } catch (err) {
    console.error("Error fetching distribution head details:", err);
    res.status(500).json({
      success: false,
      error: "An error occurred while fetching distribution head details",
    });
  }
};


exports.updateCollectionOfficerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Distribution Head ID is required",
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Update data is required",
      });
    }

    // Check for NIC duplication in another record
    if (updateData.nic) {
      const nicExists = await DistributionDao.checkNICExistExceptId(updateData.nic, id);
      if (nicExists) {
        return res.status(409).json({
          success: false,
          error: "NIC already exists for another user",
        });
      }
    }

    // Check for email duplication in another record
    if (updateData.email) {
      const emailExists = await DistributionDao.checkEmailExistExceptId(updateData.email, id);
      if (emailExists) {
        return res.status(409).json({
          success: false,
          error: "Email already exists for another user",
        });
      }
    }

    // Check for phone number duplication in another record
    // Check for phone number duplication in another record
    const phoneNumberMap = {
      phoneNumber01: updateData.phoneNumber01,
      phoneNumber02: updateData.phoneNumber02,
    };

    const existingPhones = [];

    for (const [field, phone] of Object.entries(phoneNumberMap)) {
      if (!phone) continue;

      const phoneExists = await DistributionDao.checkPhoneExistExceptId(phone, id);
      if (phoneExists) {
        existingPhones.push(field);
      }
    }

    if (existingPhones.length > 0) {
      let errorMessage = '';

      if (existingPhones.length === 2) {
        errorMessage = 'Both Mobile Number - 1 and Mobile Number - 2 already exist for other users';
      } else if (existingPhones[0] === 'phoneNumber01') {
        errorMessage = 'Mobile Number - 1 already exists for another user';
      } else {
        errorMessage = 'Mobile Number - 2 already exists for another user';
      }

      return res.status(409).json({
        success: false,
        error: errorMessage,
      });
    }


    const result = await DistributionDao.UpdateDistributionHeadDao(id, updateData);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "Distribution Head not found or no changes made",
      });
    }

    console.log("Successfully updated Distribution Head details");
    res.json({
      success: true,
      message: "Distribution Head details updated successfully",
      data: {
        id: id,
        affectedRows: result.affectedRows,
      },
    });
  } catch (err) {
    console.error("Error updating distribution head details:", err);
    res.status(500).json({
      success: false,
      error: "An error occurred while updating distribution head details",
    });
  }
};


exports.getDistributionCentreById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const { id } = req.params;

    // Basic check if ID exists
    if (!id) {
      return res
        .status(400)
        .json({ error: "Distribution centre ID is required" });
    }

    const distributionCentre = await DistributionDao.getDistributionCentreById(
      id
    );

    if (!distributionCentre) {
      return res.status(404).json({ error: "Distribution centre not found" });
    }

    // Format the response to include company information
    const response = {
      id: distributionCentre.id,
      centerName: distributionCentre.centerName,
      officerName: distributionCentre.officerName,
      code1: distributionCentre.code1,
      contact01: distributionCentre.contact01,
      code2: distributionCentre.code2,
      contact02: distributionCentre.contact02,
      city: distributionCentre.city,
      district: distributionCentre.district,
      province: distributionCentre.province,
      country: distributionCentre.country,
      longitude: distributionCentre.longitude,
      latitude: distributionCentre.latitude,
      email: distributionCentre.email,
      createdAt: distributionCentre.createdAt,
      company: distributionCentre.companyNameEnglish,
      regCode: distributionCentre.regCode,
    };

    console.log("Fetched distribution centre:", response);
    res.json(response);
  } catch (err) {
    console.error("Error fetching distribution centre:", err);
    res.status(500).json({
      error: "An error occurred while fetching the distribution centre.",
    });
  }
};

exports.deleteDistributedCenter = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Distribution Head ID is required",
      });
    }

    const result = await DistributionDao.deleteDistributedCenterDao(
      parseInt(id)
    );
    console.log("Delete result", result);

    if (result.affectedRows === 0) {
      return res.json({
        success: false,
        message: "Distribution Center Delete faild",
      });
    }

    console.log("Successfully updated Distribution Head details");
    res.json({
      success: true,
      message: "Distribution Deleted successfully",
      data: {
        id: id,
        affectedRows: result.affectedRows,
      },
    });
  } catch (err) {
    console.error("Error updating distribution head details:", err);
    res.status(500).json({
      success: false,
      error: "An error occurred while updating distribution head details",
    });
  }
};

exports.updateDistributionCentreDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log("Received update request for ID:", id);
    console.log("Update data:", updateData);

    // Validate input with Joi
    const data = await DistributionValidation.getDistributionCenterDetailsSchema.validateAsync(updateData);

    // Check for existing records excluding current center
    const existingChecks = await DistributionDao.checkExistingDistributionCenter({
      name: data.name,
      regCode: data.regCode,
      contact01: data.contact1,
      excludeId: id // Exclude current center from check
    });

    if (existingChecks.exists) {
      return res.status(409).json({
        success: false,
        error: existingChecks.message,
        conflictingRecord: existingChecks.conflictingRecord
      });
    }

    // Validate required fields
    if (!id) {
      console.log("Validation failed: Missing ID");
      return res.status(400).json({
        success: false,
        error: "Distribution Centre ID is required",
      });
    }

    // Update the distribution center
    console.log("Calling DAO to update distribution center");
    const updatedCentre = await DistributionDao.updateDistributionCentreById(
      id,
      data
    );

    if (!updatedCentre) {
      console.log(
        "Update failed: Distribution Centre not found or no changes made"
      );
      return res.status(404).json({
        success: false,
        error: "Distribution Centre not found or no changes made",
      });
    }

    console.log("Successfully updated Distribution Centre details");
    res.json({
      success: true,
      message: "Distribution Centre details updated successfully",
      data: updatedCentre,
    });
  } catch (err) {
    console.error("Error updating distribution centre details:", err);

    if (err.isJoi) {
      return res.status(400).json({
        success: false,
        error: err.details[0].message,
      });
    }

    res.status(500).json({
      success: false,
      error: "An error occurred while updating distribution centre details",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

exports.deleteDistributionCenter = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const { id } = req.params;

    const results = await DistributionDao.DeleteDistributionCenter(id);

    console.log("Successfully Deleted Distribution Center");
    if (results.affectedRows > 0) {
      res.status(200).json({ results: results, status: true });
    } else {
      res.json({ results: results, status: false });
    }
  } catch (error) {
    if (error.isJoi) {
      return res
        .status(400)
        .json({ error: error.details[0].message, status: false });
    }

    console.error("Error deleting Distribution Center:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting Distribution Center" });
  }
};

exports.generateRegCode = (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  const { province, district, city } = req.body;

  // Call DAO to generate the regCode
  DistributionDao.generateRegCode(province, district, city, (err, regCode) => {
    if (err) {
      return res.status(500).json({ error: "Error generating regCode" });
    }

    res.json({ regCode });
  });
};

// Add this new endpoint to check name existence
exports.checkDistributionCenterNameExists = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Name parameter is required",
      });
    }

    const centers = await DistributionDao.GetDistributionCenterByName(name);
    return res.status(200).json({
      exists: centers && centers.length > 0,
    });
  } catch (err) {
    console.error("Error checking name existence:", err);
    return res.status(500).json({
      success: false,
      error: "An error occurred while checking name existence",
    });
  }
};

exports.getAllDistributionOfficers = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {

    const validatedQuery =
      await DistributionValidation.getAllDistributionOfficersSchema.validateAsync(
        req.query
      );

    const { page, limit, centerStatus, status, nic, company, role, centerId } = validatedQuery;

    console.log(centerStatus, status)


    const result = await DistributionDao.getAllDistributionOfficers(
      page,
      limit,
      nic,
      company,
      role,
      centerStatus,
      status,
      centerId
    );

    console.log(result);

    console.log("Successfully fetched distribution officers");
    return res.status(200).json(result);
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching distribution officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching distribution officers" });
  }
};

exports.getAllDistributedCenterNames = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const results = await DistributionDao.getAllDistributionCenterNamesDao();

    console.log("Successfully retrieved reports");
    res.status(200).json(results);
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error retrieving", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching" });
  }
};

exports.getAllDistributionManagerNames = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const results = await DistributionDao.getAllDistributionCenterManagerDao();

    console.log("Successfully retrieved reports");
    res.status(200).json(results);
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error retrieving district reports:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the reports" });
  }
};

exports.deleteDistributionOfficer = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { id } = req.params;

    const qrimage = await DistributionDao.getQrImage(id);

    const qrUrl = qrimage.QRcode;
    const imageUrl = qrimage.image;

    console.log(qrUrl);

    if (qrUrl) {
      try {
        await deleteFromS3(qrUrl);
      } catch (s3Error) {
        console.error("Failed to delete image from S3:", s3Error);
      }
    }

    if (imageUrl) {
      try {
        await deleteFromS3(imageUrl);
      } catch (s3Error) {
        console.error("Failed to delete image from S3:", s3Error);
      }
    }

    const results = await DistributionDao.DeleteDistributionOfficerDao(
      req.params.id
    );

    console.log("Successfully Delete Status");
    if (results.affectedRows > 0) {
      res.status(200).json({ results: results, status: true });
    } else {
      res.json({ results: results, status: false });
    }
  } catch (error) {
    if (error.isJoi) {
      return res
        .status(400)
        .json({ error: error.details[0].message, status: false });
    }

    console.error("Error retrieving Updated Status:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while Updated Statuss" });
  }
};

exports.UpdateStatusAndSendPassword = async (req, res) => {
  try {
    const { id, status } = req.params;

    // Validate input
    if (!id || !status) {
      return res
        .status(400)
        .json({ message: "ID and status are required.", status: false });
    }

    // Fetch officer details by ID
    const officerData = await DistributionDao.getDistributionOfficerEmailDao(
      id
    );
    if (!officerData) {
      return res
        .status(404)
        .json({ message: "Collection officer not found.", status: false });
    }

    // Destructure email, firstNameEnglish, and empId from fetched data
    const { email, firstNameEnglish, empId } = officerData;
    console.log(`Email: ${email}, Name: ${firstNameEnglish}, Emp ID: ${empId}`);

    // Generate a new random password
    const generatedPassword = Math.random().toString(36).slice(-8); // Example: 8-character random password

    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    // Update status and password in the database
    const updateResult =
      await DistributionDao.UpdateDistributionOfficerStatusAndPasswordDao({
        id,
        status,
        password: hashedPassword,
      });

    if (updateResult.affectedRows === 0) {
      return res.status(400).json({
        message: "Failed to update status and password.",
        status: false,
      });
    }

    // If status is 'Approved', send the password email
    if (status === "Approved") {
      const emailResult = await DistributionDao.SendGeneratedPasswordDao(
        email,
        generatedPassword,
        empId,
        firstNameEnglish
      );

      if (!emailResult.success) {
        return res.status(500).json({
          message: "Failed to send password email.",
          error: emailResult.error,
        });
      }
    }

    // Return success response with empId and email
    res.status(200).json({
      message: "Status updated and password sent successfully.",
      status: true,
      data: {
        empId, // Include empId for reference
        email, // Include the email sent to
      },
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "An error occurred.", error });
  }
};

exports.getAllCompanyNames = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const results = await DistributionDao.getAllCompanyNamesDao();

    console.log("Successfully retrieved reports");
    res.status(200).json(results);
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error retrieving district reports:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the reports" });
  }
};

exports.createDistributionOfficer = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const officerData = JSON.parse(req.body.officerData);

    const isExistingNIC = await DistributionDao.checkNICExist(
      officerData.nic
    );
    const isExistingEmail = await DistributionDao.checkEmailExist(
      officerData.email
    );

    if (isExistingNIC) {
      return res.status(500).json({
        error: "NIC already exists",
      });
    }

    if (isExistingEmail) {
      return res.status(500).json({
        error: "Email already exists",
      });
    }


    const isExistingPhoneNumber01 = await DistributionDao.checkPhoneNumberExist(officerData.phoneNumber01);
    if (isExistingPhoneNumber01) {
      return res.status(500).json({
        error: "Primary phone number already exists",
      });
    }

    if (officerData.phoneNumber02) {
      const isExistingPhoneNumber02 = await DistributionDao.checkPhoneNumberExist(officerData.phoneNumber02);
      if (isExistingPhoneNumber02) {
        return res.status(500).json({
          error: "Secondary phone number already exists",
        });
      }
    }

    let profileImageUrl = null; // Default to null if no image is provided
    const lastId = await DistributionDao.getDCIDforCreateEmpIdDao(officerData.jobRole);
    console.log("LastId", lastId);


    // Check if an image file is provided
    if (req.body.file) {
      try {
        const base64String = req.body.file.split(",")[1]; // Extract the Base64 content
        const mimeType = req.body.file.match(/data:(.*?);base64,/)[1]; // Extract MIME type
        const fileBuffer = Buffer.from(base64String, "base64"); // Decode Base64 to buffer

        const fileExtension = mimeType.split("/")[1]; // Extract file extension from MIME type
        const fileName = `${officerData.firstNameEnglish}_${officerData.lastNameEnglish}.${fileExtension}`;

        // Upload image to S3
        profileImageUrl = await uploadFileToS3(
          fileBuffer,
          fileName,
          "collectionofficer/image"
        );
      } catch (err) {
        console.error("Error processing image file:", err);
        return res
          .status(400)
          .json({ error: "Invalid file format or file upload error" });
      }
    }

    // Save officer data (without image if no image is uploaded)
    const resultsPersonal =
      await DistributionDao.createDistributionOfficerPersonal(
        officerData,
        profileImageUrl,
        lastId
      );

    console.log("Distribution Officer created successfully");
    return res.status(201).json({
      message: "Distribution Officer created successfully",
      id: resultsPersonal.insertId,
      status: true,
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error creating distribution officer:", error);
    return res.status(500).json({
      error: "An error occurred while creating the distribution officer",
    });
  }
};

exports.getAllDistributionCenterByCompany = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const companyId = req.params.companyId;
    const result = await DistributionDao.GetDistributionCentersByCompanyIdDAO(
      companyId
    );

    if (result.length === 0) {
      return res
        .status(404)
        .json({ message: "No news items found", data: result });
    }

    console.log("Successfully retrieved all distribution center");
    res.json(result);
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching news:", err);
    res.status(500).json({ error: "An error occurred while fetching news" });
  }
};

exports.getAllDistributionManagerList = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const companyId = req.params.companyId;
    const centerId = req.params.centerId;
    console.log(companyId, centerId);

    const result = await DistributionDao.GetAllDistributionManagerList(
      companyId,
      centerId
    );

    if (result.length === 0) {
      return res
        .status(404)
        .json({ message: "No collection Managers found", data: result });
    }

    console.log("Successfully retrieved all collection Managers");
    res.json(result);
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching news:", err);
    res.status(500).json({ error: "An error occurred while fetching news" });
  }
};

exports.getForCreateId = async (req, res) => {
  try {
    const { role } = await DistributionValidation.getRoleShema.validateAsync(
      req.params
    );
    const results = await DistributionDao.getForCreateId(role);

    if (results.length === 0) {
      return res.json({ result: { empId: "00001" }, status: true });
    }

    res.status(200).json({ result: results[0], status: true });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};


exports.getAllAssigningCities = async (req, res) => {
  try {
    const { provine, district } = await DistributionValidation.getAllAssigningCitiesShema.validateAsync(req.params);
    const centers = await DistributionDao.getAssigningForDistributedCentersDao();
    const cities = await DistributionDao.getAssigningForCityDao(provine, district);

    res.status(200).json({ centers, cities, status: true });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};


exports.assignCityToDistributedCcenter = async (req, res) => {
  try {
    const data = await DistributionValidation.assignCityToDistributedCcenterShema.validateAsync(req.body);
    const result = await DistributionDao.assignCityToDistributedCenterDao(data);
    if (result.affectedRows === 0) {
      return res.json({ message: "Assig failed or no changes made", status: false });
    }

    res.status(200).json({ status: true });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};


exports.removeAssignCityToDistributedCcenter = async (req, res) => {
  try {
    const data = await DistributionValidation.assignCityToDistributedCcenterShema.validateAsync(req.body);
    const result = await DistributionDao.removeAssignCityToDistributedCenterDao(data);
    if (result.affectedRows === 0) {
      return res.json({ message: "Assig failed or no changes made", status: false });
    }

    res.status(200).json({ status: true });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};


exports.getDistributedCenterTarget = async (req, res) => {
  try {
    const { id, status, date, searchText } = await DistributionValidation.getDistributedCenterTargetShema.validateAsync(req.query);
    console.log("Params:", req.query);

    // Convert date to proper format if it's a Date object
    let formattedDate = date;
    if (date instanceof Date) {
      formattedDate = date.toISOString().split('T')[0];
    }

    const results = await DistributionDao.getDistributedCenterTargetDao(id, status, formattedDate, searchText);

    console.log("Successfully retrieved all companies");
    res.json({ status: true, data: results });
  } catch (err) {
    if (err.isJoi) {
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching companies:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching companies" });
  }
};


exports.getDistributedCenterOfficers = async (req, res) => {
  try {
    const { id, status, role, searchText } = await DistributionValidation.getDistributedCenterOfficersShema.validateAsync(req.query);

    const data = await DistributionDao.getCenterAndCompanyIdDao(parseInt(id));
    const result = await DistributionDao.getEachDistributedCenterOfficersDao(data, status, role, searchText);

    console.log("Successfully retrieved all companies");
    res.json({ status: true, data: result });
  } catch (err) {
    if (err.isJoi) {
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching companies:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching companies" });
  }
};


exports.getDistributionOutForDlvrOrder = async (req, res) => {
  try {
    const { id, status, date, searchText } = await DistributionValidation.getDistributionOutForDlvrOrderShema.validateAsync(req.query);

    const result = await DistributionDao.getDistributionOutForDlvrOrderDao(id, searchText);

    console.log("Successfully retrieved distribution out for delivery orders");
    res.json({ status: true, data: result });
  } catch (err) {
    if (err.isJoi) {
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching distribution orders:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching distribution orders" });
  }
};

exports.getOfficerByIdMonthly = async (req, res) => {
  try {
    const id = req.params.id;
    const officerData = await DistributionDao.getOfficerByIdMonthly(id);

    if (!officerData) {
      return res.status(404).json({ error: "Distribution Officer not found" });
    }

    console.log(
      "Successfully fetched distribution officer, company, and bank details"
    );
    res.json({ officerData });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.updateDistributionOfficerDetails = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  const { id } = req.params;

  try {
    const officerData = JSON.parse(req.body.officerData);
    console.log('officer data',officerData)
    const qrCode = await DistributionDao.getQrImage(id);

    const isExistingNIC = await DistributionDao.editCheckNICExist(officerData.nic, id);
    if (isExistingNIC) {
      return res.status(400).json({ error: "NIC already exists" });
    }

    const isExistingEmail = await DistributionDao.EditCheckEmailExist(officerData.email, id);
    if (isExistingEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const isExistingPhoneNumber01 = await DistributionDao.checkPhoneNumberExist(officerData.phoneNumber01, id);
    if (isExistingPhoneNumber01) {
      return res.status(400).json({ error: "Primary phone number already exists" });
    }

    if (officerData.phoneNumber02) {
      const isExistingPhoneNumber02 = await DistributionDao.checkPhoneNumberExist(officerData.phoneNumber02, id);
      if (isExistingPhoneNumber02) {
        return res.status(400).json({ error: "Secondary phone number already exists" });
      }
    }

    let profileImageUrl = null;

    if (req.body.file) {
      console.log("Received");
      // Delete existing QR code or profile image from S3 if it exists
      if (qrCode.image) {
        await deleteFromS3(qrCode.image);
      }

      const base64String = req.body.file.split(",")[1]; // Extract the Base64 content
      const mimeType = req.body.file.match(/data:(.*?);base64,/)[1]; // Extract MIME type
      const fileBuffer = Buffer.from(base64String, "base64"); // Decode Base64 to buffer

      const fileExtension = mimeType.split("/")[1]; // Extract file extension from MIME type
      const fileName = `${officerData.firstNameEnglish}_${officerData.lastNameEnglish}.${fileExtension}`;

      profileImageUrl = await uploadFileToS3(
        fileBuffer,
        fileName,
        "collectionofficer/image"
      );
    } else {
      profileImageUrl = qrCode.image; // Retain existing image if no new file is provided
    }

    const {
      centerId,
      companyId,
      irmId,
      firstNameEnglish,
      lastNameEnglish,
      firstNameSinhala,
      lastNameSinhala,
      firstNameTamil,
      lastNameTamil,
      jobRole,
      empId,
      empType,
      phoneCode01,
      phoneNumber01,
      phoneCode02,
      phoneNumber02,
      nic,
      email,
      houseNumber,
      streetName,
      city,
      district,
      province,
      country,
      languages,
      accHolderName,
      accNumber,
      bankName,
      branchName,
    } = officerData;
    console.log(empId);

    await DistributionDao.updateDistributionOfficerDetails(
      id,
      centerId,
      companyId,
      irmId,
      firstNameEnglish,
      lastNameEnglish,
      firstNameSinhala,
      lastNameSinhala,
      firstNameTamil,
      lastNameTamil,
      jobRole,
      empId,
      empType,
      phoneCode01,
      phoneNumber01,
      phoneCode02,
      phoneNumber02,
      nic,
      email,
      houseNumber,
      streetName,
      city,
      district,
      province,
      country,
      languages,
      accHolderName,
      accNumber,
      bankName,
      branchName,
      profileImageUrl
    );

    res.json({ message: "Collection officer details updated successfully" });
  } catch (err) {
    console.error("Error updating collection officer details:", err);
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    res.status(500).json({ error: "Failed to update collection officer details" });
  }
};


exports.getOfficerDailyDistributionTarget = async (req, res) => {
  try {
    const { id} = await DistributionValidation.getOfficerDailyDistributionTargetShema.validateAsync(req.params);

    const result = await DistributionDao.getOfficerDailyDistributionTargetDao(id);

    console.log("Successfully retrieved all companies");
    res.json({ status: true, data: result });
  } catch (err) {
    if (err.isJoi) {
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching companies:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching companies" });
  }
};