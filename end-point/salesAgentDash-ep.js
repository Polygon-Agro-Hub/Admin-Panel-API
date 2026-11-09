const jwt = require("jsonwebtoken");
const db = require("../startup/database");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const { log } = require("console");
const SalesAgentDAO = require("../dao/SalesAgentDash-dao");
const ValidateSchema = require("../validations/Admin-validation");
const { type } = require("os");
const bcrypt = require("bcryptjs");

const { v4: uuidv4 } = require("uuid");
const uploadFileToS3 = require("../middlewares/s3upload");
const deleteFromS3 = require("../middlewares/s3delete");
const SalesDashValidate = require("../validations/SalesAgentDash-validation")
const { buildFormattedPhone, sendSMS } = require("../utils/shoutout");


exports.getAllSalesAgents = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {

    const { page, limit, searchText, status, date } = await SalesDashValidate.getAllSalesAgentsSchema.validateAsync(req.query);

    const totalTarget = await SalesAgentDAO.getTotalTargetDao(date);
    const { items, total } = await SalesAgentDAO.getAllSalesAgentsDao(page, limit, searchText, status, date, totalTarget.targetValue);

    res.status(200).json({ items, total, totalTarget });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error retrieving price list:", error);
    return res.status(500).json({ error: "An error occurred while fetching the price list" });
  }
};

exports.saveTarget = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  let backupTargets = [];
  try {
    const userId = req.user.userId;
    const target = req.body;

    backupTargets = await SalesAgentDAO.getAllTargets();
    await SalesAgentDAO.removeTargetDao();

    const results = await SalesAgentDAO.saveTargetDao(target, userId);

    if (results.affectedRows === 0) {
      await SalesAgentDAO.restoreTargets(backupTargets);
      return res.json({ status: false, message: "New Target failed, restored previous targets!" });
    }

    res.status(200).json({ status: true, message: "New Target added successfully!" });

  } catch (error) {
    if (backupTargets.length > 0) {
      await SalesAgentDAO.restoreTargets(backupTargets);
    }
    console.error("Error saving target:", error);
    return res.status(500).json({ error: "An error occurred while saving the target" });
  }
};





exports.getPendingWholesaleBuyers = async (req, res) => {
  console.log(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
  try {
    const { page, limit, searchText, onboarded, status } =
      await SalesDashValidate.getPendingWholesaleBuyersSchema.validateAsync(req.query);

    const { items, total } = await SalesAgentDAO.getPendingWholesaleBuyersDao({
      page,
      limit,
      searchText,
      onboarded,
      status,
    });

    res.status(200).json({ status: true, items, total });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ status: false, error: error.details[0].message });
    }
    console.error("Error fetching wholesale buyer applications:", error);
    res.status(500).json({ status: false, error: "An error occurred while fetching applications" });
  }
};

exports.getOnboardedOptions = async (req, res) => {
  try {
    const options = await SalesAgentDAO.getOnboardedOptionsDao();
    res.status(200).json({ status: true, options });
  } catch (error) {
    console.error("Error fetching onboarded options:", error);
    res.status(500).json({ status: false, error: "An error occurred while fetching options" });
  }
};

exports.getSalesAgents = async (req, res) => {
  try {
    const salesAgents = await SalesAgentDAO.getSalesAgents();
    res.status(200).json({ status: true, salesAgents });
  } catch (error) {
    console.error("Error fetching onboarded options:", error);
    res.status(500).json({ status: false, error: "An error occurred while fetching options" });
  }
};

exports.onboardWholesaleCustomer = async (req, res) => {
  console.log(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
  let brImgUrl = null;
  let dbDone = false;
 
  try {
    const data = await SalesDashValidate.onboardWholesaleCustomerSchema.validateAsync(req.body);
 
    if (!req.file) {
      return res.status(400).json({ status: false, error: "BR document is required" });
    }
 
    const exists = await SalesAgentDAO.checkMarketPlaceUserExistsDao(data);
    if (exists) {
      return res.status(409).json({
        status: false,
        error: "A user with this email, phone number or NIC/passport already exists",
      });
    }
 
    // Upload BR document to S3
    const ext = path.extname(req.file.originalname);
    const fileName = `${uuidv4()}${ext}`;
    brImgUrl = await uploadFileToS3(req.file.buffer, fileName, "wholesale/br-documents");
 
    // Initial password = NIC / passport number (hashed)
    const hashedPassword = await bcrypt.hash(data.nic, 10);
 
    const result = await SalesAgentDAO.createWholesaleCustomerDao({
      ...data,
      password: hashedPassword,
      brImg: brImgUrl,
    });
    dbDone = true;
 
    // ---- DB succeeded: send welcome SMS (failure must NOT fail the request) ----
    let smsSent = false;
    try {
      const formattedPhone = buildFormattedPhone(data.phoneCode, data.phoneNumber);
      if (!formattedPhone) {
        throw new Error(`Invalid phone number: ${data.phoneCode}${data.phoneNumber}`);
      }
 
      const username = formattedPhone.replace("+", ""); // 947XXXXXXXX
 
      const message = `Welcome to Polygon!
Your registration as a wholesale customer has been successfully completed.
Your Login Credentials:
Username: ${username} / ${data.email}
Password: ${data.nic}
You can log in and start placing orders once your business verification is completed by our administration team. This process may take 24–48 hours.
Best Regards,
Polygon Team`;
 
      await sendSMS(formattedPhone, message);
      smsSent = true;
      console.log(`✅ Welcome SMS sent to ${formattedPhone}`);
    } catch (smsError) {
      console.error("⚠️ Welcome SMS failed (customer was created):", smsError.message);
    }
 
    return res.status(201).json({
      status: true,
      message: "Wholesale customer onboarded and sent for approval",
      smsSent,
      ...result,
    });
  } catch (error) {
    // Clean up S3 only if the DB work did not complete
    if (brImgUrl && !dbDone) {
      try {
        await deleteFromS3(brImgUrl);
      } catch (e) {
        console.error("Failed to clean up S3 file:", e);
      }
    }
 
    if (error.isJoi) {
      return res.status(400).json({ status: false, error: error.details[0].message });
    }
    console.error("Error onboarding wholesale customer:", error);
    return res.status(500).json({ status: false, error: "An error occurred while onboarding the customer" });
  }
};