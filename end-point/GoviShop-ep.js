const GoviShopDAO = require("../dao/GoviShop-dao");
const GoviShopValidation = require("../validations/GoviShop-validation");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const { resolve } = require("path");
const path = require("path");
const bcrypt = require("bcryptjs/dist/bcrypt");
const uploadFileToS3 = require("../middlewares/s3upload");
const deleteFromS3 = require("../middlewares/s3delete");

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
    const { reason } = req.body;

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
      .roundedRect(40, 40, 515, 480, 10)   // ← height 700 → 480
      .fillAndStroke("#f9fafb", "#e5e7eb");

    /* ---------- LOGO ---------- */
    const logo = path.resolve(__dirname, "../assets/govishop.png");
    doc.image(logo, 260, 60, { width: 75 });

    /* ---------- TITLE ---------- */
    doc
      .font("Helvetica-Bold")
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
      .lineGap(6)
      .text(`Dear ${ownerName},`, 80, 200);

    doc
      .font("Helvetica")
      .fillColor("#02072C")
      .fontSize(12)
      .lineGap(6)                                           // ← added
      .text(
        "We wanted to inform you that your GoViShop account has been deleted.",
        { width: 440 }
      );

    /* ---------- REASON BOX ---------- */
    doc
      .roundedRect(80, 260, 440, 60, 5)
      .fill("#FEF3F3");

    doc
      .fillColor("#C91A3D")
      .fontSize(12)
      .lineGap(0)                                           // ← reset inside box
      .text("Reason :", 100, 275);

    doc
      .fillColor("#333C45")
      .fontSize(12)
      .text("Inactive account for extended period.", 100, 295);

    doc
      .fillColor("#02072C")
      .fontSize(12)
      .lineGap(6)                                           
      .text(
        "As a result, you will no longer be able to access your account or any associated services.",
        80,
        340,
        { width: 440 }
      );

    doc
      .fillColor("#02072C")
      .fontSize(12)
      .lineGap(6)                                           
      .text("Thank you for your time on GoViShop.", { width: 440 });

    /* ---------- FOOTER ---------- */
    doc.moveDown();

    doc
      .fillColor("#02072C")
      .fontSize(12)
      .lineGap(6)                                          
      .text("Thank you,", 80);

    doc
      .fillColor("#02072C")
      .fontSize(12)
      .font("Helvetica-Bold")
      .lineGap(0)                                           
      .text("GoViShop Team", 80);

    doc
      .font("Helvetica")
      .fontSize(10)
      .lineGap(6)
      .fillColor("#9ca3af")
      .text(
        "@ 2026 Polygon Holdings Limited. All Rights Reserved.",
        80,
        535,                                                  
        { align: "center", width: 440 }
      );

    doc
      .lineGap(6)
      .text("Please note that this is an automated message.", {
        align: "center",
        width: 440,
      });

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
      subject: "PolygonAgro (Pvt) Ltd - GoViShop Supplier Account Has Been Deleted",
      text: `Dear ${ownerName},\n\nDetails are attached in the PDF.`,
      attachments: [
        {
          filename: `GovViShop_Supplier_Account_Delete.pdf`, // PDF file name
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



exports.checkPhone = async (req, res) => {

  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log('fullUrl', fullUrl)
  try {

    const { mobileNumber } = req.body;

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

    const { mobileNumber } = req.body;

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


const uploadImage = async (buffer, filename, folder) => {
  return await uploadFileToS3(buffer, filename, folder);
};

const uploadBase64Image = async (base64, fileName, folder) => {
  const base64String = base64.split(",")[1];
  const buffer = Buffer.from(base64String, "base64");
  return await uploadFileToS3(buffer, fileName, folder);
};


exports.createGoviShopUser = async (req, res) => {

  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log('fullUrl', fullUrl)
  try {
    if (!req.body.supplierData) {
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

    let validationErrors = [];

    const [
      isExistingNIC,
      isExistingEmail,
      isExistingPhoneNumber01,
    ] = await Promise.all([
      GoviShopDAO.checkExistShopOwnerDao(supplierData.nic),
      GoviShopDAO.checkExistEmailsDao(supplierData.email),
      GoviShopDAO.checkExistPhoneDao(supplierData.mobileNumber)
    ]);

    console.log('isExistingNIC', isExistingNIC, 'isExistingEmail', isExistingEmail, 'isExistingPhoneNumber01', isExistingPhoneNumber01)

    if (isExistingNIC) validationErrors.push("NIC");
    if (isExistingEmail) validationErrors.push("Email");
    if (isExistingPhoneNumber01) validationErrors.push("phone");

    if (validationErrors.length > 0) {
      console.log('val errors', validationErrors )
      return res.status(400).json({ errors: validationErrors, status: false });
    }

    isExistingNIC = await GoviShopDAO.checkExistShopOwnerDao(supplierData.nic);

    console.log('isExistingNIC', isExistingNIC)

    let slipUrl = null;

    const uploadImage = async (buffer, filename, folder) => {
      return await uploadFileToS3(buffer, filename, folder);
    };

    console.log(req.user, 'user')

    accessStatus = supplierData.selectedSubscription === 'Premium' ? 'Completed' : 'Free Access'

    const createResults = await GoviShopDAO.createGoviShopUser(
      supplierData, adminId, accessStatus
    );

    if (!createResults.insertId) {
      console.error(
        "Officer creation failed - no rows affected or no ID returned"
      );
      return res.status(500).json({
        error: "Failed to create officer record",
        status: false,
      });
    }

    let paymentDetails;

    if (supplierData.selectedSubscription === 'Premium') {
      const slip = req.files?.file?.[0];
      console.log('slip', slip)

      if (slip) {
        const slipName = `${supplierData.fullName}`;

        slipUrl = await uploadImage(
          slip.buffer,
          slipName,
          "GoViShop/payment_slip"
        );

        paymentDetails = await GoviShopDAO.insertUserPaymentDetails(
          slipUrl, createResults.insertId, createResults.regCode
        );

        if (!paymentDetails) {
          console.error(
            "Payment details inser failed"
          );
          return res.status(500).json({
            error: "Failed to insert payment details",
            status: false,
          });
        }

      } else {
        console.log("No slip provided. Skipping upload.");
        const deleteRecord = await GoviShopDAO.deleteGoviShopSupplierRecordDao(
          createResults.insertId
        );

        return res.status(400).json({
          error: "Please upload the playment slip",
          status: false,
        });
      }

      console.log('slipUrl', slipUrl)
    }

    console.log('insertID', createResults.insertId)

    const generatedPassword = Math.random().toString(36).slice(-8);

    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const emailResult = await GoviShopDAO.SendGeneratedPasswordDao(
      supplierData.email,
      generatedPassword,
      supplierData.mobileNumber,
      supplierData.fullName,
      supplierData.selectedSubscription

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
        createResults.insertId
      );

    if (updateResult.affectedRows === 0) {
      return res.status(400).json({
        message: "Failed to update password.",
        status: false,
      });
    }

    res.json({
      message: "GoViShop owner creation successfull",
      status: true,
    });
  } catch (err) {
    console.error("Error occured while creating GoViShop Owner", err);
    res.status(500).json({
      message: "Error occured while creating GoViShop Owner",
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

exports.reneveGoviShopUser = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
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

    const updatedData = await GoviShopDAO.renewGoviShopUserDAO(id, status);

    console.log('updatedData', updatedData)
    if (!updatedData) {
      return res.status(404).json({ success: false, message: "Shop user not found" });
    }

    const emailResult = await GoviShopDAO.sendGoviShopRenewalEmailDAO(id);

    if (!emailResult.success) {
      return res.status(500).json({
        message: "Failed to send password.",
        error: emailResult.error,
      });
    }

    // if (status === "Activate") {
    //   try {
    //     await GoviShopDAO.sendGoviShopRenewalEmailDAO(id);
    //   } catch (emailError) {
    //     console.error("mail sending failed:", emailError.message);
    //   }
    // }

    return res.status(200).json({
      success: true,
      message: `Shop user status updated to ${status}`,
    });

  } catch (error) {
    console.error("Update Govi Shop User Status Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.rejectGoviShopUser = async (req, res) => {
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

    const updated = await GoviShopDAO.rejectGoviShopUserDAO(id, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Shop user not found" });
    }

    if (status === "Activate") {
      try {
        await GoviShopDAO.sendGoviShopRenewalEmailDAO(id);
      } catch (emailError) {
        console.error("mail sending failed:", emailError.message);
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

exports.getAllShopsByOwnerEp = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    console.log(req.query);
    const { id, page, limit, accessStatus, approval, bussinessType, searchItem } =
      req.query;

    const { results, total } = await GoviShopDAO.GetAllShopsByOwnerDAO(
      id,
      page,
      limit,
      accessStatus,
      approval,
      bussinessType,
      searchItem,
    );

    console.log("results", results);

    console.log("Successfully retrieved all collection centre");
    res.json({ results, total });
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

exports.getGoviShopSupplierById = async (req, res) => {
  try {
    const { id } = await GoviShopValidation.viewGoviShopSupplierByIdSchema.validateAsync(req.params);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Shop user id is required",
      });
    }

    const shopUser = await GoviShopDAO.getGoViShopSupplierById(id);

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

exports.updateGoviShopUser = async (req, res) => {

  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log('fullUrl', fullUrl)
  try {
    if (!req.body) {
      return res.status(400).json({
        error: "Supplier data is required",
        status: false,
      });
    }

    console.log('supplierData', req.body);

    // Parse and sanitize officer data
    const supplierData = req.body;

    console.log('supplierData', supplierData)
    const adminId = req.user.userId

    let validationErrors = [];

    const [
      isExistingNIC,
      isExistingEmail,
      isExistingPhoneNumber01,
    ] = await Promise.all([
      GoviShopDAO.checkExistShopOwnerDao(supplierData.nic, supplierData.id),       
      GoviShopDAO.checkExistEmailsDao(supplierData.email, supplierData.id),
      GoviShopDAO.checkExistPhoneDao(supplierData.mobileNumber, supplierData.id)
    ]);

    if (isExistingNIC) validationErrors.push("NIC");
    if (isExistingEmail) validationErrors.push("Email");
    if (isExistingPhoneNumber01) validationErrors.push("phone");

    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors, status: false });
    }

    console.log(req.user, 'user')

    const result = await GoviShopDAO.updateGoviShopUser(
      supplierData
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "GoViShop Supplier not found or no changes made",
      });
    }

    res.json({
      message: "GoViShop Supplier details updated successfully",
      status: true,
      data: {
        id: supplierData.id,
        affectedRows: result.affectedRows,
      }
    });
  } catch (err) {
    console.error("Error updating GoViShop Supplier details", err);
    res.status(500).json({
      message: "",
      error: err.message,
      status: false,
    });
  }
};

exports.getAllShopRequests = async (req, res) => {
  try {
    console.log(req.query);

    const { page, limit,  approval, bussinessType, searchItem } =
      await GoviShopValidation.getAllGoViShopSchema.validateAsync(
        req.query
    );

    const { results, total } = await GoviShopDAO.GetAllShopRequestsDAO(
      page,
      limit,
      approval,
      bussinessType,
      searchItem,
    );

    console.log("results", results);

    console.log("Successfully retrieved all collection centre");
    res.json({ results, total });
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

exports.getGoviShopById = async (req, res) => {
  try {
    const { id } = await GoviShopValidation.viewGoviShopSupplierByIdSchema.validateAsync(req.params);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "GoViShop id is required",
      });
    }

    const shopUser = await GoviShopDAO.getGoViShopById(id);

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
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }
    console.error("View Govi Shop Supplier Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.updateGoviShopUser = async (req, res) => {

  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log('fullUrl', fullUrl)
  try {
    if (!req.body) {
      return res.status(400).json({
        error: "Shop data is required",
        status: false,
      });
    }

    console.log('ShopData', req.body);

    // Parse and sanitize officer data
    const shopData = req.body;

    console.log('ShopData', shopData)
    const adminId = req.user.userId

    let validationErrors = [];

    const [
      isExistingNIC,
      isExistingEmail,
      isExistingPhoneNumber01,
    ] = await Promise.all([   
      GoviShopDAO.checkExistShopEmailsDao(shopData.email, shopData.id),
      GoviShopDAO.checkExistShopPhoneDao(shopData.mobileNumber, shopData.id)
    ]);

    if (isExistingEmail) validationErrors.push("Email");
    if (isExistingPhoneNumber01) validationErrors.push("phone");

    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors, status: false });
    }

    console.log(req.user, 'user')

    const result = await GoviShopDAO.updateGoviShopUser(
      shopData, adminId
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "GoViShop not found or no changes made",
      });
    }

    res.json({
      message: "GoViShop details updated successfully",
      status: true,
      data: {
        id: shopData.id,
        affectedRows: result.affectedRows,
      }
    });
  } catch (err) {
    console.error("Error updating GoViShop details", err);
    res.status(500).json({
      message: "",
      error: err.message,
      status: false,
    });
  }
};

exports.getGoviShopById = async (req, res) => {
  try {
    const { id } = await GoviShopValidation.viewGoviShopSupplierByIdSchema.validateAsync(req.params);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Shop id is required",
      });
    }

    const shopData = await GoviShopDAO.getGoViShopByIdDao(id);

    if (!shopData) {
      return res.status(404).json({
        success: false,
        message: "Shop Data not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: shopData,
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }
    console.error("View Govi Shop DataError:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getUsers = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    // Extract search and role from query parameters
    const { search, role } = req.query;

    // Use the role from query parameter, default to 'Manager' if not provided
    const userRole = role || "Manager";

    // Get the users using the DAO function
    const users = await GoviShopDAO.getUsersDao(search, userRole);

    // Build response message
    let message = `${userRole}s fetched successfully!`;
    if (search) {
      message = `${userRole}s searched successfully!`;
    }

    return res.status(200).json({
      success: true,
      message: message,
      data: users,
      count: users.length,
      search: search || null,
      role: userRole,
    });
  } catch (error) {
    console.error("Error in getUsers route:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred while fetching users",
      details: error.message,
    });
  }
};

exports.getPosUserById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { id } = await GoviShopValidation.viewGoviShopSupplierByIdSchema.validateAsync(req.params);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Shop user id is required",
      });
    }

    const posUser = await GoviShopDAO.getPosUserByIdDao(id);

    if (!posUser) {
      return res.status(404).json({
        success: false,
        message: "Pos user not found",
      });
    }

    const branches = await GoviShopDAO.getGoViShopBranchesByShopIdDao(posUser.shopId);

    return res.status(200).json({
      success: true,
      data: {posUser: posUser, branches: branches},
    });
  } catch (error) {
    console.error("View Govi Shop Supplier Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.updatePOSUserEp = async (req, res) => {

  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log('fullUrl', fullUrl)
  try {
    if (!req.body) {
      return res.status(400).json({
        error: "user data is required",
        status: false,
      });
    }

    console.log('userData', req.body);

    // Parse and sanitize officer data
    const userData = req.body;

    console.log('userData', userData)

    // let validationErrors = [];

    // const [
    //   isExistingNIC,
    //   isExistingEmail,
    //   isExistingPhoneNumber01,
    // ] = await Promise.all([   
    //   GoviShopDAO.checkExistShopEmailsDao(shopData.email, shopData.id),
    //   GoviShopDAO.checkExistShopPhoneDao(shopData.mobileNumber, shopData.id)
    // ]);

    // if (isExistingEmail) validationErrors.push("Email");
    // if (isExistingPhoneNumber01) validationErrors.push("phone");

    // if (validationErrors.length > 0) {
    //   return res.status(400).json({ errors: validationErrors, status: false });
    // }

    const result = await GoviShopDAO.updateGoviShopPOSUserDao(
      userData
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "GoViShop POS user not found or no changes made",
      });
    }

    res.json({
      message: "GoViShop POS user details updated successfully",
      status: true,
      data: {
        id: userData.id,
        affectedRows: result.affectedRows,
      }
    });
  } catch (err) {
    console.error("Error updating GoViShop POS user details", err);
    res.status(500).json({
      message: "",
      error: err.message,
      status: false,
    });
  }
};

exports.resetPosUserPasswordEp = async (req, res) => {

  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log('fullUrl', fullUrl)
  try {
    if (!req.body) {
      return res.status(400).json({
        error: "user data is required",
        status: false,
      });
    }

    console.log('userData', req.body);

    // Parse and sanitize officer data
    const userData = req.body;

    console.log('userData', userData)
    
    const generatedPassword = Math.random().toString(36).slice(-8);

    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const emailResult = await GoviShopDAO.SendGeneratedPasswordPosUserDao(
      userData.email,
      generatedPassword,
      userData.mobileNumber,
      userData.fullName,
      userData.branchName,
      userData.shopName

    );

    if (!emailResult.success) {
      return res.status(500).json({
        message: "Failed to send password.",
        error: emailResult.error,
      });
    }

    const updateResult =
      await GoviShopDAO.updateGovieShopPosUserPasswordDao(
        hashedPassword,
        userData.id
      );

    if (updateResult.affectedRows === 0) {
      return res.status(400).json({
        message: "Failed to update password.",
        status: false,
      });
    }

    res.json({
      message: "GoViShop POS user details updated successfully",
      status: true,
      data: {
        id: userData.id,
        affectedRows: updateResult.affectedRows,
      }
    });
  } catch (err) {
    console.error("Error updating GoViShop POS user details", err);
    res.status(500).json({
      message: "",
      error: err.message,
      status: false,
    });
  }
};

