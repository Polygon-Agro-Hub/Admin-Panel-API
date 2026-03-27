const GoviShopDAO = require("../dao/GoviShop-dao");
const GoviShopValidation = require("../validations/GoviShop-validation");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const { resolve } = require("path");
const path = require("path");
const bcrypt = require("bcryptjs/dist/bcrypt");

exports.getAllGoviShopUsers = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log('fullUrl', fullUrl)
  try {
    // Get pagination parameters from query string with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const { search, currentPlan } = req.query;

    console.log('currentPlan', currentPlan)

    const { total, shopUsers } =
      await GoviShopDAO.getAllGoviShopUsers(limit, offset, search, currentPlan);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        shopUsers,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? page + 1 : null,
          prevPage: hasPrevPage ? page - 1 : null,
        }
      },
    });
  } catch (err) {
    console.error("Error fetching shop users:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching shop users",
      error: err.message,
    });
  }
};

exports.deleteGoviShopUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {reason} = req.body;

    console.log('reason', reason, 'id', id)
    // Validate id param
    const { error } = GoviShopValidation.getByIdSchema.validate({ id });
    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
        status: false,
      });
    }

    // Check if shop user exists
    const existing = await GoviShopDAO.getGoviShopUserById(id);
    if (!existing || existing.length === 0) {
      return res.status(404).json({
        message: "Shop user not found",
        status: false,
      });
    }

    // Perform delete
    const deletedUser = await GoviShopDAO.deleteGoviShopUser(id);

    if (!deletedUser) {
      return res.status(404).json({
        message: "Shop user not found or already deleted",
        status: false,
      });
    }

    let InsertReason;
    if (deletedUser) {
      InsertReason = await GoviShopDAO.InsertReason(id, reason);
    }

    const shopOwner = await GoviShopDAO.getShopOwnerEmailDao(
      id
    );
    if (!shopOwner) {
      return res
        .status(404)
        .json({ message: "Shop owner officer not found.", status: false });
    }

    console.log('shopOwner', shopOwner)

    const { email, ownerName } = shopOwner;

    const emailResult = await SendEmail(
      email,
      ownerName
    );

    console.log('emailResult', emailResult)

    if (!emailResult.success) {
      return res.status(500).json({
        message: "Failed to send email.",
        error: emailResult.error,
      });
    }

    res.json({
      message: "Shop user deleted successfully",
      status: true,
    });
  } catch (err) {
    console.error("Error deleting shop user:", err);
    res.status(500).json({
      message: "An error occurred while deleting shop user",
      error: err.message,
      status: false,
    });
  }
};

async function SendEmail(email, ownerName) {
  try {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });
    
    const pdfBuffer = [];
    doc.on("data", pdfBuffer.push.bind(pdfBuffer));
    
    /* ---------- CARD BACKGROUND ---------- */
    doc
      .roundedRect(40, 40, 515, 700, 10)
      .fillAndStroke("#f9fafb", "#e5e7eb");
    
    /* ---------- LOGO ---------- */
    const logo = path.resolve(__dirname, "../assets/govishop.png");
    
    doc.image(logo, 260, 60, { width: 75 });
    
    /* ---------- TITLE ---------- */
    doc
    .font("Helvetica-Bold") // ✅ set bold font
    .fillColor("#02072C")
    .fontSize(14)
    .text("Your GoViShop Account Has Been Deleted", 80, 140, {
      align: "center",
    });
    
    /* ---------- DIVIDER ---------- */
    doc
      .moveTo(80, 180)
      .lineTo(520, 180)
      .strokeColor("#E8E6F6")
      .stroke();
    
    /* ---------- BODY ---------- */
    doc
      .fillColor("#02072C")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(`Dear ${ownerName},`, 80, 200);
    
    
    doc
    .font("Helvetica")
    .fillColor("#02072C")
    .fontSize(12)
    .text(
      "We wanted to inform you that your GoViShop account has been deleted.",
      {
        width: 440,
      }
    );
    
    /* ---------- REASON BOX ---------- */
    doc
      .roundedRect(80, 260, 440, 60, 5)
      .fill("#FEF3F3");
    
    doc
      .fillColor("#C91A3D")
      .fontSize(12)
      .text("Reason :", 100, 275);
    
    doc
      .fillColor("#333C45")
      .fontSize(12)
      .text("Inactive account for extended period.", 100, 295);
    
    /* ---------- MORE TEXT ---------- */
    doc
      .fillColor("#02072C")
      .fontSize(12)
      .text(
        "As a result, you will no longer be able to access your account or any associated services.",
        80,
        340,
        { width: 440 }
      );
    
    doc
      .fillColor("#02072C")
      .fontSize(12)
      .text("Thank you for your time on GoViShop.", {
      width: 440,
    });
    
    /* ---------- FOOTER ---------- */
    doc.moveDown();
    
    doc
      .fillColor("#02072C")
      .fontSize(12)
      .text("Thank you,", 80);
    doc
      .fillColor("#02072C")
      .fontSize(12)
      .font("Helvetica-Bold").text("GoViShop Team", 80);
    
    /* ---------- BOTTOM NOTE ---------- */
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#9ca3af")
      .text(
        "@ 2026 Polygon Holdings Limited. All Rights Reserved.",
        80,
        700,
        { align: "center", width: 440 }
      );
    
    doc.text("Please note that this is an automated message.", {
      align: "center",
      width: 440,
    });
    
    /* ---------- END ---------- */
    doc.end();
    await new Promise((resolve) => doc.on("end", resolve));

    const pdfData = Buffer.concat(pdfBuffer); // Concatenate the buffer data

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465, // or 587 for TLS
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        family: 4,
      },
    });

    // const transporter = nodemailer.createTransport({
    //   host: "smtp.gmail.com",
    //   port: 587,
    //   secure: false,
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS,
    //   },
    //   tls: {
    //     rejectUnauthorized: false, 
    //   },
    // });


    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to PolygonAgro (Pvt) Ltd - Registration Confirmation",
      text: `Dear ,\n\nYour registration details are attached in the PDF.`,
      attachments: [
        {
          filename: `password_.pdf`, // PDF file name
          content: pdfData, // Attach the PDF buffer directly
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);

    return { success: true, message: "Email sent successfully!" };
  } catch (error) {
    console.error("Error sending email:", error);

    return { success: false, message: "Failed to send email.", error };
  }
}


// const [
    //   isExistingNIC,
    //   isExistingEmail,
    //   isExistingPhoneNumber01,
    //   isExistingPhoneNumber02,
    // ] = await Promise.all([
    //   DistributionDao.checkNICExist(officerData.nic),
    //   DistributionDao.checkEmailExist(officerData.email),
    //   DistributionDao.checkPhoneNumberExist(officerData.phoneNumber01),
    //   officerData.phoneNumber02
    //     ? DistributionDao.checkPhoneNumberExist(officerData.phoneNumber02)
    //     : Promise.resolve(false),
    // ]);

    // Collect all validation errors
    // const validationErrors = [];
    // if (isExistingNIC)
    //   validationErrors.push('NIC');
    // if (isExistingEmail)
    //   validationErrors.push('email');
    // if (isExistingPhoneNumber01)
    //   validationErrors.push('phoneNumber01');
    // if (isExistingPhoneNumber02)
    //   validationErrors.push('phoneNumber02');

    // if (validationErrors.length > 0) {
    //   return res.status(400).json({
    //     errors: validationErrors,
    //     status: false
    //   });
    // }

exports.checkPhone = async (req, res) => {

  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log('fullUrl', fullUrl)
  try {

    const {mobileNumber} = req.body;

    if (!mobileNumber) {
      return res.status(400).json({
        error: "mobileNumber is required",
        status: false,
      });
    }
    
    res.json({
      message: "mobile number exists",
      status: true,
    });
  } catch (err) {
    console.error("", err);
    res.status(500).json({
      message: "",
      error: err.message,
      status: false,
    });
  }
};

exports.sendOtp = async (req, res) => {

  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log('fullUrl', fullUrl)
  try {

    const {mobileNumber} = req.body;
    
    res.json({
      message: "",
      status: true,
    });
  } catch (err) {
    console.error("", err);
    res.status(500).json({
      message: "",
      error: err.message,
      status: false,
    });
  }
};

exports.createGoviShopUser = async (req, res) => {

  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log('fullUrl', fullUrl)
  try {
    if (!req.body.supplierData || req.body.supplierData.mobileNumber) {
      return res.status(400).json({
        error: "Supplier data is required",
        status: false,
      });
    }

    // Parse and sanitize officer data
    const supplierData = JSON.parse(req.body.supplierData);

    console.log('supplierData', supplierData)
    console.log('file', req.files?.file?.[0]);
    const adminId = req.user.userId

    console.log(req.user, 'user')

    const insertId = await GoviShopDAO.createGoviShopUser(
      supplierData, adminId
    );

    if (!insertId) {
      console.error(
        "Officer creation failed - no rows affected or no ID returned"
      );
      return res.status(500).json({
        error: "Failed to create officer record",
        status: false,
      });
    }

    console.log('insertID', insertId)

    const generatedPassword = Math.random().toString(36).slice(-8); 

    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const emailResult = await GoviShopDAO.SendGeneratedPasswordDao(
      supplierData.email,
      generatedPassword,
      supplierData.mobileNumber,
      supplierData.fullName

    );

    if (!emailResult.success) {
      return res.status(500).json({
        message: "Failed to send password.",
        error: emailResult.error,
      });
    }

    const updateResult =
      await GoviShopDAO.updateGovieShopPassword(
        hashedPassword,
        insertId.results
       );

    if (updateResult.affectedRows === 0) {
      return res.status(400).json({
        message: "Failed to update password.",
        status: false,
      });
    }
    
    res.json({
      message: "",
      status: true,
    });
  } catch (err) {
    console.error("", err);
    res.status(500).json({
      message: "",
      error: err.message,
      status: false,
    });
  }
};


exports.viewGoviShopSupplierById = async (req, res) => {
  try {
    const { id } = await GoviShopValidation.viewGoviShopSupplierByIdSchema.validateAsync(req.params);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Shop user id is required",
      });
    }

    const shopUser = await GoviShopDAO.viewGoviShopSupplierByIdDao(id);

    if (!shopUser) {
      return res.status(404).json({
        success: false,
        message: "Shop user not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: shopUser,
    });
  } catch (error) {
    console.error("View Govi Shop Supplier Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getAllShowViewActionEp = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const { allSuppliers, page, limit, status, searchText } =
      await GoviShopValidation.getAllShopViewActionSchema.validateAsync(
        req.query,
      );

    console.log('allSuppliers', allSuppliers)

    // Call the DAO to get all collection officers
    const result = await GoviShopDAO.getAllShowViewActionDAO(
      page, limit,
      status,
      searchText,
      allSuppliers
    );

    console.log("result", result);

    return res.status(200).json(result);
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};

exports.goviShopViewDocumentById = async (req, res) => {
  try {
    const { id } = await GoviShopValidation.goviShopViewDocumentByIdSchema.validateAsync(
      req.params,
    );

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Shop id is required",
      });
    }

    const document = await GoviShopDAO.goviShopViewDocumentDAO(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("View Govi Shop Document Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.updateGoviShopUserStatus = async (req, res) => {
  try {
    const { id } = await GoviShopValidation.updateGoviShopUserParamsSchema.validateAsync(req.params);
    const { status } = await GoviShopValidation.updateGoviShopUserBodySchema.validateAsync(req.body);

    if (!id || !status) {
      return res.status(400).json({ success: false, message: "User id and status are required" });
    }

    const allowedStatuses = ["Activate", "Rejected", "Deactivate"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    const updated = await GoviShopDAO.updateGoviShopUserStatusDAO(id, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Shop user not found" });
    }

    // ✅ Call email function from DAO
    if (status === "Activate") {
      try {
        await GoviShopDAO.sendGoviShopRenewalEmailDAO(id);
      } catch (emailError) {
        console.error("❌ Email sending failed:", emailError.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Shop user status updated to ${status}`,
    });

  } catch (error) {
    console.error("Update Govi Shop User Status Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.deleteGoviShopSupplierEp = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { id } = await GoviShopValidation.goviShopViewDocumentByIdSchema.validateAsync(
      req.params,
    );

    const results = await GoviShopDAO.deleteGoviShopSupplierDao(id);

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
