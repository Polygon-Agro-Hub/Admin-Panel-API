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
  
      const {page, limit, searchText, status, date } = await SalesDashValidate.getAllSalesAgentsSchema.validateAsync(req.query);
      console.log({page, limit, searchText, status, date });
      // const { items, total } = await PriceListDAO.getAllPriceListDao(centerId, page, limit, grade, searchText);

      const totalTarget = await SalesAgentDAO.getTotalTargetDao(date);
      const { items, total } = await SalesAgentDAO.getAllSalesAgentsDao(page, limit, searchText, status, date, totalTarget.targetValue);
  
      // console.log({ totalTarget, total });
  
      console.log("Successfully retrieved price list");
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
    let backupTargets = []; // <--- Backup here
  
    try {
      console.log(req.body);
      const userId = req.user.userId;
      const target = req.body;
  
      // 1. Backup current target data
      backupTargets = await SalesAgentDAO.getAllTargets();
  
      // 2. Delete all existing targets
      await SalesAgentDAO.removeTargetDao();
      
      // 3. Try to insert the new target
      const results = await SalesAgentDAO.saveTargetDao(target, userId);
  
      if (results.affectedRows === 0) {
        // Insert failed, restore previous data
        await SalesAgentDAO.restoreTargets(backupTargets);
        return res.json({ status: false, message: "New Target failed, restored previous targets!" });
      }
  
      res.status(200).json({ status: true, message: "New Target added successfully!" });
  
    } catch (error) {
      // If anything fails, also try to restore backup
      if (backupTargets.length > 0) {
        await SalesAgentDAO.restoreTargets(backupTargets);
      }
      console.error("Error saving target:", error);
      return res.status(500).json({ error: "An error occurred while saving the target" });
    }
  };
  

//not usage
  // exports.getDailyTarget = async (req, res) => {
  //   const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  //   console.log(fullUrl);
  //   try {

      
  //     const { results } = await SalesAgentDAO.getDailyTarget();
  //     console.log(results);
  
  //     res.status(200).json(results);
  //   } catch (error) {
  //     // if (error.isJoi) {
  //     //   return res.status(400).json({ error: error.details[0].message });
  //     // }
  
  //     console.error("Error retrieving price list:", error);
  //     return res.status(500).json({ error: "An error occurred while fetching the price list" });
  //   }
  // };

