const jwt = require("jsonwebtoken");
const db = require("../startup/database");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const { log } = require("console");
const ComplainCategoryDAO = require("../dao/ComplainCategory-dao");
const DashDAO = require("../dao/Dash-dao");
const ValidateSchema = require("../validations/Admin-validation");
const { type } = require("os");
const bcrypt = require("bcryptjs");

const { v4: uuidv4 } = require("uuid");
const uploadFileToS3 = require("../middlewares/s3upload");
const deleteFromS3 = require("../middlewares/s3delete");
const ComplainCategoryValidate = require("../validations/ComplainCategory-validation");

exports.getAllSystemApplications = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const result = await ComplainCategoryDAO.getAllSystemApplicationData();
    console.log("dfdgdgd", result);

    console.log("Successfully fetched collection officers");
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};
exports.getApplicationName = async (req, res) => {
  const { id } = req.params;
  try {
    const appName = await ComplainCategoryDAO.getApplicationNameById(id);
    if (!appName) {
      return res.status(404).json({ message: 'Application not found' });
    }
    res.status(200).json({ appName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getComplainCategoriesByAppId = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const validatedQuery =
      await ComplainCategoryValidate.getComplainCategoriesSchema.validateAsync({
        systemAppId: req.params.systemAppId,
      });
    const { systemAppId } = validatedQuery;
    // const systemAppId = req.params.id;

    const categories = await ComplainCategoryDAO.getComplainCategoryData(
      systemAppId
    );
    // console.log(categories)

    if (!categories) {
      return res.status(404).json({ message: "Complain categories not found" });
    }
    // console.log("Data---->", categories);

    res.status(200).json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};



exports.postNewApplication = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const validatedQuery =
      await ComplainCategoryValidate.addNewApplicationSchema.validateAsync({
        applicationName: req.params.applicationName,
      });
    const { applicationName } = validatedQuery;
    console.log("this is", applicationName);

    // Check for duplicate
    const exists = await ComplainCategoryDAO.checkApplicationExists(applicationName);
    if (exists) {
      return res.status(409).json({
        status: false,
        message: "Application name already exists",
      });
    }

    const result = await ComplainCategoryDAO.addNewApplicationData(applicationName);
    console.log(result);

    if (!result) {
      return res.status(500).json({ message: "Application was not added successfully" });
    }

    res.status(200).json({ message: "Application added successfully", result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};





exports.editApplication = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const validatedQuery =
      await ComplainCategoryValidate.editApplicationSchema.validateAsync(
        req.query
      );
    const { systemAppId, applicationName } = validatedQuery;

    // 🔒 Check for duplicate name
    const exists = await ComplainCategoryDAO.checkApplicationNameExists(
      applicationName,
      systemAppId
    );

    if (exists) {
      return res.status(409).json({
        message: "An application with this name already exists",
      });
    }

    const result = await ComplainCategoryDAO.editApplicationData(
      systemAppId,
      applicationName
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Application was not updated" });
    }

    res
      .status(200)
      .json({ message: "Application edited successfully", result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteApplicationByAppId = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    // console.log("going to validate");

    const validatedQuery =
      await ComplainCategoryValidate.deleteApplicationSchema.validateAsync({
        systemAppId: req.params.systemAppId,
      });
    const { systemAppId } = validatedQuery;
    // const systemAppId = req.params.systemAppId;
    console.log("this is", systemAppId);

    const result = await ComplainCategoryDAO.deleteApplicationData(systemAppId);
    console.log(result);

    if (!result) {
      return res.status(404).json({ message: "application not found" });
    }

    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAdminComplaintsCategory = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const adminRoles = await ComplainCategoryDAO.getAdminRolesDao();
    const systemApps = await ComplainCategoryDAO.getSystemApplicationDao();

    res.status(200).json({ adminRoles, systemApps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.AddNewComplaintCategory = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const complainCategory =
      await ComplainCategoryValidate.AddNewComplainCategorySchema.validateAsync(
        req.body
      );

    // Check if the category already exists
   const exists = await ComplainCategoryDAO.CheckCategoryEnglishExists(
  complainCategory.categoryEnglish,
  complainCategory.appId
);

    if (exists) {
      return res.status(409).json({
        status: false,
        message: "Category already added",
      });
    }

    const result = await ComplainCategoryDAO.AddNewComplainCategoryDao(complainCategory);
    console.log(result);

    if (result.affectedRows === 0) {
      return res.status(500).json({ status: false, message: "Insert failed" });
    }

    res.status(200).json({ status: true, message: "Category added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.getCategoriesDetailsById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { id } = await ComplainCategoryValidate.IdParamsSchema.validateAsync(
      req.params
    );

    const categories = await ComplainCategoryDAO.getCategoriDetailsByIdDao(id);

    if (!categories) {
      return res.status(404).json({ message: "Complain categories not found" });
    }
    // console.log("Data---->", categories);

    res.status(200).json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.EditComplaintCategory = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const complainCategory =
      await ComplainCategoryValidate.EditComplainCategorySchema.validateAsync(
        req.body
      );

    const result = await ComplainCategoryDAO.EditComplainCategoryDao(
      complainCategory
    );
    console.log(result);
    if (result.affectedRows === 0) {
      return res.json({ status: false });
    }

    res.status(200).json({ status: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllSalesAgentComplains = async (req, res) => {
  try {
    console.log(req.query);
    const { page, limit, status, category, comCategory, searchText, replyStatus } =
      req.query;

    const { results, total } = await DashDAO.GetAllSalesAgentComplainDAO(
      page,
      limit,
      status,
      category,
      comCategory,
      searchText,
      replyStatus
    );

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

exports.getComplainById = async (req, res) => {
  try {
    const id = req.params.id;

    const result = await DashDAO.getComplainById(id);
    console.log(result[0]);

    if (result.length === 0) {
      return res
        .status(404)
        .json({ message: "No Complain foundd", data: result[0] });
    }

    console.log("Successfully retrieved Farmer Complain");
    res.json(result[0]);
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

exports.sendComplainReply = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log(fullUrl);

    const complaignId = req.params.id;

    const reply = req.body.reply;
    console.log("Collection Centr", complaignId, reply);

    if (reply === null) {
      return res.status(401).json({ error: "Reply can not be empty" });
    }

    const result = await DashDAO.sendComplainReply(complaignId, reply);

    console.log("Send Reply Success");
    return res.status(201).json({ result: result, status: true });
  } catch (err) {
    if (err.isJoi) {
      return res
        .status(400)
        .json({ error: err.details[0].message, status: false });
    }
    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while creating Reply tasks" });
  }
};


exports.getAllMarketplaceComplaints = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    // Fetch all complaints from the marketplacecomplain table
    const complaints = await ComplainCategoryDAO.getAllMarketplaceComplaints();

    if (!complaints || complaints.length === 0) {
      return res.status(404).json({ message: "No complaints found" });
    }

    res.status(200).json(complaints);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllMarketplaceComplaintsWholesale = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    // Fetch all complaints from the marketplacecomplain table
    const complaints = await ComplainCategoryDAO.getAllMarketplaceComplaintsWholesale();

    if (!complaints || complaints.length === 0) {
      return res.status(404).json({ message: "No complaints found" });
    }

    res.status(200).json(complaints);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getMarketplaceComplaintById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    // Extract complaintId from URL parameters
    const { id } = req.params;

    // Validate complaintId
    if (!id || isNaN(id)) {
      return res.status(400).json({ message: "Invalid complaint ID" });
    }

    // Fetch the specific complaint using the DAO function
    const complaint = await ComplainCategoryDAO.getMarketplaceComplaintById(id);

    // Check if complaint exists
    if (!complaint || !complaint.status || !complaint.data) {
      return res.status(404).json({ message: "No complaint found with the specified ID" });
    }

    res.status(200).json(complaint);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateMarketplaceComplaintReply = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    // Extract complaintId from URL parameters and reply from body
    const { id } = req.params;
    const { reply } = req.body;

    // Validate complaintId
    if (!id || isNaN(id)) {
      return res.status(400).json({ message: "Invalid complaint ID" });
    }

    // Validate reply
    if (!reply || typeof reply !== 'string' || reply.trim() === '') {
      return res.status(400).json({ message: "Reply is required " });
    }

    // Update the complaint reply using the DAO function
    const result = await ComplainCategoryDAO.updateMarketplaceComplaintReply(id, reply);

    // Check if update was successful
    if (!result || !result.status) {
      return res.status(404).json({ message: "No complaint found with the specified ID" });
    }

    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};


// Controller method
exports.getComplaintCategoriesByAppId = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    // Validate appId from request params (assuming it comes as a string number)
    const validatedQuery = await ComplainCategoryValidate.getCategoriesByAppIdSchema.validateAsync({
      appId: req.params.appId,
    });
    const { appId } = validatedQuery;
    console.log("Fetching complaint categories for appId:", appId);

    // Call your DAO method which returns a Promise
    const result = await ComplainCategoryDAO.getComplaintCategoryFromMarketplace(appId);

    if (!result || result.length === 0) {
      return res.status(404).json({ message: "No complaint categories found for this appId" });
    }

    // Return the categories
    res.status(200).json({ categories: result });
  } catch (err) {
    console.error("[getComplaintCategoriesByAppId] Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
