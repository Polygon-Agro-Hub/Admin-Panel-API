const certificateCompanyDao = require("../dao/CertificateCompany-dao");
const deleteFromS3 = require("../middlewares/s3delete");
const uploadFileToS3 = require("../middlewares/s3upload");
const { plantcare } = require("../startup/database");
const ValidateSchema = require("../validations/CertificateCompany-validation");

// Create a new certificate company
exports.createCertificateCompany = async (req, res) => {
  try {
    // Validate input with Joi
    const value =
      await ValidateSchema.createCertificateCompanyValidation.validateAsync(
        req.body
      );

    const {
      companyName,
      regNumber,
      taxId,
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      address,
    } = value;

    // Get userId from JWT
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized", status: false });
    }

    // Validate phone numbers
    const validatePhone = (dialCode, number, required = false) => {
      if (required && !number) return false;
      if (!number) return true;
      if (dialCode === "+94" && !/^[0-9]{9}$/.test(number)) return false;
      if (dialCode !== "+94" && !/^[0-9]+$/.test(number)) return false;
      return true;
    };

    if (!validatePhone(phoneCode1, phoneNumber1, true)) {
      return res.status(400).json({
        message:
          phoneCode1 === "+94"
            ? "Phone Number 1 must be exactly 9 digits for Sri Lanka (+94)"
            : "Phone Number 1 must contain only digits",
        status: false,
      });
    }

    if (!validatePhone(phoneCode2, phoneNumber2, false)) {
      return res.status(400).json({
        message:
          phoneCode2 === "+94"
            ? "Phone Number 2 must be exactly 9 digits for Sri Lanka (+94)"
            : "Phone Number 2 must contain only digits",
        status: false,
      });
    }

    if (phoneNumber1 && phoneNumber2 && phoneNumber1 === phoneNumber2) {
      return res.status(400).json({
        message: "Phone Number 1 and Phone Number 2 cannot be the same",
        status: false,
      });
    }

    // Check duplicate regNumber
    const existing = await certificateCompanyDao.checkByRegNumber(regNumber);
    if (existing.length > 0) {
      return res.status(400).json({
        message: `Registration number "${regNumber}" already exists. Please use a different one.`,
        status: false,
      });
    }

    const existingTaxId = await certificateCompanyDao.checkByTaxId(taxId);
    if (existingTaxId.length > 0) {
      return res.status(400).json({
        message: `Tax ID "${taxId}" already exists. Please use a different one.`,
        status: false,
      });
    }

    // Upload logo if provided
    let logoUrl = null;
    if (req.file) {
      logoUrl = await uploadFileToS3(
        req.file.buffer,
        req.file.originalname,
        "certificatecompany/logo"
      );
    }

    // Save to DB
    const insertId = await certificateCompanyDao.createCertificateCompany(
      companyName,
      regNumber,
      taxId,
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      address,
      userId,
      logoUrl
    );

    res.status(201).json({
      message: "Certificate Company Created  Successfully.",
      id: insertId,
      status: true,
    });
  } catch (err) {
    console.error("Error creating certificate company:", err);
    const message =
      err.isJoi && err.details ? err.details[0].message : err.message;
    res.status(400).json({ message, status: false });
  }
};

// Get all certificate companies
exports.getAllCertificateCompanies = async (req, res) => {
  try {
    const { search } = req.query;

    const { total, companies } =
      await certificateCompanyDao.getAllCertificateCompanies(search);

    res.json({
      companies,
      total,
    });
  } catch (err) {
    console.error("Error fetching certificate companies:", err);
    res.status(500).json({
      message: "An error occurred while fetching certificate companies",
      error: err.message,
    });
  }
};

// Get certificate company by ID
exports.getCertificateCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "ID is required", status: false });
    }

    const company = await certificateCompanyDao.getCertificateCompanyById(id);

    if (!company) {
      return res
        .status(404)
        .json({ message: "Company not found", status: false });
    }

    res.json({ status: true, company });
  } catch (err) {
    console.error("Error fetching company:", err);
    res.status(500).json({
      message: "An error occurred while fetching company details",
      error: err.message,
    });
  }
};

// Update certificate company
exports.updateCertificateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const {
      companyName,
      regNumber,
      taxId,
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      address,
    } = req.body;

    if (
      !companyName ||
      !regNumber ||
      !taxId ||
      !phoneCode1 ||
      !phoneNumber1 ||
      !address
    ) {
      return res
        .status(400)
        .json({ message: "Missing required fields", status: false });
    }

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User not found", status: false });
    }

    // Validate phone numbers
    const validatePhone = (dialCode, number, required = false) => {
      if (required && !number) return false;
      if (!number) return true;
      if (dialCode === "+94" && !/^[0-9]{9}$/.test(number)) return false;
      if (dialCode !== "+94" && !/^[0-9]+$/.test(number)) return false;
      return true;
    };

    if (!validatePhone(phoneCode1, phoneNumber1, true)) {
      return res.status(400).json({
        message:
          phoneCode1 === "+94"
            ? "Phone Number 1 must be exactly 9 digits for Sri Lanka (+94)"
            : "Phone Number 1 must contain only digits",
        status: false,
      });
    }

    if (phoneNumber2 && !validatePhone(phoneCode2, phoneNumber2, false)) {
      return res.status(400).json({
        message:
          phoneCode2 === "+94"
            ? "Phone Number 2 must be exactly 9 digits for Sri Lanka (+94)"
            : "Phone Number 2 must contain only digits",
        status: false,
      });
    }

    if (phoneNumber1 && phoneNumber2 && phoneNumber1 === phoneNumber2) {
      return res.status(400).json({
        message: "Phone Number 1 and Phone Number 2 cannot be the same",
        status: false,
      });
    }

    // Fetch current company first to check if regNumber is being changed
    const currentCompany =
      await certificateCompanyDao.getCertificateCompanyById(id);
    if (!currentCompany) {
      return res
        .status(404)
        .json({ message: "Company not found", status: false });
    }

    // Only check for duplicate registration number if it's being changed
    if (currentCompany.regNumber !== regNumber) {
      const existing = await certificateCompanyDao.checkByRegNumber(regNumber);
      if (existing.length > 0) {
        return res.status(400).json({
          message: `Registration number "${regNumber}" already exists. Please use a different one.`,
          status: false,
        });
      }
    }

    const existingTaxId = await certificateCompanyDao.checkByTaxId(taxId);
    if (existingTaxId.length > 0) {
      return res.status(400).json({
        message: `Tax ID "${taxId}" already exists. Please use a different one.`,
        status: false,
      });
    }

    let logoUrl = currentCompany?.logo || null;

    // If new logo uploaded
    if (req.file) {
      const uploadedUrl = await uploadFileToS3(
        req.file.buffer,
        req.file.originalname,
        "certificatecompany/logo"
      );
      logoUrl = uploadedUrl;

      // Delete old logo if exists
      if (currentCompany?.logo) {
        await deleteFromS3(currentCompany.logo);
      }
    }

    // Update record
    const updated = await certificateCompanyDao.updateCertificateCompany(
      id,
      companyName,
      regNumber,
      taxId,
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      address,
      userId,
      logoUrl
    );

    if (!updated) {
      return res
        .status(404)
        .json({ message: "Company not found", status: false });
    }

    res.json({
      message: "Certificate Company Updated Successfully",
      status: true,
      logo: logoUrl,
    });
  } catch (err) {
    console.error("Error updating certificate company:", err);
    res.status(500).json({
      message: "An error occurred while updating certificate company",
      error: err.message,
    });
  }
};

// Delete a certificate company by ID
exports.deleteCertificateCompany = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate id param
    const { error } = ValidateSchema.getByIdSchema.validate({ id });
    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
        status: false,
      });
    }

    // Check if company exists
    const existing = await certificateCompanyDao.getCertificateCompanyById(id);
    if (!existing || existing.length === 0) {
      return res.status(404).json({
        message: "Certificate company not found",
        status: false,
      });
    }

    // Perform delete
    const deleted = await certificateCompanyDao.deleteCertificateCompany(id);

    if (!deleted) {
      return res.status(404).json({
        message: "Certificate company not found or already deleted",
        status: false,
      });
    }

    res.json({
      message: "Certificate company deleted successfully",
      status: true,
    });
  } catch (err) {
    console.error("Error deleting certificate company:", err);
    res.status(500).json({
      message: "An error occurred while deleting certificate company",
      error: err.message,
      status: false,
    });
  }
};

// Get all certificate companies names only
exports.getAllCertificateCompaniesNamesAndIdOnly = async (req, res) => {
  try {
    const companies =
      await certificateCompanyDao.getAllCertificateCompaniesNamesOnly();
    res.json(companies);
  } catch (err) {
    console.error("Error fetching certificate companies names:", err);
    res.status(500).json({
      message: "An error occurred while fetching certificate companies names",
      error: err.message,
    });
  }
};

// Create a new certificate
exports.createCertificate = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized", status: false });
    }

    // Validate request body
    const validated =
      await ValidateSchema.createCertificateValidation.validateAsync(req.body);

    let {
      srtcomapnyId,
      srtName,
      srtNumber,
      applicable,
      accreditation,
      price,
      timeLine,
      commission,
      serviceAreas,
      cropIds,
      scope,
    } = validated;

    // Normalize serviceAreas
    if (typeof serviceAreas === "string") {
      try {
        const parsed = JSON.parse(serviceAreas);
        if (Array.isArray(parsed)) {
          serviceAreas = parsed.join(",");
        } else {
          serviceAreas = serviceAreas;
        }
      } catch {
        serviceAreas = serviceAreas;
      }
    } else if (Array.isArray(serviceAreas)) {
      serviceAreas = serviceAreas.join(",");
    }

    // Normalize cropIds
    if (typeof cropIds === "string") {
      try {
        const parsed = JSON.parse(cropIds);
        if (Array.isArray(parsed)) {
          cropIds = parsed;
        } else {
          cropIds = [parsed];
        }
      } catch {
        cropIds = cropIds.split(",").map((s) => s.trim());
      }
    }
    if (!Array.isArray(cropIds)) cropIds = [cropIds];

    // Upload PDF
    let tearmsUrl = null;
    if (req.file) {
      tearmsUrl = await uploadFileToS3(
        req.file.buffer,
        req.file.originalname,
        "certificate/terms"
      );
    }

    // Insert certificat
    const certificateId = await certificateCompanyDao.createCertificate({
      srtcomapnyId,
      srtName,
      srtNumber,
      applicable,
      accreditation,
      serviceAreas,
      price,
      timeLine,
      commission,
      tearms: tearmsUrl,
      scope,
      modifyBy: userId,
    });

    await certificateCompanyDao.addCertificateCrops(certificateId, cropIds);

    res.json({
      message: "Certificate created successfully",
      status: true,
      certificateId,
    });
  } catch (err) {
    console.error("Error creating certificate:", err);
    const message =
      err.isJoi && err.details ? err.details[0].message : err.message;
    res.status(400).json({ message, status: false });
  }
};

// Get all certificates
exports.getAllCertificates = async (req, res) => {
  try {
    const { quaction, area, company, searchText } = req.query;
    console.log(req.params);

    const result = await certificateCompanyDao.getAllCertificatesDao(
      quaction,
      area,
      company,
      searchText
    );

    if (result.length === 0) {
      return res.json({ message: "No Certificates founded", data: [] });
    }

    console.log("Successfully retrieved collection centre Complains");
    res.json({ message: "Certificates founded", data: result });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching news:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching center complains" });
  }
};

// Get certificate by ID
exports.getCertificateDetailsById = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await certificateCompanyDao.getCertificateById(id);
    if (!data) {
      return res
        .status(404)
        .json({ message: "Certificate not found", status: false });
    }

    // Convert serviceAreas string -> array
    if (data.serviceAreas && typeof data.serviceAreas === "string") {
      data.serviceAreas = data.serviceAreas
        .split(",")
        .map((area) => area.trim())
        .filter((area) => area.length > 0);
    }

    // Fetch crops related to this certificate
    const crops = await certificateCompanyDao.getCertificateCrops(id);
    data.cropIds = crops.map((c) => c.cropId);

    res.json({
      message: "Certificate details fetched successfully",
      status: true,
      data,
    });
  } catch (err) {
    console.error("Error fetching certificate:", err);
    res.status(500).json({ message: "Internal server error", status: false });
  }
};

// Update certificate
exports.updateCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized", status: false });
    }

    // Validate request body
    const validated =
      await ValidateSchema.updateCertificateValidation.validateAsync(req.body);

    let {
      srtcomapnyId,
      srtName,
      srtNumber,
      applicable,
      accreditation,
      price,
      timeLine,
      commission,
      serviceAreas,
      cropIds,
      scope,
    } = validated;

    // Normalize fields (same as create)
    if (typeof serviceAreas === "string") {
      try {
        const parsed = JSON.parse(serviceAreas);
        serviceAreas = Array.isArray(parsed) ? parsed.join(",") : serviceAreas;
      } catch {
        serviceAreas = serviceAreas;
      }
    } else if (Array.isArray(serviceAreas)) {
      serviceAreas = serviceAreas.join(",");
    }

    if (typeof cropIds === "string") {
      try {
        const parsed = JSON.parse(cropIds);
        cropIds = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        cropIds = cropIds.split(",").map((s) => s.trim());
      }
    }
    if (!Array.isArray(cropIds)) cropIds = [cropIds];

    // Handle file upload
    let tearmsUrl = null;
    if (req.file) {
      tearmsUrl = await uploadFileToS3(
        req.file.buffer,
        req.file.originalname,
        "certificate/terms"
      );
    }

    // Update certificate
    await certificateCompanyDao.updateCertificate({
      id,
      srtcomapnyId,
      srtName,
      srtNumber,
      applicable,
      accreditation,
      serviceAreas,
      price,
      timeLine,
      commission,
      tearms: tearmsUrl,
      scope,
      modifyBy: userId,
    });

    // Update crops
    await certificateCompanyDao.deleteCertificateCrops(id);
    await certificateCompanyDao.addCertificateCrops(id, cropIds);

    res.json({ message: "Certificate updated successfully", status: true });
  } catch (err) {
    console.error("Error updating certificate:", err);
    const message =
      err.isJoi && err.details ? err.details[0].message : err.message;
    res.status(400).json({ message, status: false });
  }
};

// Delete certificate
exports.deleteCertificate = async (req, res) => {
  try {
    const { id } = req.params;

    const exists = await certificateCompanyDao.getCertificateById(id);
    if (!exists) {
      return res
        .status(404)
        .json({ message: "Certificate not found", status: false });
    }

    await certificateCompanyDao.deleteCertificateCrops(id);
    await certificateCompanyDao.deleteCertificate(id);

    res.json({ message: "Certificate deleted successfully", status: true });
  } catch (err) {
    console.error("Error deleting certificate:", err);
    res.status(500).json({ message: "Internal server error", status: false });
  }
};

// Create Questionnaire
exports.createQuestionnaire = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized", status: false });
    }

    // Validate input using Joi
    const { certificateId, questions } =
      await ValidateSchema.createQuestionnaireSchema.validateAsync(req.body, {
        abortEarly: false,
      });

    // Validate duplicates manually (still useful)
    const qNos = questions.map((q) => q.qNo);
    if (new Set(qNos).size !== qNos.length) {
      return res.status(400).json({
        message: "Duplicate question numbers are not allowed",
        status: false,
      });
    }

    // DB insert
    const dbResult = await certificateCompanyDao.bulkInsertQuestionnaires(
      certificateId,
      questions
    );

    res.json({
      message: "Questionnaires created successfully",
      status: true,
      insertedId: dbResult.insertId,
      affectedRows: dbResult.affectedRows,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({
        message: "Validation failed",
        details: err.details.map((d) => d.message),
        status: false,
      });
    }
    console.error("Error creating questionnaires:", err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// Get Questionnaire List
exports.getQuestionnaireList = async (req, res) => {
  try {
    const { certificateId } =
      await ValidateSchema.getQuestionnaireListSchema.validateAsync(req.params);

    const questionnaires = await certificateCompanyDao.getQuestionnaireList(
      certificateId
    );

    res.json({
      message: "Questionnaire list fetched successfully",
      status: true,
      data: questionnaires,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({
        message: "Validation failed",
        details: err.details.map((d) => d.message),
        status: false,
      });
    }
    console.error("Error fetching questionnaire list:", err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// Update Questionnaire
exports.updateQuestionnaire = async (req, res) => {
  try {
    const validated =
      await ValidateSchema.updateQuestionnaireSchema.validateAsync(
        { ...req.params, ...req.body },
        { abortEarly: false }
      );

    const result = await certificateCompanyDao.updateQuestionnaire(
      validated.id,
      validated
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Questionnaire not found", status: false });
    }

    res.json({ message: "Questionnaire updated successfully", status: true });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({
        message: "Validation failed",
        details: err.details.map((d) => d.message),
        status: false,
      });
    }
    console.error("Error updating questionnaire:", err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// Delete Questionnaire
exports.deleteQuestionnaire = async (req, res) => {
  try {
    const { id } = await ValidateSchema.deleteQuestionnaireSchema.validateAsync(
      req.params
    );

    const result = await certificateCompanyDao.deleteQuestionnaire(id);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Questionnaire not found", status: false });
    }

    res.json({
      message: "Questionnaire deleted successfully",
      status: true,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({
        message: "Validation failed",
        details: err.details.map((d) => d.message),
        status: false,
      });
    }
    console.error("Error deleting questionnaire:", err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// Create Farmer Cluster with bulk farmers
exports.createFarmerCluster = async (req, res) => {
  let connection;

  try {
    connection = await plantcare.promise().getConnection();
    await connection.beginTransaction();

    const userId = req.user?.userId;
    if (!userId) {
      await connection.rollback();
      return res.status(401).json({
        message: "Unauthorized",
        status: false,
      });
    }

    // Validate input
    const { clusterName, farmerNICs } =
      await ValidateSchema.createFarmerClusterSchema.validateAsync(req.body, {
        abortEarly: false,
      });

    const uniqueNICs = [...new Set(farmerNICs.map((nic) => nic.trim()))];

    // Check duplicate cluster name
    const clusterExists = await certificateCompanyDao.isClusterNameExists(
      clusterName,
      connection
    );
    if (clusterExists) {
      await connection.rollback();
      return res.status(400).json({
        message: "Cluster name already exists",
        status: false,
      });
    }

    // Check NICs existence
    const nicCheckResult = await certificateCompanyDao.checkNICsExist(
      uniqueNICs,
      connection
    );
    if (nicCheckResult.missingNICs.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "Some NIC numbers are not registered in the system",
        status: false,
        missingNICs: nicCheckResult.missingNICs,
        existingNICs: nicCheckResult.existingNICs,
      });
    }

    // Create cluster
    const clusterResult = await certificateCompanyDao.createFarmCluster(
      clusterName,
      userId,
      connection
    );
    const clusterId = clusterResult.insertId;

    // Get farmer IDs
    const farmerMap = await certificateCompanyDao.getFarmerIdsByNICs(
      uniqueNICs,
      connection
    );
    const farmerIds = uniqueNICs.map((nic) => farmerMap[nic]);

    // Bulk insert farmers
    const bulkInsertResult =
      await certificateCompanyDao.bulkInsertClusterFarmers(
        clusterId,
        farmerIds,
        connection
      );

    await connection.commit();

    res.status(201).json({
      message: "Farmer cluster created successfully",
      status: true,
      data: {
        clusterId,
        clusterName,
        farmersAdded: bulkInsertResult.affectedRows,
        totalFarmers: uniqueNICs.length,
      },
    });
  } catch (err) {
    if (connection) await connection.rollback();

    // Handle duplicate cluster name from MySQL as safety
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        message: "Cluster name already exists",
        status: false,
      });
    }

    if (err.isJoi) {
      return res.status(400).json({
        message: "Validation failed",
        status: false,
        details: err.details.map((d) => d.message),
      });
    }

    console.error("Error creating farmer cluster:", err);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// Add a single farmer to an existing cluster
exports.addSingleFarmerToCluster = async (req, res) => {
  let connection;

  try {
    connection = await plantcare.promise().getConnection();
    await connection.beginTransaction();

    const userId = req.user?.userId;
    if (!userId) {
      await connection.rollback();
      return res.status(401).json({ message: "Unauthorized", status: false });
    }

    const clusterId = parseInt(req.params.clusterId);
    if (!clusterId) {
      await connection.rollback();
      return res.status(400).json({
        message: "Cluster ID is required",
        status: false,
      });
    }

    const { nic } = req.body;
    if (!nic?.trim()) {
      await connection.rollback();
      return res.status(400).json({
        message: "NIC number is required",
        status: false,
      });
    }

    // Step 1: Check if user with NIC exists
    const farmerId = await certificateCompanyDao.getFarmerIdByNIC(
      nic.trim(),
      connection
    );
    if (!farmerId) {
      await connection.rollback();
      return res.status(400).json({
        message: `No farmer exists using this NIC`,
        status: false,
      });
    }

    // Step 2: Check if farmer already in cluster
    const exists = await certificateCompanyDao.isFarmerInCluster(
      clusterId,
      farmerId,
      connection
    );
    if (exists) {
      await connection.rollback();
      return res.status(400).json({
        message: `This farmer already added to the cluster`,
        status: false,
      });
    }

    // Step 3: Insert farmer into cluster
    await certificateCompanyDao.insertFarmerIntoCluster(
      clusterId,
      farmerId,
      connection
    );

    await connection.commit();

    return res.status(201).json({
      message: `User added to cluster successfully`,
      status: true,
      data: { clusterId, farmerId, nic },
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error adding farmer to cluster:", err);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// Get all farmer clusters
exports.getAllFarmerClusters = async (req, res) => {
  let connection;
  try {
    connection = await plantcare.promise().getConnection();

    const search = req.query.search ? req.query.search.trim() : "";

    const clusters = await certificateCompanyDao.getAllFarmerClusters(
      connection,
      search
    );

    res.status(200).json({
      message: "Farmer clusters fetched successfully",
      status: true,
      data: clusters,
    });
  } catch (err) {
    console.error("Error fetching farmer clusters:", err);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// Delete cluster endpoint
exports.deleteFarmerCluster = async (req, res) => {
  let connection;
  try {
    connection = await plantcare.promise().getConnection();

    const clusterId = req.params.id;
    if (!clusterId) {
      return res.status(400).json({
        message: "Cluster ID is required",
        status: false,
      });
    }

    const result = await certificateCompanyDao.deleteFarmClusterWithFarmers(
      clusterId,
      connection
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Cluster not found",
        status: false,
      });
    }

    res.status(200).json({
      message: "Cluster and its farmers deleted successfully",
      status: true,
    });
  } catch (err) {
    console.error("Error deleting cluster:", err);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// Get cluster users with optional search
exports.getClusterUsers = async (req, res) => {
  let connection;
  try {
    connection = await plantcare.promise().getConnection();

    const clusterId = parseInt(req.params.clusterId);
    const search = req.query.search ? req.query.search.trim() : "";

    if (!clusterId) {
      return res
        .status(400)
        .json({ message: "Cluster ID is required", status: false });
    }

    const users = await certificateCompanyDao.getUsersByClusterId(
      clusterId,
      search,
      connection
    );

    res.status(200).json({
      message: "Users fetched successfully",
      status: true,
      data: users,
    });
  } catch (err) {
    console.error("Error fetching cluster users:", err);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// Delete specific user from a cluster
exports.deleteClusterUser = async (req, res) => {
  let connection;
  try {
    connection = await plantcare.promise().getConnection();

    const clusterId = parseInt(req.params.clusterId);
    const farmerId = parseInt(req.params.farmerId);

    if (!clusterId || !farmerId) {
      return res.status(400).json({
        message: "Cluster ID and Farmer ID are required",
        status: false,
      });
    }

    const deleted = await certificateCompanyDao.deleteClusterUser(
      clusterId,
      farmerId,
      connection
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ message: "User not found in this cluster", status: false });
    }

    res.status(200).json({
      message: "User removed from cluster successfully",
      status: true,
    });
  } catch (err) {
    console.error("Error deleting cluster user:", err);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// Update farmer cluster name
exports.updateFarmerCluster = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const { clusterName } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized user",
      });
    }

    // Validate input
    const { error } = ValidateSchema.updateFarmerClusterSchema.validate({
      clusterName,
    });
    if (error) {
      return res.status(400).json({
        status: false,
        message: error.details[0].message,
      });
    }

    const connection = await plantcare.promise().getConnection();

    // Check if cluster exists
    const [existing] = await connection.query(
      `SELECT id FROM farmcluster WHERE id = ?`,
      [clusterId]
    );
    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({
        status: false,
        message: "Cluster not found",
      });
    }

    // Check duplicate name
    const nameExists = await certificateCompanyDao.isClusterNameExists(
      clusterName,
      connection
    );
    if (nameExists) {
      connection.release();
      return res.status(400).json({
        status: false,
        message: "Cluster name already exists",
      });
    }

    // Update cluster name
    await certificateCompanyDao.updateClusterName(
      clusterId,
      clusterName,
      userId,
      connection
    );

    connection.release();
    return res.status(200).json({
      status: true,
      message: "Cluster name updated successfully",
    });
  } catch (err) {
    console.error("Error updating cluster:", err);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};
