const certificateCompanyDao = require("../dao/CertificateCompany-dao");

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
      address
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

// Get all certificate companies with pagination and search
exports.getAllCertificateCompanies = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const parsedLimit = parseInt(limit, 10) || 10;
    const parsedPage = parseInt(page, 10) || 1;
    const offset = (parsedPage - 1) * parsedLimit;

    const { total, companies } =
      await certificateCompanyDao.getAllCertificateCompanies(
        parsedLimit,
        offset,
        search
      );

    res.json({
      companies,
      total,
      page: parsedPage,
      limit: parsedLimit,
    });
  } catch (err) {
    console.error("Error fetching certificate companies:", err);
    res.status(500).json({
      message: "An error occurred while fetching certificate companies",
      error: err.message,
    });
  }
};
