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