const jwt = require("jsonwebtoken");
const db = require("../startup/database");
const bodyParser = require("body-parser");
const path = require("path");
const PermissionsDao = require("../dao/Permission-dao");
const ValidateSchema = require("../validations/Permission-validation");
const fs = require("fs");
const xlsx = require("xlsx");
const deleteFromS3 = require("../middlewares/s3delete");
const uploadFileToS3 = require("../middlewares/s3upload");

exports.getAllFeatures = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  try {
    const features = await PermissionsDao.getAllFeatures();

    console.log("Successfully fetched admin roles");
    res.json({
      features,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.getAllRoleFeatures = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  try {
    const id = req.params.id;
    const role_features = await PermissionsDao.getAllRoleFeatures(id);

    console.log("Successfully fetched admin roles");
    res.json({
      role_features,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.createRoleFeature = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    console.log(req.body);

    const { role_id, position_id, feature_id } = req.body;

    const roleFeature = await PermissionsDao.createRoleFeature(
      role_id,
      position_id,
      feature_id
    );

    return res.status(201).json({
      message: "roleFeature created successfully",
      id: roleFeature,
      status: true,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while creating roleFeature" });
  }
};

exports.deleteMarketPrice = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    const { id } = await ValidateSchema.deleteReloFeature.validateAsync(
      req.params
    );
    const result = await PermissionsDao.deleteRoleFeature(id);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Role Feature not found" });
    }
    console.log("Role Feature deleted successfully");
    return res
      .status(200)
      .json({ message: "Role Feature deleted successfully" });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error deleting Role Feature:", err);
    return res.status(500).json({
      error: "An error occurred while deleting Role Feature",
    });
  }
};

exports.createAdminRole = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    console.log(req.body);

    const { role, email } = req.body;

    const adminRoleId = await PermissionsDao.createAdminRole(role, email);

    return res.status(201).json({
      message: "Admin role created successfully",
      id: adminRoleId,
      status: true,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res.status(500).json({
      error: "An error occurred while creating the admin role",
    });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    console.log("Request Body:", req.body);

    const { categoryId, newCategory, feature } = req.body;

    if (!feature) {
      return res.status(400).json({
        error: "Feature is required",
      });
    }

    let createFeature;

    const checkFeature = await PermissionsDao.CheckFeatureDao(feature);
    console.log("checkFeature", checkFeature);
    console.log('----------------------------------------------------------');


    if (checkFeature.length > 0) {
      return res.json({ status: false, message: "You already added this feature to the list" })
    }

    if (newCategory) {
      if (!newCategory.trim()) {
        return res.status(400).json({
          error: "New category name cannot be empty",
        });
      }

      console.log('----------------------------------------------------------');



      const createdCategory = await PermissionsDao.createCategoryDao(newCategory);

      createFeature = await PermissionsDao.createFeature(createdCategory.id, feature);

    } else if (categoryId) {
      createFeature = await PermissionsDao.createFeature(categoryId, feature);
    } else {
      return res.status(400).json({
        error: "Either 'newCategory' or 'categoryId' is required",
      });
    }

    return res.status(201).json({
      message: "Feature created successfully",
      featureId: createFeature.insertId,
      status: true,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res.status(500).json({
      error: "An error occurred while creating the category or feature",
    });
  }
};




exports.getAllFeatureCategories = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  try {
    const featureCategories = await PermissionsDao.getAllFeatureCategories();

    console.log("Successfully fetched feature categories");
    res.json({
      featureCategories,
    });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};



exports.editFeatureName = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  try {
    const validateData = await ValidateSchema.editFeatureNameSchema.validateAsync(req.body);
    console.log(validateData);


    const result = await PermissionsDao.editFeatureName(validateData);

    console.log(result);
    if (result.affectedRows === 0) {
      return res.json({ status: false, message: "Unsuccessfull, Try again Later!" })
    }
    console.log("Successfully fetched admin roles");

    res.status(200).json({ status: true, message: "Successfuly Edited Feature Name!" });

  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};


exports.editCategoryName = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  try {
    const validateData = await ValidateSchema.editCategoryNameSchema.validateAsync(req.body);
    console.log(validateData);


    const result = await PermissionsDao.editCategoryName(validateData);

    console.log(result);
    if (result.affectedRows === 0) {
      return res.json({ status: false, message: "Unsuccessfull, Try again Later!" })
    }
    console.log("Successfully updated category name");

    res.status(200).json({ status: true, message: "Successfuly Edited Category Name!" });

  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};
