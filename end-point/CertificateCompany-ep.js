const certificateCompanyDao = require("../dao/CertificateCompany-dao");
const uploadFileToS3 = require("../middlewares/s3upload");
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

    // Validate Sri Lankan phone rule
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
      return res.json({
        message: "This registration number already exists!",
        status: false,
      });
    }

    const insertId = await certificateCompanyDao.createCertificateCompany(
      companyName,
      regNumber,
      taxId,
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      address,
      userId
    );

    res.status(201).json({
      message: "Certificate company created successfully",
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
    const userId = req.user.userId;
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
      return res.status(400).json({
        message: "Missing required fields",
        status: false,
      });
    }

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized. User ID not found.",
        status: false,
      });
    }

    // --- Same validations as create ---
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

    // Check duplicate regNumber (excluding current id)
    const existing = await certificateCompanyDao.checkByRegNumber(regNumber);
    if (existing.length > 0 && existing[0].id != id) {
      return res.json({
        message: "This registration number already exists!",
        status: false,
      });
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
      userId
    );

    if (!updated) {
      return res
        .status(404)
        .json({ message: "Company not found", status: false });
    }

    res.json({
      message: "Certificate company updated successfully",
      status: true,
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

    // --- Normalize serviceAreas ---
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

    // --- Normalize cropIds ---
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

    // --- Upload PDF (optional) ---
    let tearmsUrl = null;
    if (req.file) {
      tearmsUrl = await uploadFileToS3(
        req.file.buffer,
        req.file.originalname,
        "certificate/terms"
      );
    }

    // --- Insert certificate ---
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

exports.getAllCertificates = async (req, res) => {
  try {
    const {quaction, area, company, searchText} = req.query;
    console.log(req.params);
    
    const result = await certificateCompanyDao.getAllCertificatesDao(quaction, area, company, searchText);

    if (result.length === 0) {
      return res
        .json({ message: "No Certificates founded", data: [] });
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
