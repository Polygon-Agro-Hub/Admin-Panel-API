const bcrypt = require("bcryptjs/dist/bcrypt");
const DistributionDao = require("../dao/Distribution-dao");
const uploadFileToS3 = require("../middlewares/s3upload");
const DistributionValidation = require("../validations/distribution-validation");
const deleteFromS3 = require("../middlewares/s3delete");

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

    let validationErrors = [];

    // Email validation
    const isExistingEmail = await DistributionDao.checkEmailExistDC(data.email);
    if (isExistingEmail) {
      validationErrors.push("email");
    }

    const isCompanyName = await DistributionDao.checkCompanyNameExistDC(data.name);
    if (isCompanyName) {
      validationErrors.push("name");
    }

    const isRegCode = await DistributionDao.checkRegCodeExistDC(data.regCode);
    if (isRegCode) {
      validationErrors.push("regCode");
    }

    // Phone number 1 validation
    const isExistingPhoneNumber01 = await DistributionDao.checkPhoneNumberExistDC(data.contact1);
    if (isExistingPhoneNumber01) {
      validationErrors.push("contact01");
    }

    // Phone number 2 validation (optional)
    if (data.contact2) {
      const isExistingPhoneNumber02 = await DistributionDao.checkPhoneNumberExistDC(data.contact2);
      if (isExistingPhoneNumber02) {
        validationErrors.push("contact02");
      }
    }

    // If any errors, return them all at once
    if (validationErrors.length > 0) {
      console.log('validationErrors', validationErrors)
      return res.status(400).json({
        errors: validationErrors,   // e.g. ["Email", "PhoneNumber01"]
        status: false
      });
    }

    // // Check for existing records
    // const existingChecks = await DistributionDao.checkExistingDistributionCenter({
    //   name: data.name,
    //   regCode: data.regCode,
    //   contact01: data.contact1,
    //   email:data.email,
    //   excludeId: null // For create operation, no ID to exclude
    // });

    // if (existingChecks.exists) {
    //   return res.status(409).json({
    //     success: false,
    //     error: existingChecks.message
    //   });
    // }

    // Proceed to create
    const result = await DistributionDao.createDistributionCenter(data);

    return res.status(201).json({
      success: true,
      message: "Distribution centre created successfully",
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
      error: "An error occurred while creating distribution centre",
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

    // Check all duplicates at once
    const duplicateChecks = await Promise.all([
      DistributionDao.checkNICExist(officerData.nic),
      DistributionDao.checkEmailExist(officerData.email),
      DistributionDao.checkPhoneExist(officerData.phoneNumber01),
      officerData.phoneNumber02 ? DistributionDao.checkPhoneExist(officerData.phoneNumber02) : Promise.resolve(false)
    ]);

    const [isExistingNIC, isExistingEmail, isExistingPhone1, isExistingPhone2] = duplicateChecks;

    // Collect duplicate fields
    const duplicateFields = [];

    if (isExistingNIC) duplicateFields.push("NIC");
    if (isExistingEmail) duplicateFields.push("Email");
    if (isExistingPhone1) duplicateFields.push("Mobile Number 1");
    if (isExistingPhone2) duplicateFields.push("Mobile Number 2");

    // If any duplicates found, return combined error message
    if (duplicateFields.length > 0) {
      let errorMessage = "";

      if (duplicateFields.length === 1) {
        errorMessage = `${duplicateFields[0]} already exists.`;
      } else if (duplicateFields.length === 2) {
        errorMessage = `${duplicateFields[0]} and ${duplicateFields[1]} already exist.`;
      } else {
        const lastField = duplicateFields.pop();
        errorMessage = `${duplicateFields.join(", ")}, and ${lastField} already exist.`;
      }

      return res.status(400).json({
        error: errorMessage,
        duplicateFields: duplicateFields
      });
    }

    let profileImageUrl = null;

    // Check if an image file is provided
    if (req.body.file) {
      try {
        const base64String = req.body.file.split(",")[1];
        const mimeType = req.body.file.match(/data:(.*?);base64,/)[1];
        const fileBuffer = Buffer.from(base64String, "base64");

        const fileExtension = mimeType.split("/")[1];
        const fileName = `${officerData.firstNameEnglish}_${officerData.lastNameEnglish}.${fileExtension}`;

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

    const newEmpId = await DistributionDao.getDistributedIdforCreateEmpIdDao(officerData.jobRole);

    // Save officer data
    const resultsPersonal = await DistributionDao.createDistributionHeadPersonal(
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

    console.log("Successfully retrieved all collection centre");
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
    const adminId = req.user.userId

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


    const result = await DistributionDao.UpdateDistributionHeadDao(id, updateData, adminId);

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
        message: "Distribution Centre Delete faild",
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

    let validationErrors = [];

    // Check duplicates

    const isExistingEmail = await DistributionDao.checkEmailExistDC(data.email, id);
    if (isExistingEmail) {
      console.log('isExistingEmail')
      validationErrors.push('email');
      console.log('validationErrors', validationErrors)
    }
    const isCompanyName = await DistributionDao.checkCompanyNameExistDC(data.name, id);
    if (isCompanyName) {
      console.log('isCompanyName')
      validationErrors.push('name');
      console.log('validationErrors', validationErrors)
    }

    const isRegCode = await DistributionDao.checkRegCodeExistDC(data.regCode, id);
    if (isRegCode) validationErrors.push('regCode');

    const isExistingPhoneNumber01 = await DistributionDao.checkPhoneNumberExistDC(data.contact1, id);
    if (isExistingPhoneNumber01) validationErrors.push('contact1');

    if (data.contact2) {
      const isExistingPhoneNumber02 = await DistributionDao.checkPhoneNumberExistDC(data.contact2, id);
      if (isExistingPhoneNumber02) validationErrors.push('contact2');
    }

    // If any validation errors, send all at once
    if (validationErrors.length > 0) {
      console.log('validationErrors', validationErrors)
      return res.status(400).json({
        errors: validationErrors,
        status: false
      });
    }

    console.log('validationErrors', validationErrors)


    // // Check for existing records excluding current center
    // const existingChecks = await DistributionDao.checkExistingDistributionCenter({
    //   name: data.name,
    //   regCode: data.regCode,
    //   contact01: data.contact1,
    //   email:data.email,
    //   excludeId: id // Exclude current center from check
    // });

    // console.log('existingChecks', existingChecks)

    // if (existingChecks.exists) {
    //   return res.status(409).json({
    //     success: false,
    //     error: existingChecks.message,
    //     conflictingRecord: existingChecks.conflictingRecord
    //   });
    // }

    // if (existingChecks.exists) {
    //   return res.status(409).json({
    //     success: false,
    //     error: existingChecks.message,
    //     conflictingRecord: existingChecks.conflictingRecord
    //   });
    // }

    // Validate required fields
    if (!id) {
      console.log("Validation failed: Missing ID");
      return res.status(400).json({
        success: false,
        error: "Distribution Centre ID is required",
      });
    }

    // Update the distribution centre
    console.log("Calling DAO to update distribution centre");
    const updatedCentre = await DistributionDao.updateDistributionCentreById(
      id,
      data
    );

    const updateComCenter = await DistributionDao.updateDistributedCompaanyCenterDao(data.company, id)

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

    console.log("Successfully Deleted Distribution Centre");
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

    console.error("Error deleting Distribution Centre:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting Distribution Centre" });
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
    const id = parseInt(req.params.id)
    const results = await DistributionDao.getAllDistributionCenterManagerDao(id);

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

// Helper function to sanitize data
const sanitizeOfficerData = (data) => {
  const sanitized = { ...data };
  const numericFields = ['irmId'];
  
  numericFields.forEach(field => {
    if (sanitized[field] === '' || sanitized[field] === undefined) {
      sanitized[field] = null;
    }
  });
  
  // Also handle optional phone number
  if (sanitized.phoneNumber02 === '' || sanitized.phoneNumber02 === undefined) {
    sanitized.phoneNumber02 = null;
  }
  
  return sanitized;
};

// Helper function to process base64 image
const processBase64Image = async (base64Data, fileName, s3Path) => {
  if (!base64Data || !base64Data.includes("base64,")) {
    return null;
  }

  const base64String = base64Data.split(",")[1];
  const match = base64Data.match(/data:(.*?);base64,/);

  if (!match) {
    throw new Error("Invalid image format");
  }

  const mimeType = match[1];
  const fileBuffer = Buffer.from(base64String, "base64");
  const fileExtension = mimeType.split("/")[1];
  const fullFileName = fileName.includes('.') ? fileName : `${fileName}.${fileExtension}`;

  return await uploadFileToS3(fileBuffer, fullFileName, s3Path);
};

// Helper function to process all driver images in parallel
const processDriverImages = async (req, driverData) => {
  const imageProcessingTasks = [
    { key: 'licFront', name: driverData.licFrontName, path: 'vehicleregistration/licFrontImg' },
    { key: 'licBack', name: driverData.licBackName, path: 'vehicleregistration/licBackImg' },
    { key: 'insFront', name: driverData.insFrontName, path: 'vehicleregistration/insFrontImg' },
    { key: 'insBack', name: driverData.insBackName, path: 'vehicleregistration/insBackImg' },
    { key: 'vehiFront', name: driverData.vFrontName, path: 'vehicleregistration/vehFrontImg' },
    { key: 'vehiBack', name: driverData.vBackName, path: 'vehicleregistration/vehBackImg' },
    { key: 'vehiSideA', name: driverData.vSideAName, path: 'vehicleregistration/vehSideImgA' },
    { key: 'vehiSideB', name: driverData.vSideBName, path: 'vehicleregistration/vehSideImgB' }
  ];

  const uploadPromises = imageProcessingTasks.map(task =>
    processBase64Image(req.body[task.key], task.name, task.path)
  );

  const [
    licFrontImageUrl,
    licBackImageUrl,
    insFrontImageUrl,
    insBackImageUrl,
    vehicleFrontImageUrl,
    vehicleBackImageUrl,
    vehicleSideAImageUrl,
    vehicleSideBImageUrl
  ] = await Promise.all(uploadPromises);

  return {
    licFrontImageUrl,
    licBackImageUrl,
    insFrontImageUrl,
    insBackImageUrl,
    vehicleFrontImageUrl,
    vehicleBackImageUrl,
    vehicleSideAImageUrl,
    vehicleSideBImageUrl
  };
};

exports.createDistributionOfficer = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log('Request URL:', fullUrl);

  let officerId = null; // Track for rollback

  try {
    // Validate request body
    if (!req.body.officerData) {
      return res.status(400).json({ 
        error: "Officer data is required",
        status: false 
      });
    }

    // Parse and sanitize officer data
    const officerData = sanitizeOfficerData(JSON.parse(req.body.officerData));
    console.log('Processing officer:', officerData.firstNameEnglish, officerData.lastNameEnglish);

    // Parallel validation checks for better performance
    const [
      isExistingNIC,
      isExistingEmail,
      isExistingPhoneNumber01,
      isExistingPhoneNumber02
    ] = await Promise.all([
      DistributionDao.checkNICExist(officerData.nic),
      DistributionDao.checkEmailExist(officerData.email),
      DistributionDao.checkPhoneNumberExist(officerData.phoneNumber01),
      officerData.phoneNumber02 
        ? DistributionDao.checkPhoneNumberExist(officerData.phoneNumber02)
        : Promise.resolve(false)
    ]);

    // Collect all validation errors
    const validationErrors = [];
    if (isExistingNIC) validationErrors.push({ field: 'nic', message: 'NIC already exists' });
    if (isExistingEmail) validationErrors.push({ field: 'email', message: 'Email already exists' });
    if (isExistingPhoneNumber01) validationErrors.push({ field: 'phoneNumber01', message: 'Primary phone number already exists' });
    if (isExistingPhoneNumber02) validationErrors.push({ field: 'phoneNumber02', message: 'Secondary phone number already exists' });

    // Return all validation errors at once
    if (validationErrors.length > 0) {
      return res.status(409).json({ // 409 Conflict for duplicate resources
        error: "Validation failed",
        errors: validationErrors,
        status: false
      });
    }

    // Process profile image
    let profileImageUrl = null;
    try {
      profileImageUrl = await processBase64Image(
        req.body.file,
        `${officerData.firstNameEnglish}_${officerData.lastNameEnglish}`,
        "distributionofficer/image"
      );
    } catch (err) {
      console.error("Error processing profile image:", err);
      return res.status(400).json({ 
        error: "Invalid profile image format",
        status: false 
      });
    }

    // Get employee ID
    const lastId = await DistributionDao.getDCIDforCreateEmpIdDao(officerData.jobRole);
    if (lastId === null || lastId === undefined) {
      console.error('Failed to generate employee ID for role:', officerData.jobRole);
      return res.status(500).json({
        error: "Failed to generate employee ID",
        status: false
      });
    }

    // Create officer record
    const result = await DistributionDao.createDistributionOfficerPersonal(
      officerData,
      profileImageUrl,
      lastId
    );

    if (!result || result.affectedRows === 0 || !result.insertId) {
      console.error('Officer creation failed - no rows affected or no ID returned');
      return res.status(500).json({
        error: "Failed to create officer record",
        status: false
      });
    }

    officerId = result.insertId;
    console.log('Officer created successfully with ID:', officerId);

    // Handle driver-specific data
    if (officerData.jobRole === "Driver") {
      try {
        // Validate driver data exists
        if (!req.body.driverData) {
          throw new Error("Driver data is required for Driver role");
        }

        const driverData = JSON.parse(req.body.driverData);

        // Process all driver images in parallel for better performance
        const imageUrls = await processDriverImages(req, driverData);

        // Save driver vehicle registration
        const driverResult = await DistributionDao.vehicleRegisterDao(
          officerId,
          driverData,
          imageUrls.licFrontImageUrl,
          imageUrls.licBackImageUrl,
          imageUrls.insFrontImageUrl,
          imageUrls.insBackImageUrl,
          imageUrls.vehicleFrontImageUrl,
          imageUrls.vehicleBackImageUrl,
          imageUrls.vehicleSideAImageUrl,
          imageUrls.vehicleSideBImageUrl
        );

        if (!driverResult || driverResult.affectedRows === 0) {
          throw new Error("Failed to register driver vehicle data");
        }

        console.log('Driver data registered successfully');

      } catch (driverError) {
        console.error("Error processing driver data:", driverError);
        
        // Rollback: Delete the officer
        try {
          await DistributionDao.DeleteOfficerDao(officerId);
          console.log('Rolled back officer creation due to driver data error');
        } catch (rollbackError) {
          console.error('CRITICAL: Failed to rollback officer creation:', rollbackError);
          // Log to monitoring system
        }

        return res.status(400).json({
          error: "Error processing driver information: " + driverError.message,
          status: false
        });
      }
    }

    // Success response
    return res.status(201).json({
      message: "Distribution Officer created successfully",
      status: true,
      officerId: officerId
    });

  } catch (error) {
    // Handle Joi validation errors
    if (error.isJoi) {
      return res.status(400).json({ 
        error: error.details[0].message,
        status: false 
      });
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return res.status(400).json({
        error: "Invalid JSON format in request data",
        status: false
      });
    }

    // Log the full error for debugging
    console.error("Error creating distribution officer:", error);
    console.error("Stack trace:", error.stack);

    // Attempt rollback if officer was created
    if (officerId) {
      try {
        await DistributionDao.DeleteOfficerDao(officerId);
        console.log('Rolled back officer creation due to unexpected error');
      } catch (rollbackError) {
        console.error('CRITICAL: Failed to rollback officer creation:', rollbackError);
        // This should trigger alerts in production
      }
    }

    // Generic error response
    return res.status(500).json({
      error: "An unexpected error occurred while creating the distribution officer",
      status: false
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

    console.log("Successfully retrieved all distribution centre");
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

    console.log('result', result)

    // if (result.length === 0) {
    //   return res
    //     .status(404)
    //     .json({ message: "No collection Managers found", data: result });
    // }

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

    const result = await DistributionDao.getDistributionOutForDlvrOrderDao(id, searchText, date, status);

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
  console.log('Update Request URL:', fullUrl);
  const { id } = req.params;
  const adminId = req.user.userId;
  let officerId = null;

  try {
    // Parse officer data
    if (!req.body.officerData) {
      return res.status(400).json({ 
        error: "Officer data is required",
        status: false 
      });
    }

    const officerData = JSON.parse(req.body.officerData);
    console.log('Updating officer:', officerData.firstNameEnglish, officerData.lastNameEnglish);
    officerId = id;

    // Get existing officer data
    const existingOfficer = await DistributionDao.getOfficerById(id);
    if (!existingOfficer) {
      return res.status(404).json({ 
        error: "Officer not found",
        status: false 
      });
    }

    // Parallel validation checks
    const [
      isExistingNIC,
      isExistingEmail,
      isExistingPhoneNumber01,
      isExistingPhoneNumber02
    ] = await Promise.all([
      DistributionDao.editCheckNICExist(officerData.nic, id),
      DistributionDao.EditCheckEmailExist(officerData.email, id),
      DistributionDao.editCheckPhoneNumberExist(officerData.phoneNumber01, id),
      officerData.phoneNumber02 
        ? DistributionDao.editCheckPhoneNumberExist(officerData.phoneNumber02, id)
        : Promise.resolve(false)
    ]);

    // Collect validation errors
    const validationErrors = [];
    if (isExistingNIC) validationErrors.push({ field: 'nic', message: 'NIC already exists' });
    if (isExistingEmail) validationErrors.push({ field: 'email', message: 'Email already exists' });
    if (isExistingPhoneNumber01) validationErrors.push({ field: 'phoneNumber01', message: 'Primary phone number already exists' });
    if (isExistingPhoneNumber02) validationErrors.push({ field: 'phoneNumber02', message: 'Secondary phone number already exists' });

    if (validationErrors.length > 0) {
      return res.status(409).json({
        error: "Validation failed",
        errors: validationErrors,
        status: false
      });
    }

    // Process profile image
    let profileImageUrl = existingOfficer.image;
    
    if (req.body.file) {
      try {
        // Delete old image if exists
        if (existingOfficer.image) {
          await deleteFromS3(existingOfficer.image);
        }

        profileImageUrl = await processBase64Image(
          req.body.file,
          `${officerData.firstNameEnglish}_${officerData.lastNameEnglish}`,
          "distributionofficer/image"
        );
      } catch (err) {
        console.error("Error processing profile image:", err);
        return res.status(400).json({ 
          error: "Invalid profile image format",
          status: false 
        });
      }
    }

    // Update officer details
    await DistributionDao.updateDistributionOfficerDetails(
      id,
      officerData.centerId,
      officerData.companyId,
      officerData.irmId,
      officerData.firstNameEnglish,
      officerData.lastNameEnglish,
      officerData.firstNameSinhala,
      officerData.lastNameSinhala,
      officerData.firstNameTamil,
      officerData.lastNameTamil,
      officerData.jobRole,
      officerData.empId,
      officerData.empType,
      officerData.phoneCode01,
      officerData.phoneNumber01,
      officerData.phoneCode02,
      officerData.phoneNumber02,
      officerData.nic,
      officerData.email,
      officerData.houseNumber,
      officerData.streetName,
      officerData.city,
      officerData.district,
      officerData.province,
      officerData.country,
      officerData.languages,
      officerData.accHolderName,
      officerData.accNumber,
      officerData.bankName,
      officerData.branchName,
      profileImageUrl,
      adminId
    );

    console.log('Officer details updated successfully');

    // Handle driver data if job role is Driver
    if (officerData.jobRole === "Driver") {
      try {
        if (!req.body.driverData) {
          throw new Error("Driver data is required for Driver role");
        }

        const driverData = JSON.parse(req.body.driverData);
        
        // Check if driver record exists
        const existingDriverData = await DistributionDao.getDriverDataByOfficerId(id);
        
        // Process driver images
        const imageUrls = await processDriverImagesForUpdate(
          req, 
          driverData, 
          existingDriverData
        );

        if (existingDriverData) {
          // Update existing driver record
          await DistributionDao.updateVehicleRegisterDao(
            id,
            driverData,
            imageUrls.licFrontImageUrl,
            imageUrls.licBackImageUrl,
            imageUrls.insFrontImageUrl,
            imageUrls.insBackImageUrl,
            imageUrls.vehicleFrontImageUrl,
            imageUrls.vehicleBackImageUrl,
            imageUrls.vehicleSideAImageUrl,
            imageUrls.vehicleSideBImageUrl
          );
          console.log('Driver data updated successfully');
        } else {
          // Create new driver record
          await DistributionDao.vehicleRegisterDao(
            id,
            driverData,
            imageUrls.licFrontImageUrl,
            imageUrls.licBackImageUrl,
            imageUrls.insFrontImageUrl,
            imageUrls.insBackImageUrl,
            imageUrls.vehicleFrontImageUrl,
            imageUrls.vehicleBackImageUrl,
            imageUrls.vehicleSideAImageUrl,
            imageUrls.vehicleSideBImageUrl
          );
          console.log('Driver data created successfully');
        }

      } catch (driverError) {
        console.error("Error processing driver data:", driverError);
        return res.status(400).json({
          error: "Error processing driver information: " + driverError.message,
          status: false
        });
      }
    } else if (existingOfficer.jobRole === "Driver" && officerData.jobRole !== "Driver") {
      // If changing from Driver to another role, delete driver data
      try {
        const existingDriverData = await DistributionDao.getDriverDataByOfficerId(id);
        if (existingDriverData) {
          // Delete images from S3
          const imagesToDelete = [
            existingDriverData.licFrontImg,
            existingDriverData.licBackImg,
            existingDriverData.insFrontImg,
            existingDriverData.insBackImg,
            existingDriverData.vehFrontImg,
            existingDriverData.vehBackImg,
            existingDriverData.vehSideImgA,
            existingDriverData.vehSideImgB
          ].filter(Boolean);

          await Promise.all(imagesToDelete.map(url => deleteFromS3(url)));
          
          // Delete driver record
          await DistributionDao.deleteDriverData(id);
          console.log('Driver data deleted as job role changed');
        }
      } catch (deleteError) {
        console.error("Error deleting driver data:", deleteError);
        // Don't fail the update if driver data deletion fails
      }
    }

    return res.status(200).json({
      message: "Distribution Officer updated successfully",
      status: true
    });

  } catch (error) {
    console.error("Error updating distribution officer:", error);
    console.error("Stack trace:", error.stack);

    if (error.isJoi) {
      return res.status(400).json({ 
        error: error.details[0].message,
        status: false 
      });
    }

    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return res.status(400).json({
        error: "Invalid JSON format in request data",
        status: false
      });
    }

    return res.status(500).json({
      error: "An unexpected error occurred while updating the distribution officer",
      status: false
    });
  }
};

// Helper function to process driver images for update
const processDriverImagesForUpdate = async (req, driverData, existingDriverData) => {
  const imageFields = [
    { key: 'licFront', name: driverData.licFrontName, path: 'vehicleregistration/licFrontImg', existing: existingDriverData?.licFrontImg },
    { key: 'licBack', name: driverData.licBackName, path: 'vehicleregistration/licBackImg', existing: existingDriverData?.licBackImg },
    { key: 'insFront', name: driverData.insFrontName, path: 'vehicleregistration/insFrontImg', existing: existingDriverData?.insFrontImg },
    { key: 'insBack', name: driverData.insBackName, path: 'vehicleregistration/insBackImg', existing: existingDriverData?.insBackImg },
    { key: 'vehiFront', name: driverData.vFrontName, path: 'vehicleregistration/vehFrontImg', existing: existingDriverData?.vehFrontImg },
    { key: 'vehiBack', name: driverData.vBackName, path: 'vehicleregistration/vehBackImg', existing: existingDriverData?.vehBackImg },
    { key: 'vehiSideA', name: driverData.vSideAName, path: 'vehicleregistration/vehSideImgA', existing: existingDriverData?.vehSideImgA },
    { key: 'vehiSideB', name: driverData.vSideBName, path: 'vehicleregistration/vehSideImgB', existing: existingDriverData?.vehSideImgB }
  ];

  const uploadPromises = imageFields.map(async (field) => {
    // If new image provided, upload it and delete old one
    if (req.body[field.key]) {
      if (field.existing) {
        await deleteFromS3(field.existing);
      }
      return await processBase64Image(req.body[field.key], field.name, field.path);
    }
    // Otherwise keep existing image
    return field.existing || null;
  });

  const [
    licFrontImageUrl,
    licBackImageUrl,
    insFrontImageUrl,
    insBackImageUrl,
    vehicleFrontImageUrl,
    vehicleBackImageUrl,
    vehicleSideAImageUrl,
    vehicleSideBImageUrl
  ] = await Promise.all(uploadPromises);

  return {
    licFrontImageUrl,
    licBackImageUrl,
    insFrontImageUrl,
    insBackImageUrl,
    vehicleFrontImageUrl,
    vehicleBackImageUrl,
    vehicleSideAImageUrl,
    vehicleSideBImageUrl
  };
};


exports.getOfficerDailyDistributionTarget = async (req, res) => {
  try {
    const { id, date } = await DistributionValidation.getOfficerDailyDistributionTargetShema.validateAsync(req.params);
    console.log(date);

    const result = await DistributionDao.getOfficerDailyDistributionTargetDao(id, date);

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

exports.dcmGetSelectedOfficerTargets = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log('fullUrl', fullUrl);

  try {
    const { targetId, searchText, status, completingStatus } = await DistributionValidation.dcmGetparmasIdSchema.validateAsync(req.query);
    console.log('targetId:', targetId);
    console.log('completingStatus:', completingStatus);

    let targetResult = await DistributionDao.getSelectTargetItems(targetId, searchText || '', status || '');

    // Calculate combinedStatus for each item
    targetResult = targetResult.map(item => {
      let combinedStatus = '';

      if (item.packageStatus === 'Pending' && (item.additionalItemsStatus === 'Unknown' || item.additionalItemsStatus === 'Pending')) {
        combinedStatus = 'Pending';
      }
      else if (item.packageStatus === 'Pending' && (item.additionalItemsStatus === 'Opened' || item.additionalItemsStatus === 'Completed')) {
        combinedStatus = 'Opened';
      }
      else if (item.packageStatus === 'Opened') {
        combinedStatus = 'Opened';
      }
      else if (item.packageStatus === 'Completed' && item.additionalItemsStatus === 'Unknown') {
        combinedStatus = 'Completed';
      }
      else if (item.packageStatus === 'Completed' && item.additionalItemsStatus === 'Pending') {
        combinedStatus = 'Pending';
      }
      else if (item.packageStatus === 'Completed' && item.additionalItemsStatus === 'Opened') {
        combinedStatus = 'Opened';
      }
      else if (item.packageStatus === 'Completed' && item.additionalItemsStatus === 'Completed') {
        combinedStatus = 'Completed';
      }
      else if (item.packageStatus === 'Unknown' && item.additionalItemsStatus === 'Pending') {
        combinedStatus = 'Pending';
      }
      else if (item.packageStatus === 'Unknown' && item.additionalItemsStatus === 'Opened') {
        combinedStatus = 'Opened';
      }
      else if (item.packageStatus === 'Unknown' && item.additionalItemsStatus === 'Completed') {
        combinedStatus = 'Completed';
      }
      else if (item.packageStatus === 'Unknown' && item.additionalItemsStatus === 'Unknown') {
        combinedStatus = 'Unknown';
      }

      return {
        ...item,
        combinedStatus
      };
    });

    // Filter by status if provided
    if (status) {
      targetResult = targetResult.filter(item => item.combinedStatus === status);
    }

    // Filter by completing status if provided
    if (completingStatus) {
      targetResult = targetResult.filter(item => item.completeTimeStatus === completingStatus);
    }

    // Return in expected format
    return res.status(200).json({
      items: targetResult,
      total: targetResult.length
    });

  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching officer targets:", error);
    return res.status(500).json({ error: "An error occurred while fetching officer targets" });
  }
};


exports.claimDistributedOfficer = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const data = req.body;
    const result = await DistributionDao.claimDistributedOfficersDao(data);
    if (result.affectedRows === 0) {
      return res.json({ message: "Claim failed or no changes made", status: false })
    }
    console.log("Successfully retrieved reports");
    res.status(200).json({ status: true, message: "Claimed successfully" });
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

exports.getOfficerById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log('Get Officer By ID URL:', fullUrl);
  
  try {
    const { id } = req.params;
    
    // Get officer data
    const officerData = await DistributionDao.getOfficerById(id);
    
    if (!officerData || officerData.length === 0) {
      return res.status(404).json({ 
        error: "Distribution Officer not found",
        status: false 
      });
    }

    console.log('Officer Data:', officerData[0]);

    // Prepare response
    const response = {
      officerData: officerData,
      status: true
    };

    // If job role is Driver, fetch driver data with images
    if (officerData[0].jobRole === "Driver") {
      const driverData = await DistributionDao.getDriverDataByOfficerId(id);
      
      if (driverData) {
        console.log('Driver Data found for officer:', id);
        response.driverData = [driverData];
      } else {
        console.log('No driver data found for officer:', id);
        response.driverData = [];
      }
    }

    console.log("Successfully fetched distribution officer details");
    res.status(200).json(response);
    
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ 
        error: err.details[0].message,
        status: false 
      });
    }
    console.error("Error executing query:", err);
    res.status(500).json({ 
      error: "An error occurred while fetching data.",
      status: false 
    });
  }
};



exports.getAllDistributionCenterList = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const companyId = req.params.companyId;
    console.log(companyId);

    const result = await DistributionDao.GetAllDistributionCenterList(
      companyId
    );

    // if (result.length === 0) {
    //   return res
    //     .status(404)
    //     .json({ message: "No collection Managers found", data: result });
    // }

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


exports.getAllReasons = async (req, res) => {
  try {
    const reasons = await DistributionDao.getAllReasons();
    res.status(200).json({
      status: true,
      message: 'Reasons retrieved successfully',
      data: reasons
    });
  } catch (error) {
    console.error('Error fetching reasons:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve reasons',
      error: error.message
    });
  }
};

// Get reason by ID
exports.getReasonById = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = await DistributionDao.getReasonById(id);
    
    if (!reason) {
      return res.status(404).json({
        status: false,
        message: 'Reason not found'
      });
    }

    res.status(200).json({
      status: true,
      message: 'Reason retrieved successfully',
      data: reason
    });
  } catch (error) {
    console.error('Error fetching reason:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve reason',
      error: error.message
    });
  }
};

// Create new reason
exports.createReason = async (req, res) => {
  try {
    const { rsnEnglish, rsnSinhala, rsnTamil } = req.body;

    // Validation
    if (!rsnEnglish || !rsnSinhala || !rsnTamil) {
      return res.status(400).json({
        status: false,
        message: 'All language fields are required'
      });
    }

    // Get next index
    const nextIndex = await DistributionDao.getNextIndex();

    const reasonData = {
      indexNo: nextIndex,
      rsnEnglish: rsnEnglish.trim(),
      rsnSinhala: rsnSinhala.trim(),
      rsnTamil: rsnTamil.trim()
    };

    const result = await DistributionDao.createReason(reasonData);

    res.status(201).json({
      status: true,
      message: 'Reason created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error creating reason:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to create reason',
      error: error.message
    });
  }
};


// Delete reason
exports.deleteReason = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if trying to delete ID 1
    if (id === '1' || parseInt(id) === 1) {
      return res.status(403).json({
        status: false,
        message: 'Cannot delete the default reason (ID: 1)'
      });
    }

    const affectedRows = await DistributionDao.deleteReason(id);

    if (affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: 'Reason not found'
      });
    }

    // After deletion, get all reasons and update their indexes
    const allReasons = await DistributionDao.getAllReasons();
    const reasonsWithNewIndexes = allReasons.map((reason, index) => ({
      id: reason.id,
      indexNo: index + 1
    }));
    
    await DistributionDao.updateIndexes(reasonsWithNewIndexes);

    res.status(200).json({
      status: true,
      message: 'Reason deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting reason:', error);
    res.status(500).json({
      status: false,
      message: error.message || 'Failed to delete reason',
      error: error.message
    });
  }
};

// Update indexes after drag and drop reordering
exports.updateIndexes = async (req, res) => {
  try {
    const { reasons } = req.body;

    if (!reasons || !Array.isArray(reasons)) {
      return res.status(400).json({
        status: false,
        message: 'Invalid request format. Expected an array of reasons.'
      });
    }

    await DistributionDao.updateIndexes(reasons);

    res.status(200).json({
      status: true,
      message: 'Indexes updated successfully'
    });
  } catch (error) {
    console.error('Error updating indexes:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to update indexes',
      error: error.message
    });
  }
};

// Get next available index
exports.getNextIndex = async (req, res) => {
  try {
    const nextIndex = await DistributionDao.getNextIndex();
    res.status(200).json({
      status: true,
      data: { nextIndex }
    });
  } catch (error) {
    console.error('Error getting next index:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to get next index',
      error: error.message
    });
  }
};


exports.getAllHoldReasons = async (req, res) => {
  try {
    const reasons = await DistributionDao.getAllHoldReasons();
    res.status(200).json({
      status: true,
      message: 'Hold reasons retrieved successfully',
      data: reasons
    });
  } catch (error) {
    console.error('Error fetching hold reasons:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve hold reasons',
      error: error.message
    });
  }
};

// Get hold reason by ID
exports.getHoldReasonById = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = await DistributionDao.getHoldReasonById(id);
    
    if (!reason) {
      return res.status(404).json({
        status: false,
        message: 'Hold reason not found'
      });
    }

    res.status(200).json({
      status: true,
      message: 'Hold reason retrieved successfully',
      data: reason
    });
  } catch (error) {
    console.error('Error fetching hold reason:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve hold reason',
      error: error.message
    });
  }
};

// Create new hold reason
exports.createHoldReason = async (req, res) => {
  try {
    const { rsnEnglish, rsnSinhala, rsnTamil } = req.body;

    // Validation
    if (!rsnEnglish || !rsnSinhala || !rsnTamil) {
      return res.status(400).json({
        status: false,
        message: 'All language fields are required'
      });
    }

    // Get next index
    const nextIndex = await DistributionDao.getNextHoldReasonIndex();

    const reasonData = {
      indexNo: nextIndex,
      rsnEnglish: rsnEnglish.trim(),
      rsnSinhala: rsnSinhala.trim(),
      rsnTamil: rsnTamil.trim()
    };

    const result = await DistributionDao.createHoldReason(reasonData);

    res.status(201).json({
      status: true,
      message: 'Hold reason created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error creating hold reason:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to create hold reason',
      error: error.message
    });
  }
};

// Delete hold reason
exports.deleteHoldReason = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if trying to delete ID 1
    if (id === '1' || parseInt(id) === 1) {
      return res.status(403).json({
        status: false,
        message: 'Cannot delete the default reason (ID: 1)'
      });
    }

    const affectedRows = await DistributionDao.deleteHoldReason(id);

    if (affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: 'Hold reason not found'
      });
    }

    // After deletion, get all reasons and update their indexes
    const allReasons = await DistributionDao.getAllHoldReasons();
    const reasonsWithNewIndexes = allReasons.map((reason, index) => ({
      id: reason.id,
      indexNo: index + 1
    }));
    
    await DistributionDao.updateHoldReasonIndexes(reasonsWithNewIndexes);

    res.status(200).json({
      status: true,
      message: 'Hold reason deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting hold reason:', error);
    res.status(500).json({
      status: false,
      message: error.message || 'Failed to delete hold reason',
      error: error.message
    });
  }
};

// Update indexes after drag and drop reordering
exports.updateHoldReasonIndexes = async (req, res) => {
  try {
    const { reasons } = req.body;

    if (!reasons || !Array.isArray(reasons)) {
      return res.status(400).json({
        status: false,
        message: 'Invalid request format. Expected an array of reasons.'
      });
    }

    await DistributionDao.updateHoldReasonIndexes(reasons);

    res.status(200).json({
      status: true,
      message: 'Indexes updated successfully'
    });
  } catch (error) {
    console.error('Error updating hold reason indexes:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to update indexes',
      error: error.message
    });
  }
};

// Get next available index
exports.getNextHoldReasonIndex = async (req, res) => {
  try {
    const nextIndex = await DistributionDao.getNextHoldReasonIndex();
    res.status(200).json({
      status: true,
      data: { nextIndex }
    });
  } catch (error) {
    console.error('Error getting next hold reason index:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to get next index',
      error: error.message
    });
  }
};

exports.getTodaysDeliverieData = async (req, res) => {
  try {
    // Extract search parameters from query string
    const { regCode, invNo, searchType = 'partial' } = req.query;
    
    // Build search parameters object
    const searchParams = {};
    
    if (regCode && regCode.trim() !== '') {
      searchParams.regCode = regCode.trim();
    }
    
    if (invNo && invNo.trim() !== '') {
      searchParams.invNo = invNo.trim();
    }
    
    // Optional: Add exact match if specified
    if (searchType === 'exact') {
      searchParams.exactMatch = true;
    }
    
    // Get deliveries with optional search
    const deliveries = await DistributionDao.getAllTodaysDeliveries(searchParams);
    
    res.status(200).json({
      status: true,
      data: deliveries,
      count: deliveries.length,
      searchApplied: Object.keys(searchParams).length > 0,
      searchParams: Object.keys(searchParams).length > 0 ? searchParams : null
    });
  } catch (error) {
    console.error('Error fetching today\'s deliveries:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to fetch today\'s deliveries',
      error: error.message
    });
  }
};


exports.getTargetedCustomerOrders = async (req, res) => {
  try {
    // const offset = (page - 1) * limit;
    const { page, limit, status, sheduleDate, centerId, searchText } = await DistributionValidation.getTargetedCustomerOrdersSchema.validateAsync(req.query);

    const result = await DistributionDao.getTargetedCustomerOrdersDao(page, limit, status, sheduleDate, centerId, searchText);
    res.status(200).json({
      items: result.items,
      total: result.total
    });

    console.log(result.items);
    console.log(result.total);

  } catch (error) {
    console.error('Error getting next hold reason index:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to get next index',
      error: error.message
    });
  }
};


exports.getReturnRecievedOrders = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    // const offset = (page - 1) * limit;
    const { sheduleDate, centerId, searchText } = await DistributionValidation.getReturnRecievedDataSchema.validateAsync(req.query);

    console.log('centerId cehck', centerId)

    const companyId = 2;

      let companyCenterId;
      let deliveryLocationData;
      let cityToCenterMap = {};
      let selectedCenterInfo = null;
    
    if (centerId) {
      console.log('centerId', centerId)
      // Specific center selected
      companyCenterId = await DistributionDao.getDistributedCompanyCenter(companyId, centerId);

      console.log('companyCenterId', companyCenterId)

      if (companyCenterId?.[0]?.companyCenterId) {
        deliveryLocationData = await DistributionDao.getDeliveryChargeCity(companyCenterId[0].companyCenterId);
      }

      console.log('deliveryLocationData', deliveryLocationData)
      
      // Get the center name and regCode for the selected center
      selectedCenterInfo = await DistributionDao.getCenterName(centerId);

      console.log('selectedCenterInfo', selectedCenterInfo)
    } else {
      console.log('centerId', 'no')
      // No center selected - get all city-to-center mappings
      cityToCenterMap = await DistributionDao.getAllCityCenterMapping(companyId);

      console.log('cityToCenterMap', cityToCenterMap)
    }

    const result = await DistributionDao.getReturnRecievedDataDao(sheduleDate, centerId, deliveryLocationData, searchText);

    const items = result.items;
    const dataArray = [];

    let grandTotal = 0;

for (const order of items) {
  let effectiveCenterId = order.centerId;
  let centerName = null;
  let regCode = null;

  if (!effectiveCenterId) {
    const orderCity = (order.houseCity || order.apartmentCity || '').toLowerCase();

    if (centerId && deliveryLocationData?.length > 0) {
      if (
        orderCity &&
        deliveryLocationData.some(city => city.toLowerCase() === orderCity)
      ) {
        effectiveCenterId = centerId;
        centerName = selectedCenterInfo?.centerName;
        regCode = selectedCenterInfo?.regCode;
      }
    } 
    else if (!centerId && orderCity && cityToCenterMap[orderCity]) {
      effectiveCenterId = cityToCenterMap[orderCity].centerId;
      centerName = cityToCenterMap[orderCity].centerName;
      regCode = cityToCenterMap[orderCity].regCode;
    }
  }
  else if (centerId && effectiveCenterId === centerId) {
    centerName = selectedCenterInfo?.centerName;
    regCode = selectedCenterInfo?.regCode;
  }
  else if ((centerId === undefined || centerId === null) && effectiveCenterId) {
    const tempCenterInfo = await DistributionDao.getCenterName(effectiveCenterId);
    centerName = tempCenterInfo?.centerName;
    regCode = tempCenterInfo?.regCode;
  }

  if (!effectiveCenterId) continue;

  grandTotal += Number(order.total) || 0;

  dataArray.push({
    ...order,
    effectiveCenterId,
    centerName,
    regCode
  });
}



    res.status(200).json({
      items: dataArray,
      total: dataArray.length,
      grandTotal: grandTotal
    });

    console.log(dataArray,);
    console.log(dataArray.length);

  } catch (error) {
    console.error('Error getting next hold reason index:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to get next index',
      error: error.message
    });
  }
};