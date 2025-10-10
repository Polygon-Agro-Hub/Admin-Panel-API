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

    const jobRoleOfficerCount = await StakeholderDao.getCollectionOfficersByPosition();
    const newOfficerCount = await StakeholderDao.getNewCollectionOfficers();
    const activeOfficers = await StakeholderDao.getActiveCollectionOfficers();

    const activeSalesAgents = await StakeholderDao.getActiveSalesAgents();
    const newSalesAgents = await StakeholderDao.getNewSalesAgents();
    const allSalesAgents = await StakeholderDao.getAllSalesAgents();

    res.status(200).json(
      {
        firstRow: {
          adminUsersByPosition: adminUsersByPosition,
          todayAdmin: TodayAdminUsers
        },
        secondRow: {
          QRfarmers: QRfarmers,
          TodayFarmers: TodayFarmers,
          activeFarmers: activeFarmers
        },
        thirdRow: {
          jobRoleOfficerCount: jobRoleOfficerCount,
          newOfficerCount: newOfficerCount,
          activeOfficers: activeOfficers
        },
        fourthRow: {
          allSalesAgents: allSalesAgents,
          newSalesAgents: newSalesAgents,
          activeSalesAgents: activeSalesAgents
        }
      })
  } catch (error) {


    console.error("Error fetching collection officers:", error);
    return res.status(500).json({ error: "An error occurred while fetching collection officers" });
  }
};

  exports.getAllFieldOfficers = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const officers = await StakeholderDao.getAllFieldOfficers();
    res.status(200).json({ status: true, data: officers });
  } catch (error) {
    console.error("Error fetching field officers:", error);
    res.status(500).json({ status: false, error: "An error occurred while fetching field officers" });
  }
};