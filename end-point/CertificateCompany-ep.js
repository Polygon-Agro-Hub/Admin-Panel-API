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

    // ===== Duplicate Checks =====
    const duplicateErrors = [];

    // Registration Number
    const existingRegNumber = await certificateCompanyDao.checkByRegNumber(
      regNumber
    );
    if (existingRegNumber.length > 0) {
      duplicateErrors.push(`Registration Number`);
    }

    // Tax ID
    const existingTaxId = await certificateCompanyDao.checkByTaxId(taxId);
    if (existingTaxId.length > 0) {
      duplicateErrors.push(`TAX ID`);
    }

    // Phone Numbers - Check for duplicates
    const existingPhones = await certificateCompanyDao.checkByPhoneNumbers(
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2
    );

    if (existingPhones.length > 0) {
      // Check which specific phone numbers are duplicates
      existingPhones.forEach((existing) => {
        if (
          existing.phoneCode1 === phoneCode1 &&
          existing.phoneNumber1 === phoneNumber1
        ) {
          if (!duplicateErrors.includes("Phone Number - 1")) {
            duplicateErrors.push("Phone Number - 1");
          }
        }
        if (
          phoneNumber2 &&
          existing.phoneCode2 === phoneCode2 &&
          existing.phoneNumber2 === phoneNumber2
        ) {
          if (!duplicateErrors.includes("Phone Number - 2")) {
            duplicateErrors.push("Phone Number - 2");
          }
        }
      });
    }

    // Return combined error
    if (duplicateErrors.length > 0) {
      return res.status(400).json({
        message: `${duplicateErrors.join(", ")} already exists`,
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
      message: "Certificate Company Created Successfully.",
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
      if (dialCode === "+94") {
        // Must be exactly 9 digits AND start with 7
        if (!/^[0-9]{9}$/.test(number)) return false;
        if (!number.startsWith('7')) return false;
      }
      if (dialCode !== "+94" && !/^[0-9]+$/.test(number)) return false;
      return true;
    };

    if (!validatePhone(phoneCode1, phoneNumber1, true)) {
      return res.status(400).json({
        message:
          phoneCode1 === "+94"
            ? "Phone Number 1 must be exactly 9 digits and start with 7 for Sri Lanka (+94)"
            : "Phone Number 1 must contain only digits",
        status: false,
      });
    }

    if (phoneNumber2 && !validatePhone(phoneCode2, phoneNumber2, false)) {
      return res.status(400).json({
        message:
          phoneCode2 === "+94"
            ? "Phone Number 2 must be exactly 9 digits and start with 7 for Sri Lanka (+94)"
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

    // Fetch current company first to check if fields are being changed
    const currentCompany =
      await certificateCompanyDao.getCertificateCompanyById(id);
    if (!currentCompany) {
      return res
        .status(404)
        .json({ message: "Company not found", status: false });
    }

    // ===== Duplicate Checks =====
    const duplicateErrors = [];

    // Only check for duplicate registration number if it's being changed
    if (currentCompany.regNumber !== regNumber) {
      const existingRegNumber = await certificateCompanyDao.checkByRegNumber(
        regNumber
      );
      if (existingRegNumber.length > 0) {
        duplicateErrors.push(`Registration Number`);
      }
    }

    // Only check for duplicate Tax ID if it's being changed
    if (currentCompany.taxId !== taxId) {
      const existingTaxId = await certificateCompanyDao.checkByTaxId(taxId);
      if (existingTaxId.length > 0) {
        duplicateErrors.push(`TAX ID`);
      }
    }

    // Check for duplicate phone numbers, excluding current company
    const existingPhones = await certificateCompanyDao.checkByPhoneNumbers(
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      id // Exclude current company
    );

    if (existingPhones.length > 0) {
      // Check which specific phone numbers are duplicates
      existingPhones.forEach((existing) => {
        // Check if Phone 1 is duplicate (and if it's being changed)
        if (
          (currentCompany.phoneCode1 !== phoneCode1 ||
            currentCompany.phoneNumber1 !== phoneNumber1) &&
          existing.phoneCode1 === phoneCode1 &&
          existing.phoneNumber1 === phoneNumber1
        ) {
          if (!duplicateErrors.includes("Phone Number - 1")) {
            duplicateErrors.push("Phone Number - 1");
          }
        }

        // Check if Phone 2 is duplicate (and if it's being changed or newly added)
        if (phoneNumber2) {
          const isPhone2Changed =
            currentCompany.phoneCode2 !== phoneCode2 ||
            currentCompany.phoneNumber2 !== phoneNumber2;

          if (
            isPhone2Changed &&
            existing.phoneCode2 === phoneCode2 &&
            existing.phoneNumber2 === phoneNumber2
          ) {
            if (!duplicateErrors.includes("Phone Number - 2")) {
              duplicateErrors.push("Phone Number - 2");
            }
          }
        }
      });
    }

    // Return combined error
    if (duplicateErrors.length > 0) {
      return res.status(400).json({
        message: `${duplicateErrors.join(", ")} already exists`,
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
      srtNameSinhala,
      srtNameTamil,
      srtNumber,
      applicable,
      accreditation,
      price,
      timeLine,
      commission,
      serviceAreas,
      cropIds,
      scope,
      noOfVisit,
    } = validated;

    // ===== Duplicate Checks =====
    const duplicateErrors = [];

    // Check for duplicate certificate name (English)
    const existingCertificateName =
      await certificateCompanyDao.checkCertificateNameExists(srtName);
    if (existingCertificateName.length > 0) {
      duplicateErrors.push(`Certificate Name (English)`);
    }

    // Check for duplicate certificate name (Sinhala) if provided
    if (srtNameSinhala && srtNameSinhala.trim() !== "") {
      const existingSinhalaName =
        await certificateCompanyDao.checkCertificateSinhalaNameExists(
          srtNameSinhala
        );
      if (existingSinhalaName.length > 0) {
        duplicateErrors.push(`Certificate Name (Sinhala)`);
      }
    }

    // Check for duplicate certificate name (Tamil) if provided
    if (srtNameTamil && srtNameTamil.trim() !== "") {
      const existingTamilName =
        await certificateCompanyDao.checkCertificateTamilNameExists(
          srtNameTamil
        );
      if (existingTamilName.length > 0) {
        duplicateErrors.push(`Certificate Name (Tamil)`);
      }
    }

    // Check for duplicate certificate number
    const existingCertificateNumber =
      await certificateCompanyDao.checkCertificateNumberExists(srtNumber);
    if (existingCertificateNumber.length > 0) {
      duplicateErrors.push(`Certificate Number`);
    }

    // Return combined error
    if (duplicateErrors.length > 0) {
      return res.status(400).json({
        message: `${duplicateErrors.join(", ")} already exists`,
        status: false,
      });
    }

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

    // Normalize and validate cropIds
    let normalizedCropIds = [];
    if (cropIds) {
      if (typeof cropIds === "string") {
        try {
          const parsed = JSON.parse(cropIds);
          if (Array.isArray(parsed)) {
            normalizedCropIds = parsed;
          } else {
            normalizedCropIds = [parsed];
          }
        } catch {
          normalizedCropIds = cropIds
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s);
        }
      } else if (Array.isArray(cropIds)) {
        normalizedCropIds = cropIds;
      }
    }

    // Convert to numbers and validate
    normalizedCropIds = normalizedCropIds
      .map((cropId) => parseInt(cropId))
      .filter((cropId) => !isNaN(cropId) && cropId > 0);

    console.log("Processed crop IDs:", normalizedCropIds);

    // Upload PDF for terms (tearmsFile)
    let tearmsUrl = null;
    if (req.files && req.files.tearmsFile && req.files.tearmsFile[0]) {
      const termsFile = req.files.tearmsFile[0];

      // Validate it's a PDF
      if (termsFile.mimetype !== "application/pdf") {
        return res.status(400).json({
          message: "Terms file must be a PDF",
          status: false,
        });
      }

      tearmsUrl = await uploadFileToS3(
        termsFile.buffer,
        termsFile.originalname,
        "certificate/terms"
      );
    } else {
      // If no terms file was uploaded, return error
      return res.status(400).json({
        message: "Payment Terms File is required",
        status: false,
      });
    }

    // Upload logo file
    let logoUrl = null;
    if (req.files && req.files.logo && req.files.logo[0]) {
      const logoFile = req.files.logo[0];

      // Validate logo file type (image only)
      if (!logoFile.mimetype.startsWith("image/")) {
        return res.status(400).json({
          message: "Logo must be a valid image file (JPEG, JPG, PNG, WebP)",
          status: false,
        });
      }

      // Validate file size (5MB limit for images)
      const maxSizeBytes = 5 * 1024 * 1024;
      if (logoFile.size > maxSizeBytes) {
        return res.status(400).json({
          message: "Logo must be smaller than 5 MB",
          status: false,
        });
      }

      logoUrl = await uploadFileToS3(
        logoFile.buffer,
        logoFile.originalname,
        "certificate/logo"
      );
    }

    // Insert certificate with new fields
    const certificateId = await certificateCompanyDao.createCertificate({
      srtcomapnyId,
      srtName,
      srtNameSinhala,
      srtNameTamil,
      srtNumber,
      applicable,
      accreditation,
      serviceAreas,
      price,
      timeLine,
      commission,
      tearms: tearmsUrl,
      scope,
      logo: logoUrl,
      noOfVisit,
      modifyBy: userId,
    });

    // Add crops only if we have valid crop IDs
    if (normalizedCropIds.length > 0) {
      await certificateCompanyDao.addCertificateCrops(
        certificateId,
        normalizedCropIds
      );
    }

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
      srtNameSinhala,
      srtNameTamil,
      srtNumber,
      applicable,
      accreditation,
      price,
      timeLine,
      commission,
      serviceAreas,
      cropIds,
      scope,
      noOfVisit,
    } = validated;

    // Normalize serviceAreas
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

    // Normalize and validate cropIds
    let normalizedCropIds = [];
    if (cropIds) {
      if (typeof cropIds === "string") {
        try {
          const parsed = JSON.parse(cropIds);
          if (Array.isArray(parsed)) {
            normalizedCropIds = parsed;
          } else {
            normalizedCropIds = [parsed];
          }
        } catch {
          normalizedCropIds = cropIds
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s);
        }
      } else if (Array.isArray(cropIds)) {
        normalizedCropIds = cropIds;
      }
    }

    // Convert to numbers and validate
    normalizedCropIds = normalizedCropIds
      .map((cropId) => parseInt(cropId))
      .filter((cropId) => !isNaN(cropId) && cropId > 0);

    console.log("Processed crop IDs:", normalizedCropIds);

    // Get current certificate data first
    const currentCertificate = await certificateCompanyDao.getCertificateById(
      id
    );
    if (!currentCertificate) {
      return res
        .status(404)
        .json({ message: "Certificate not found", status: false });
    }

    // ===== Duplicate Checks =====
    const duplicateErrors = [];

    // Only check for duplicate certificate name (English) if it's being changed
    if (currentCertificate.srtName !== srtName) {
      const existingCertificateName =
        await certificateCompanyDao.checkCertificateNameExists(srtName, id);
      if (existingCertificateName.length > 0) {
        duplicateErrors.push(`Certificate Name (English)`);
      }
    }

    // Only check for duplicate certificate name (Sinhala) if it's being changed and not empty
    if (
      srtNameSinhala &&
      currentCertificate.srtNameSinhala !== srtNameSinhala
    ) {
      const existingSinhalaName =
        await certificateCompanyDao.checkCertificateSinhalaNameExists(
          srtNameSinhala,
          id
        );
      if (existingSinhalaName.length > 0) {
        duplicateErrors.push(`Certificate Name (Sinhala)`);
      }
    }

    // Only check for duplicate certificate name (Tamil) if it's being changed and not empty
    if (srtNameTamil && currentCertificate.srtNameTamil !== srtNameTamil) {
      const existingTamilName =
        await certificateCompanyDao.checkCertificateTamilNameExists(
          srtNameTamil,
          id
        );
      if (existingTamilName.length > 0) {
        duplicateErrors.push(`Certificate Name (Tamil)`);
      }
    }

    // Only check for duplicate certificate number if it's being changed
    if (currentCertificate.srtNumber !== srtNumber) {
      const existingCertificateNumber =
        await certificateCompanyDao.checkCertificateNumberExists(srtNumber, id);
      if (existingCertificateNumber.length > 0) {
        duplicateErrors.push(`Certificate Number`);
      }
    }

    // Return combined error
    if (duplicateErrors.length > 0) {
      return res.status(400).json({
        message: `${duplicateErrors.join(", ")} already exists`,
        status: false,
      });
    }

    let tearmsUrl = currentCertificate.tearms;
    let logoUrl = currentCertificate.logo;

    // Handle terms file upload
    if (req.files && req.files.tearmsFile && req.files.tearmsFile[0]) {
      const termsFile = req.files.tearmsFile[0];

      // Validate it's a PDF
      if (termsFile.mimetype !== "application/pdf") {
        return res.status(400).json({
          message: "Terms file must be a PDF",
          status: false,
        });
      }

      // Upload new terms file
      tearmsUrl = await uploadFileToS3(
        termsFile.buffer,
        termsFile.originalname,
        "certificate/terms"
      );

      // Delete old terms file if exists
      if (currentCertificate.tearms) {
        await deleteFromS3(currentCertificate.tearms);
      }
    }

    // Handle logo file upload
    if (req.files && req.files.logo && req.files.logo[0]) {
      const logoFile = req.files.logo[0];

      // Validate logo file type (image only)
      if (!logoFile.mimetype.startsWith("image/")) {
        return res.status(400).json({
          message: "Logo must be a valid image file (JPEG, JPG, PNG, WebP)",
          status: false,
        });
      }

      // Validate file size (5MB limit for images)
      const maxSizeBytes = 5 * 1024 * 1024;
      if (logoFile.size > maxSizeBytes) {
        return res.status(400).json({
          message: "Logo must be smaller than 5 MB",
          status: false,
        });
      }

      // Upload new logo file
      logoUrl = await uploadFileToS3(
        logoFile.buffer,
        logoFile.originalname,
        "certificate/logo"
      );

      // Delete old logo file if exists
      if (currentCertificate.logo) {
        await deleteFromS3(currentCertificate.logo);
      }
    }

    // Update certificate with new fields
    await certificateCompanyDao.updateCertificate({
      id,
      srtcomapnyId,
      srtName,
      srtNameSinhala,
      srtNameTamil,
      srtNumber,
      applicable,
      accreditation,
      serviceAreas,
      price,
      timeLine,
      commission,
      tearms: tearmsUrl,
      scope,
      logo: logoUrl,
      noOfVisit,
      modifyBy: userId,
    });

    // Update crops
    await certificateCompanyDao.deleteCertificateCrops(id);
    if (normalizedCropIds.length > 0) {
      await certificateCompanyDao.addCertificateCrops(id, normalizedCropIds);
    }

    res.json({
      message: "Certificate updated successfully",
      status: true,
      logo: logoUrl,
      tearms: tearmsUrl,
    });
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
    const { clusterName, district, certificateId, farmers } =
      await ValidateSchema.createFarmerClusterSchema.validateAsync(req.body, {
        abortEarly: false,
      });

    // Extract unique NICs and regCodes
    const farmerNICs = farmers.map((f) => f.farmerNIC.trim());
    const regCodes = farmers.map((f) => f.regCode.trim());

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

    // Check if certificate exists and get certificate details
    const certificateDetails =
      await certificateCompanyDao.getCertificateDetails(
        certificateId,
        connection
      );
    if (!certificateDetails) {
      await connection.rollback();
      return res.status(400).json({
        message: "Certificate ID does not exist",
        status: false,
      });
    }

    // Check if registration codes exist in farms table
    const regCodeCheckResult = await certificateCompanyDao.checkRegCodesExist(
      regCodes,
      connection
    );
    if (regCodeCheckResult.missingRegCodes.length > 0) {
      await connection.rollback();
      
      // Get NIC details for missing registration codes
      const missingRegCodeDetails = await certificateCompanyDao.getFarmerDetailsByRegCodes(
        regCodeCheckResult.missingRegCodes,
        farmers,
        connection
      );

      return res.status(400).json({
        message: "Some registration codes are not found in the system",
        status: false,
        missingRegCodes: regCodeCheckResult.missingRegCodes,
        existingRegCodes: regCodeCheckResult.existingRegCodes,
        missingRegCodeDetails: missingRegCodeDetails,
      });
    }

    // Check NICs existence and match with farms
    const farmerValidation =
      await certificateCompanyDao.validateFarmersWithFarms(
        farmerNICs,
        regCodes,
        farmers,
        connection
      );

    if (farmerValidation.missingNICs.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "Some NIC numbers are not registered in the system",
        status: false,
        missingNICs: farmerValidation.missingNICs,
        validNICs: farmerValidation.validNICs,
      });
    }

    if (farmerValidation.mismatchedFarmers.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message:
          "Some farmers don't have farms with the provided registration codes",
        status: false,
        mismatchedFarmers: farmerValidation.mismatchedFarmers,
        validFarmers: farmerValidation.validFarmers,
      });
    }

    // Create cluster with additional fields
    const clusterResult = await certificateCompanyDao.createFarmCluster(
      clusterName,
      district,
      certificateId,
      userId,
      connection
    );
    const clusterId = clusterResult.insertId;

    // Get farm IDs for valid farmers
    const farmIds = await certificateCompanyDao.getFarmIdsForValidFarmers(
      farmerValidation.validFarmers,
      connection
    );

    // Bulk insert farms into cluster
    const bulkInsertResult = await certificateCompanyDao.bulkInsertClusterFarms(
      clusterId,
      farmIds,
      connection
    );

    console.log("-------------------------------------------");
    console.log(bulkInsertResult);
    console.log("-------------------------------------------");

    // Create certification payment record
    const paymentResult =
      await certificateCompanyDao.createCertificationPayment(
        {
          certificateId,
          clusterId,
          payType: "Cluster",
          price: certificateDetails.price,
          timeLine: certificateDetails.timeLine,
          farmsCount: farmIds.length,
        },
        connection
      );

    if (
      bulkInsertResult.insertedIds &&
      bulkInsertResult.insertedIds.length > 0
    ) {
      await certificateCompanyDao.bulkInsertSlaveQuestionnaire(
        paymentResult.insertId, // crtPaymentId
        bulkInsertResult.insertedIds, // clusterFarmIds array
        connection
      );
    }

    // Get all slavequestionnaire IDs that were just inserted
    const slaveQuestionnaireIds =
      await certificateCompanyDao.getSlaveQuestionnaireIds(
        paymentResult.insertId,
        connection
      );

    // Insert into slavequestionnaireitems
    if (slaveQuestionnaireIds.length > 0) {
      await certificateCompanyDao.bulkInsertSlaveQuestionnaireItems(
        slaveQuestionnaireIds,
        certificateId,
        connection
      );
    }

    await connection.commit();

    res.status(201).json({
      message: "Farmer cluster created successfully",
      status: true,
      data: {
        clusterId,
        clusterName,
        district,
        certificateId,
        farmsAdded: bulkInsertResult.affectedRows,
        totalFarms: farmIds.length,
        validFarmers: farmerValidation.validFarmers,
        paymentRecord: {
          paymentId: paymentResult.insertId,
          transactionId: paymentResult.transactionId,
          amount: paymentResult.amount,
          expireDate: paymentResult.expireDate,
        },
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

    const validationData = {
      nic: req.body.nic,
      farmId: req.body.farmId,
      clusterId: parseInt(req.params.clusterId),
    };

    const { error } =
      ValidateSchema.addSingleFarmerToClusterSchema.validate(validationData);
    if (error) {
      await connection.rollback();
      return res.status(400).json({
        message: error.details[0].message,
        status: false,
      });
    }

    const clusterId = parseInt(req.params.clusterId);
    const { nic, farmId } = req.body;

    // Step 1: Check if cluster exists and get certificate info
    const clusterInfo = await certificateCompanyDao.getClusterWithCertificate(
      clusterId,
      connection
    );
    if (!clusterInfo) {
      await connection.rollback();
      return res.status(404).json({
        message: "Cluster not found",
        status: false,
      });
    }

    // Step 2: Check if user with NIC exists
    const farmerInfo = await certificateCompanyDao.getFarmerInfoByNIC(
      nic.trim(),
      connection
    );
    if (!farmerInfo) {
      await connection.rollback();
      return res.status(400).json({
        message: `No farmer exists using this NIC`,
        status: false,
      });
    }

    // Step 3: Check if farm exists (regCode exists in farms table)
    const farmExists = await certificateCompanyDao.checkFarmExists(
      farmId.trim(),
      connection
    );
    if (!farmExists) {
      await connection.rollback();
      return res.status(400).json({
        message: `No farm exists using this ID`,
        status: false,
      });
    }

    // Step 4: Check if farm exists and belongs to the farmer
    const farmValidation = await certificateCompanyDao.validateFarmerFarm(
      farmerInfo.id,
      farmId.trim(),
      connection
    );

    if (!farmValidation.farmExists) {
      await connection.rollback();
      return res.status(400).json({
        message: `This farm does not belong to the specified farmer`,
        status: false,
      });
    }

    // Step 5: Check if farm is already in cluster
    const farmExistsInCluster = await certificateCompanyDao.isFarmInCluster(
      clusterId,
      farmValidation.farmId,
      connection
    );

    if (farmExistsInCluster) {
      await connection.rollback();
      return res.status(400).json({
        message: `The farm already added to the cluster`,
        status: false,
      });
    }

    // Optional: Check if farmer already has any farm in cluster
    const farmerExistsInCluster = await certificateCompanyDao.isFarmerInCluster(
      clusterId,
      farmerInfo.id,
      connection
    );
    if (farmerExistsInCluster) {
      await connection.rollback();
      return res.status(400).json({
        message: `This farmer already has a farm in the cluster`,
        status: false,
      });
    }

    // Step 6: Get existing certification payment for this cluster
    const existingPayment = await certificateCompanyDao.getClusterPaymentRecord(
      clusterId,
      connection
    );

    if (!existingPayment) {
      await connection.rollback();
      return res.status(400).json({
        message: `No certification payment record found for this cluster`,
        status: false,
      });
    }

    // Step 7: Insert farm into cluster
    const insertFarmIntoClusterResult =
      await certificateCompanyDao.insertFarmIntoCluster(
        clusterId,
        farmValidation.farmId,
        connection
      );

    const slaveInsertResult =
      await certificateCompanyDao.singleInsertSlaveQuestionnaire(
        existingPayment.id,
        insertFarmIntoClusterResult.insertId,
        connection
      );
    console.log("slaveInsertResult", slaveInsertResult);
    if (slaveInsertResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(500).json({
        message: `Failed to insert slave questionnaire for the new farm`,
        status: false,
      });
    }

    const slaveItemsInsertResult =
      await certificateCompanyDao.singleInsertSlaveQuestionnaireItems(
        slaveInsertResult.insertId,
        clusterInfo.certificateId,
        connection
      );

    if (slaveItemsInsertResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(500).json({
        message: `Failed to insert slave questionnaire items for the new farm`,
        status: false,
      });
    }

    // Step 8: Update certification payment amount
    const updateResult =
      await certificateCompanyDao.updateCertificationPaymentAmount(
        clusterId,
        clusterInfo.certificatePrice,
        connection
      );

    await connection.commit();

    return res.status(201).json({
      message: `Farmer Added to Cluster Successfully`,
      status: true,
      data: {
        clusterId,
        farmerId: farmerInfo.id,
        farmerName: farmerInfo.name,
        nic: nic.trim(),
        farmId: farmId.trim(),
        farmDbId: farmValidation.farmId,
        paymentUpdate: {
          updated: updateResult.updated,
          newAmount: updateResult.newAmount,
          farmsCount: updateResult.farmsCount,
          certificatePrice: clusterInfo.certificatePrice,
        },
      },
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
    await connection.beginTransaction();

    const clusterId = parseInt(req.params.clusterId);
    const farmerId = parseInt(req.params.farmerId);

    if (!clusterId || !farmerId) {
      await connection.rollback();
      return res.status(400).json({
        message: "Cluster ID and Farmer ID are required",
        status: false,
      });
    }

    // Step 1: Get cluster info with certificate price before deletion
    const clusterInfo = await certificateCompanyDao.getClusterWithCertificate(
      clusterId,
      connection
    );
    if (!clusterInfo) {
      await connection.rollback();
      return res.status(404).json({
        message: "Cluster not found",
        status: false,
      });
    }

    // Step 2: Check if certification payment exists for this cluster
    const existingPayment = await certificateCompanyDao.getClusterPaymentRecord(
      clusterId,
      connection
    );
    if (!existingPayment) {
      await connection.rollback();
      return res.status(400).json({
        message: "No certification payment record found for this cluster",
        status: false,
      });
    }

    // Step 3: Delete user from cluster
    const deleted = await certificateCompanyDao.deleteClusterUser(
      clusterId,
      farmerId,
      connection
    );
    if (!deleted) {
      await connection.rollback();
      return res
        .status(404)
        .json({ message: "User not found in this cluster", status: false });
    }

    // Step 4: Update certification payment amount after deletion
    const updateResult =
      await certificateCompanyDao.updateCertificationPaymentAmount(
        clusterId,
        clusterInfo.certificatePrice,
        connection
      );

    await connection.commit();

    res.status(200).json({
      message: "User removed from cluster successfully",
      status: true,
      data: {
        paymentUpdate: {
          updated: updateResult.updated,
          newAmount: updateResult.newAmount,
          farmsCount: updateResult.farmsCount,
          certificatePrice: clusterInfo.certificatePrice,
        },
      },
    });
  } catch (err) {
    if (connection) await connection.rollback();
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
  let connection;
  try {
    const { clusterId } = req.params;
    const { clusterName, district, certificateId } = req.body;
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
      district,
      certificateId,
    });
    if (error) {
      return res.status(400).json({
        status: false,
        message: error.details[0].message,
      });
    }

    connection = await plantcare.promise().getConnection();

    // Check if cluster exists
    const [existing] = await connection.query(
      `SELECT id, clsName, district, certificateId FROM farmcluster WHERE id = ?`,
      [clusterId]
    );
    if (existing.length === 0) {
      await connection.release();
      return res.status(404).json({
        status: false,
        message: "Cluster not found",
      });
    }

    const currentCluster = existing[0];

    // Check if certificate exists (if certificateId is provided)
    if (certificateId) {
      const [certificateExists] = await connection.query(
        `SELECT id FROM certificates WHERE id = ?`,
        [certificateId]
      );
      if (certificateExists.length === 0) {
        await connection.release();
        return res.status(400).json({
          status: false,
          message: "Certificate not found",
        });
      }
    }

    // Check duplicate name (only if clusterName is changing)
    if (clusterName && clusterName !== currentCluster.clsName) {
      const nameExists =
        await certificateCompanyDao.isClusterNameExistsExcludingCurrent(
          clusterName,
          clusterId,
          connection
        );
      if (nameExists) {
        await connection.release();
        return res.status(400).json({
          status: false,
          message: "Cluster name already exists",
        });
      }
    }

    // Update cluster
    const result = await certificateCompanyDao.updateFarmerCluster(
      clusterId,
      { clusterName, district, certificateId },
      userId,
      connection
    );

    await connection.release();

    return res.status(200).json({
      status: true,
      message: "Cluster updated successfully",
      data: result.updatedCluster,
      changes: result.changes,
    });
  } catch (err) {
    console.error("Error updating cluster:", err);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  } finally {
    if (connection) await connection.release();
  }
};

// Get farmer cluster certificates
exports.getFarmerClusterCertificates = async (req, res) => {
  try {
    const certificates =
      await certificateCompanyDao.getFarmerClusterCertificates();

    res.json({
      message: "Farmer cluster certificates fetched successfully",
      status: true,
      data: certificates,
    });
  } catch (err) {
    console.error("Error fetching farmer cluster certificates:", err);
    res.status(500).json({
      message: "Failed to fetch farmer cluster certificates",
      status: false,
    });
  }
};

// Update farmer cluster status
exports.updateClusterStatus = async (req, res) => {
  let connection;
  try {
    connection = await plantcare.promise().getConnection();

    const { clusterId, status } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      await connection.rollback();
      return res.status(401).json({
        message: "Unauthorized",
        status: false,
      });
    }

    // Validate required fields
    if (!clusterId || !status) {
      return res.status(400).json({
        message: "Cluster ID and status are required",
        status: false,
      });
    }

    // Validate status value
    const validStatuses = ["Started", "Not Started"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status value. Allowed values: Started, Not Started",
        status: false,
      });
    }

    const result = await certificateCompanyDao.updateClusterStatus(
      connection,
      clusterId,
      status,
      userId
    );

    res.status(200).json({
      message: result.message,
      status: true,
      data: result.data,
      changes: result.changes,
    });
  } catch (err) {
    console.error("Error updating cluster status:", err);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// Get all field audits
exports.getFieldAudits = async (req, res) => {
  let connection;

  try {
    connection = await plantcare.promise().getConnection();

    const { search } = req.query;
    const searchTerm = search || "";

    const audits = await certificateCompanyDao.getFieldAudits(
      searchTerm,
      connection
    );

    res.status(200).json({
      message: "Field audits retrieved successfully",
      status: true,
      data: audits,
    });
  } catch (err) {
    console.error("Error getting field audits:", err);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// Get crops for a field audit by paymentId
exports.getCropsByPaymentId = async (req, res) => {
  let connection;

  try {
    connection = await plantcare.promise().getConnection();

    const paymentId = parseInt(req.params.paymentId);

    if (!paymentId || isNaN(paymentId)) {
      return res.status(400).json({
        message: "Valid paymentId is required",
        status: false,
      });
    }

    const crops = await certificateCompanyDao.getCropsByPaymentId(
      paymentId,
      connection
    );

    res.status(200).json({
      message: "Crops retrieved successfully",
      status: true,
      data: crops,
    });
  } catch (err) {
    console.error("Error getting crops by paymentId:", err);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// Get crops for a field audit by fieldaudits id
exports.getCropsByFieldAuditId = async (req, res) => {
  let connection;

  try {
    connection = await plantcare.promise().getConnection();

    const fieldAuditId = parseInt(req.params.fieldAuditId);

    if (!fieldAuditId || isNaN(fieldAuditId)) {
      return res.status(400).json({
        message: "Valid fieldAuditId is required",
        status: false,
      });
    }

    const result = await certificateCompanyDao.getCropsByFieldAuditId(
      fieldAuditId,
      connection
    );

    if (!result.certificateInfo) {
      return res.status(404).json({
        message: "Field audit not found or no certificate associated",
        status: false,
      });
    }

    res.status(200).json({
      message: "Crops retrieved successfully",
      status: true,
      data: {
        certificate: result.certificateInfo,
        crops: result.crops,
      },
    });
  } catch (err) {
    console.error("Error getting crops by fieldAuditId:", err);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// Get farmer clusters audits
exports.getFarmerClustersAudits = async (req, res) => {
  let connection;

  try {
    connection = await plantcare.promise().getConnection();

    const { search } = req.query;
    const searchTerm = search || "";

    const clustersAudits = await certificateCompanyDao.getFarmerClustersAudits(
      searchTerm,
      connection
    );

    res.status(200).json({
      message: "Farmer clusters audits retrieved successfully",
      status: true,
      data: clustersAudits,
    });
  } catch (err) {
    console.error("Error getting farmer clusters audits:", err);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// Get field officers by district and job role
exports.getOfficersByDistrictAndRole = async (req, res) => {
  try {
    const { district, jobRole, scheduleDate } = req.query;

    if (!district || !jobRole || !scheduleDate) {
      return res.status(400).json({
        message: "district, jobRole, and scheduleDate parameters are required",
        status: false,
      });
    }

    // Validate scheduleDate format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(scheduleDate)) {
      return res.status(400).json({
        message: "scheduleDate must be in YYYY-MM-DD format",
        status: false,
      });
    }

    const officers =
      await certificateCompanyDao.getOfficersByDistrictAndRoleDAO(
        district,
        jobRole,
        scheduleDate
      );

    res.status(200).json({
      message: "Officers retrieved successfully",
      status: true,
      data: officers,
      total: officers.length,
    });
  } catch (err) {
    console.error("Error fetching officers by district and role:", err);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  }
};

// Update field audit assign officer
exports.assignOfficerToAudit = async (req, res) => {
  try {
    const { auditId, officerId, scheduleDate } = req.body;
    
    // Get the logged-in user ID from the authentication middleware
    // Try different possible properties where user ID might be stored
    const assignByUserId = req.user?.id || req.user?.userId || req.user?.user_id || req.user?.userID;
    
    console.log('Authentication debug:', {
      user: req.user,
      assignByUserId: assignByUserId
    });

    // Validate required fields
    if (!auditId || !officerId) {
      return res.status(400).json({
        message: "auditId and officerId are required",
        status: false,
      });
    }

    // Validate auditId is a number
    const fieldAuditId = parseInt(auditId);
    if (isNaN(fieldAuditId)) {
      return res.status(400).json({
        message: "auditId must be a valid number",
        status: false,
      });
    }

    // Validate officerId is a number
    const assignOfficerId = parseInt(officerId);
    if (isNaN(assignOfficerId)) {
      return res.status(400).json({
        message: "officerId must be a valid number",
        status: false,
      });
    }

    // If assignByUserId is still not available, we have two options:
    // Option 1: Remove this validation temporarily for testing
    // Option 2: Get user ID from token service if available
    
    if (!assignByUserId) {
      console.warn('assignByUserId not found in req.user, proceeding without it');
      // You might want to handle this differently based on your requirements
      // For now, let's proceed but you should fix your auth middleware
    }

    // Validate scheduleDate if provided
    let parsedScheduleDate = null;
    if (scheduleDate) {
      parsedScheduleDate = new Date(scheduleDate);
      if (isNaN(parsedScheduleDate.getTime())) {
        return res.status(400).json({
          message: "scheduleDate must be a valid date",
          status: false,
        });
      }
    }

    // Update field audit officer using DAO
    const result = await certificateCompanyDao.assignOfficerToAuditDAO(
      fieldAuditId,
      assignOfficerId,
      assignByUserId, // This might be undefined - we need to handle this in DAO
      parsedScheduleDate
    );

    res.status(200).json({
      message: "Officer assigned successfully",
      status: true,
      data: result,
    });
  } catch (err) {
    console.error("Error updating field audit officer:", err);

    if (err.message.includes("not found")) {
      return res.status(404).json({
        message: err.message,
        status: false,
      });
    }

    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  }
};
