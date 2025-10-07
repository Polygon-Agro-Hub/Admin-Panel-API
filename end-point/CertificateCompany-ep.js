const certificateCompanyDao = require("../dao/CertificateCompany-dao");
const uploadFileToS3 = require("../middlewares/s3upload");

// Create a new certificate company
exports.createCertificateCompany = async (req, res) => {
  try {
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

    // Get userId from JWT
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized. User ID not found.",
        status: false,
      });
    }

    // Phone number validation
    const validatePhone = (dialCode, number, required = false) => {
      if (required && !number) return false;

      if (!number) return true;

      // Sri Lanka (+94) → exactly 9 digits
      if (dialCode === "+94" && !/^[0-9]{9}$/.test(number)) return false;

      // Other countries → only numbers allowed
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

    // Same number check
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

    // Create new record
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

    return res.status(201).json({
      message: "Certificate company created successfully",
      id: insertId,
      status: true,
    });
  } catch (err) {
    console.error("Error creating certificate company:", err);
    res.status(500).json({
      message: "An error occurred while creating certificate company",
      error: err.message,
    });
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

    const deleted = await certificateCompanyDao.deleteCertificateCompany(id);

    if (!deleted) {
      return res.status(404).json({
        message: "Certificate company not found",
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

    // Extract fields from FormData
    const {
      srtcomapnyId,
      srtName,
      srtNumber,
      applicable,
      accreditation,
      price,
      timeLine,
      commission,
      scope,
    } = req.body;

    let serviceAreas = req.body.serviceAreas || [];
    let cropIds = req.body.cropIds || [];

    if (!Array.isArray(serviceAreas)) serviceAreas = [serviceAreas];
    if (!Array.isArray(cropIds)) cropIds = [cropIds];

    // Basic Validation
    if (!srtcomapnyId) {
      return res
        .status(400)
        .json({ message: "Company ID is required", status: false });
    }
    if (!srtName || srtName.trim().length === 0) {
      return res
        .status(400)
        .json({ message: "Certificate name is required", status: false });
    }
    if (!srtNumber) {
      return res
        .status(400)
        .json({ message: "Certificate number is required", status: false });
    }
    if (!applicable) {
      return res
        .status(400)
        .json({ message: "Applicable field is required", status: false });
    }
    if (!accreditation) {
      return res
        .status(400)
        .json({ message: "Accreditation is required", status: false });
    }

    // Number validations
    if (price && isNaN(price)) {
      return res
        .status(400)
        .json({ message: "Price must be a valid number", status: false });
    }
    if (
      commission &&
      (isNaN(commission) || commission < 0 || commission > 100)
    ) {
      return res.status(400).json({
        message: "Enter a valid commission between 0 and 100",
        status: false,
      });
    }

    // Arrays validation
    if (!Array.isArray(serviceAreas) || serviceAreas.length === 0) {
      return res.status(400).json({
        message: "At least one service area is required",
        status: false,
      });
    }
    if (!Array.isArray(cropIds) || cropIds.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one crop is required", status: false });
    }

    // Upload PDF if exists
    let tearmsUrl = null;
    if (req.file) {
      tearmsUrl = await uploadFileToS3(
        req.file.buffer,
        req.file.originalname,
        "certificate/terms"
      );
    }

    // Insert certificate
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

    //  Insert crops
    await certificateCompanyDao.addCertificateCrops(certificateId, cropIds);

    res.json({
      message: "Certificate created successfully",
      status: true,
      certificateId,
    });
  } catch (err) {
    console.error("Error creating certificate:", err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// Create Questionnaire
exports.createQuestionnaire = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized", status: false });
    }

    const { certificateId, questions } = req.body;

    // Base validations
    if (!certificateId) {
      return res
        .status(400)
        .json({ message: "Certificate ID is required", status: false });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one question is required", status: false });
    }

    // Validate duplicates in qNo
    const qNos = questions.map((q) => q.qNo);
    if (new Set(qNos).size !== qNos.length) {
      return res
        .status(400)
        .json({
          message: "Duplicate question numbers are not allowed",
          status: false,
        });
    }

    // Validate each question
    for (const q of questions) {
      if (!q.qNo || isNaN(q.qNo) || q.qNo <= 0) {
        return res
          .status(400)
          .json({
            message: `Invalid question number for qNo: ${q.qNo}`,
            status: false,
          });
      }
      if (!q.type || typeof q.type !== "string") {
        return res
          .status(400)
          .json({
            message: `Type is required for qNo: ${q.qNo}`,
            status: false,
          });
      }
      if (!q.qEnglish || q.qEnglish.trim().length === 0) {
        return res
          .status(400)
          .json({
            message: `English question text is required for qNo: ${q.qNo}`,
            status: false,
          });
      }
    }

    // Insert into DB
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