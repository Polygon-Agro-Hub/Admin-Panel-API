const jwt = require("jsonwebtoken");
const db = require("../startup/database");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const { log } = require("console");
const StakeholderDao = require("../dao/Stakeholder-dao");
const ValidateSchema = require("../validations/Admin-validation");
const { type } = require("os");
const bcrypt = require("bcryptjs");

const { v4: uuidv4 } = require("uuid");
const uploadFileToS3 = require("../middlewares/s3upload");
const deleteFromS3 = require("../middlewares/s3delete");

exports.getAdminUserData = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const adminUsersByPosition = await StakeholderDao.getAdminUsersByPosition();
    const TodayAdminUsers = await StakeholderDao.getTodayRegAdmin();

    const QRfarmers = await StakeholderDao.getPlantCareUserByQrRegistration();
    const TodayFarmers = await StakeholderDao.getNewPlantCareUsers();
    const activeFarmers = await StakeholderDao.getActivePlantCareUsers();

    const jobRoleOfficerCount =
      await StakeholderDao.getCollectionOfficersByPosition();
    const newOfficerCount = await StakeholderDao.getNewCollectionOfficers();
    const activeOfficers = await StakeholderDao.getActiveCollectionOfficers();

    const activeSalesAgents = await StakeholderDao.getActiveSalesAgents();
    const newSalesAgents = await StakeholderDao.getNewSalesAgents();
    const allSalesAgents = await StakeholderDao.getAllSalesAgents();

    res.status(200).json({
      firstRow: {
        adminUsersByPosition: adminUsersByPosition,
        todayAdmin: TodayAdminUsers,
      },
      secondRow: {
        QRfarmers: QRfarmers,
        TodayFarmers: TodayFarmers,
        activeFarmers: activeFarmers,
      },
      thirdRow: {
        jobRoleOfficerCount: jobRoleOfficerCount,
        newOfficerCount: newOfficerCount,
        activeOfficers: activeOfficers,
      },
      fourthRow: {
        allSalesAgents: allSalesAgents,
        newSalesAgents: newSalesAgents,
        activeSalesAgents: activeSalesAgents,
      },
    });
  } catch (error) {
    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};

// Get all field officers with filters
exports.getAllFieldOfficers = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  // Get filter parameters from query string
  const { status, language, district, role, search } = req.query;

  console.log("Filter parameters:", {
    status,
    language,
    district,
    role,
    search,
  });

  try {
    const officers = await StakeholderDao.getAllFieldOfficers({
      status,
      language,
      district,
      role,
      search,
    });
    res.status(200).json({ status: true, data: officers });
  } catch (error) {
    console.error("Error fetching field officers:", error);
    res.status(500).json({
      status: false,
      error: "An error occurred while fetching field officers",
    });
  }
};

// Update status and send password email to field officer
exports.UpdateStatusAndSendPassword = async (req, res) => {
  try {
    const { id, status } = req.params;

    // Validation
    if (!id || !status) {
      return res
        .status(400)
        .json({ message: "ID and status are required.", status: false });
    }

    // Get field officer details
    const officerData = await StakeholderDao.getFieldOfficerEmailDao(id);
    if (!officerData) {
      return res
        .status(404)
        .json({ message: "Field officer not found.", status: false });
    }

    const { email, firstName, empId } = officerData;
    console.log(`Email: ${email}, Name: ${firstName}, Emp ID: ${empId}`);

    // Generate random password
    const generatedPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    // Update status and password
    const updateResult =
      await StakeholderDao.UpdateFieldOfficerStatusAndPasswordDao({
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

    // Send password email if approved
    if (status === "Approved") {
      const emailResult = await StakeholderDao.SendGeneratedPasswordDao(
        email,
        generatedPassword,
        empId,
        firstName
      );

      if (!emailResult.success) {
        return res.status(500).json({
          message: "Failed to send password email.",
          error: emailResult.error,
        });
      }
    }

    res.status(200).json({
      message: "Status updated and password sent successfully.",
      status: true,
      data: {
        empId,
        email,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "An error occurred.", error });
  }
};
