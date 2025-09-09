const jwt = require("jsonwebtoken");
const db = require("../startup/database");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const { log } = require("console");
const adminDao = require("../dao/Admin-dao");
const ValidateSchema = require("../validations/Admin-validation");
const { type } = require("os");
const bcrypt = require("bcryptjs");

const { v4: uuidv4 } = require("uuid");
const uploadFileToS3 = require("../middlewares/s3upload");
const deleteFromS3 = require("../middlewares/s3delete");
const SECRET_KEY = "agroworldadmin";
const CryptoJS = require("crypto-js");

function encryptResponse(data, secretKey) {
  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(data),
    secretKey
  ).toString();
  return { data: encrypted };
}

exports.loginAdmin = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const encrypted = req.body.data;
    if (!encrypted) {
      return res.status(400).json({ error: "Missing encrypted data" });
    }

    let decrypted;
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
      const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
      decrypted = JSON.parse(decryptedStr);
    } catch (err) {
      return res.status(400).json({ error: "Invalid encrypted data format" });
    }
    // Validate request body
    await ValidateSchema.loginAdminSchema.validateAsync(decrypted);

    const { email, password } = decrypted;

    // Fetch user and permissions from the database
    const [user] = await adminDao.loginAdmin(email);

    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    const verify_password = bcrypt.compareSync(password, user.password);

    if (!verify_password) {
      return res.status(401).json({ error: "Wrong password." });
    }

    // Fetch permissions based on the user's role
    const permissions = await adminDao.getPermissionsByRole(
      user.role,
      user.position
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        position: user.position,
        permissions,
      },
      process.env.JWT_SECRET,
      { expiresIn: "5h" }
    );

    // Construct response data
    const data = {
      token,
      userId: user.id,
      role: user.role,
      position: user.position,
      userName: user.userName,
      permissions,
      expiresIn: 18000,
    };

    const encryptedResponse = encryptResponse(data, SECRET_KEY);
    res.json(encryptedResponse);
  } catch (err) {
    console.error("Error during login:", err);

    if (err.isJoi) {
      // Validation error
      return res
        .status(400)
        .json({ error: "Invalid input data", details: err.details });
    }

    // For any other unexpected errors, keep the 500 status
    res.status(500).json({ error: "An internal server error occurred." });
  }
};

exports.getAllAdminUsers = async (req, res) => {
  try {
    const { page, limit, role, search } =
      await ValidateSchema.getAllAdminUsersSchema.validateAsync(req.query);
    const offset = (page - 1) * limit;

    const { total, items } = await adminDao.getAllAdminUsers(
      limit,
      offset,
      role,
      search
    );

    console.log("Successfully fetched admin users");
    res.json({
      items,
      total,
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

// exports.getMe = (req, res) => {
//   const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
//   console.log(fullUrl);
//   const userId = req.user.userId;
//   const sql = "SELECT id, mail, userName, role FROM adminusers WHERE id = ?";
//   db.query(sql, [userId], (err, results) => {
//     if (err) {
//       console.error("Error executing query:", err);
//       return res
//         .status(500)
//         .json({ error: "An error occurred while fetching user details." });
//     }
//     if (results.length === 0) {
//       return res.status(404).json({ error: "User not found." });
//     }
//     const user = results[0];
//     console.log("Fetch user success");
//     res.json({
//       id: user.id,
//       userName: user.userName,
//       mail: user.mail,
//       role: user.role,
//       password: user.password,
//     });
//   });
// };

exports.getMe = async (req, res) => {
  try {
    // Retrieve userId from the request object
    const userId = req.user.userId;

    // Fetch user details using the DAO function
    const user = await adminDao.getMeById(userId);

    console.log("Successfully fetched user details");

    // Respond with the user details
    res.json({
      id: user.id,
      userName: user.userName,
      mail: user.mail,
      role: user.role,
      position: user.position,
    });
  } catch (err) {
    if (err.message === "User not found.") {
      // User not found
      return res.status(404).json({ error: "User not found." });
    }

    console.error("Error fetching user details:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching user details." });
  }
};

exports.adminCreateUser = async (req, res) => {
  try {
    // Validate the request body
    const { firstName, lastName, phoneNumber, NICnumber } =
      await ValidateSchema.adminCreateUserSchema.validateAsync(req.body);

    const results = await adminDao.adminCreateUser(
      firstName,
      lastName,
      phoneNumber,
      NICnumber
    );

    console.log("User create success");
    return res.status(200).json(results);
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while Creating User" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    console.log(req.query);

    const { page, limit, nic, regStatus, district } =
      await ValidateSchema.getAllUsersSchema.validateAsync(req.query);
    const offset = (page - 1) * limit;

    const { total, items } = await adminDao.getAllUsers(
      limit,
      offset,
      nic,
      regStatus,
      district
    );

    console.log("Successfully fetched users");
    res.json({
      items,
      total,
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

exports.createOngoingCultivations = async (req, res) => {
  try {
    // Validate the request body
    const { userId, cropCalenderId } =
      await ValidateSchema.createOngoingCultivationsSchema.validateAsync(
        req.body
      );

    const results = await adminDao.createOngoingCultivations(
      userId,
      cropCalenderId
    );

    console.log("Ongoing cultivation create success");
    return res.status(200).json(results);
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while Creating Ongoing cultivation" });
  }
};

exports.createNews = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    console.log(req.body);

    // Validate the request body
    const {
      titleEnglish,
      titleSinhala,
      titleTamil,
      descriptionEnglish,
      descriptionSinhala,
      descriptionTamil,
      status,
      publishDate,
      expireDate,
    } = await ValidateSchema.createNewsSchema.validateAsync(req.body);

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Get file buffer (binary data)
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;

    const image = await uploadFileToS3(fileBuffer, fileName, "content/image");

    // Call DAO to save news and the image file as longblob
    const newsId = await adminDao.createNews(
      titleEnglish,
      titleSinhala,
      titleTamil,
      descriptionEnglish,
      descriptionSinhala,
      descriptionTamil,
      image,
      status,
      publishDate,
      expireDate
    );

    console.log("News creation success");
    return res
      .status(201)
      .json({ message: "News created successfully", id: newsId });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while creating News" });
  }
};

exports.getAllNews = async (req, res) => {
  try {
    console.log("Received request with query:", req.query);

    // Validate query parameters
    const { page, limit, status, createdAt } =
      await ValidateSchema.getAllNewsSchema.validateAsync(req.query);
    console.log("News:", page, limit, status, createdAt);

    const offset = (page - 1) * limit;

    const result = await adminDao.getAllNews(limit, offset, status, createdAt);

    // if (result.items.length === 0) {
    //   return res
    //     .json({ message: "No news items found", data: result , status:false});
    // }

    console.log("Successfully retrieved all contents");
    res.json(result);
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

exports.createCropCalenderAddTask = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log(fullUrl);

    // Validate request body
    const { cropId, tasks } =
      await ValidateSchema.createCropCalenderTaskSchema.validateAsync(req.body);

    // Call DAO to insert the tasks
    const result = await adminDao.createCropCalenderTasks(cropId, tasks);

    console.log("Crop Calendar tasks creation success");
    return res.status(200).json(result);
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while creating Crop Calendar tasks" });
  }
};

exports.getNewsById = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log(fullUrl);

    // Validate the ID parameter
    const { id } = await ValidateSchema.getNewsByIdSchema.validateAsync(
      req.params
    );

    // Call the DAO to get the news item by ID
    const news = await adminDao.getNewsById(id);

    if (news.length === 0) {
      return res.status(404).json({ message: "News not found" });
    }

    // Convert image buffer to base64 string if image exists
    // if (news[0].image) {
    //   const base64Image = Buffer.from(news[0].image).toString("base64");
    //   const mimeType = "image/png"; // Adjust MIME type if necessary, depending on the image type
    //   news[0].image = `data:${mimeType};base64,${base64Image}`;
    // }

    console.log("Successfully fetched the news content");
    return res.status(200).json(news);
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the news content" });
  }
};

exports.getCropCalenderById = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log(fullUrl);

    // Validate the ID parameter
    const { id } = await ValidateSchema.getCropCalenderByIdSchema.validateAsync(
      req.params
    );

    // Call the DAO to get crop calendar by ID
    const cropCalender = await adminDao.getCropCalenderById(id);

    if (cropCalender.length === 0) {
      return res.status(404).json({ message: "Crop Calendar not found" });
    }

    if (cropCalender[0].image) {
      const base64Image = Buffer.from(cropCalender[0].image).toString("base64");
      const mimeType = "image/png"; // Adjust MIME type if necessary, depending on the image type
      cropCalender[0].image = `data:${mimeType};base64,${base64Image}`;
    }

    console.log("Successfully fetched the crop calendar data");
    return res.status(200).json(cropCalender);
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the crop calendar" });
  }
};

exports.editNewsStatus = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    // Validate the `id` parameter
    const { id } = await ValidateSchema.editNewsStatusSchema.validateAsync(
      req.params
    );

    // Retrieve the current status from the DAO
    const result = await adminDao.getNewsStatusById(id);

    if (result.length === 0) {
      return res.status(404).json({ error: "Content not found" });
    }

    const currentStatus = result[0].status;

    let newStatus;
    if (currentStatus === "Draft") {
      newStatus = "Published";
    } else if (currentStatus === "Published") {
      newStatus = "Draft";
    } else {
      return res.status(400).json({ error: "Invalid current status" });
    }

    // Update the status using the DAO
    await adminDao.updateNewsStatusById(id, newStatus);

    console.log("Status updated successfully");
    return res.status(200).json({ message: "Status updated successfully" });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while updating the status" });
  }
};

exports.createMarketPrice = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    // Validate the request body
    const {
      titleEnglish,
      titleSinhala,
      titleTamil,

      status,
      price,
      createdBy,
    } = await ValidateSchema.createMarketPriceSchema.validateAsync(req.body);

    // Check if the file is uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileBuffer = req.file.buffer;

    // Call the DAO to create the market price entry
    const insertId = await adminDao.createMarketPrice(
      titleEnglish,
      titleSinhala,
      titleTamil,

      fileBuffer,
      status,
      price,
      createdBy
    );

    console.log("Market price created successfully");
    return res.status(201).json({
      message: "Market price created successfully",
      id: insertId,
    });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing request:", err);
    return res.status(500).json({
      error: "An error occurred while creating the market price",
    });
  }
};

exports.getAllMarketPrice = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    // Validate query parameters
    const {
      page = 1,
      limit = 10,
      status,
      createdAt,
    } = await ValidateSchema.getAllMarketPriceSchema.validateAsync(req.query);

    // Calculate offset
    const offset = (page - 1) * limit;

    // Fetch data from the DAO
    const { total, dataResults } = await adminDao.getAllMarketPrice(
      status,
      createdAt,
      limit,
      offset
    );

    console.log("Successfully fetched market prices");
    return res.json({
      items: dataResults,
      total: total,
      page: page,
      limit: limit,
    });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching market prices:", err);
    return res.status(500).json({
      error: "An error occurred while fetching market prices",
    });
  }
};

exports.deleteMarketPrice = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    // Validate request parameters
    const { id } = await ValidateSchema.deleteMarketPriceSchema.validateAsync(
      req.params
    );

    // Call the DAO to delete the market price
    const result = await adminDao.deleteMarketPriceById(id);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Market price not found" });
    }

    console.log("Market price deleted successfully");
    return res
      .status(200)
      .json({ message: "Market price deleted successfully" });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error deleting market price:", err);
    return res.status(500).json({
      error: "An error occurred while deleting market price",
    });
  }
};

exports.editMarketPriceStatus = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    // Validate the `id` parameter
    const { id } =
      await ValidateSchema.editMarketPriceStatusSchema.validateAsync(
        req.params
      );

    // Fetch the current status of the market price
    const result = await adminDao.getMarketPriceStatusById(id);

    if (result.length === 0) {
      return res.status(404).json({ error: "Market price not found" });
    }

    const currentStatus = result[0].status;
    let newStatus;

    // Toggle between 'Draft' and 'Published'
    if (currentStatus === "Draft") {
      newStatus = "Published";
    } else if (currentStatus === "Published") {
      newStatus = "Draft";
    } else {
      return res.status(400).json({ error: "Invalid current status" });
    }

    // Update the status using the DAO
    await adminDao.updateMarketPriceStatusById(id, newStatus);

    console.log("Status updated successfully");
    return res.status(200).json({ message: "Status updated successfully" });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error updating market price status:", err);
    return res.status(500).json({
      error: "An error occurred while updating the market price status",
    });
  }
};

exports.getMarketPriceById = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    // Validate the `id` parameter
    const { id } = await ValidateSchema.getMarketPriceByIdSchema.validateAsync(
      req.params
    );

    // Fetch market price data by ID
    const result = await adminDao.getMarketPriceById(id);

    if (result.length === 0) {
      return res.status(404).json({ error: "Market price not found" });
    }
    if (result[0].image) {
      const base64Image = Buffer.from(result[0].image).toString("base64");
      const mimeType = "image/png"; // Adjust MIME type if necessary, depending on the image type
      result[0].image = `data:${mimeType};base64,${base64Image}`;
    }

    console.log("Successfully fetched market price");
    return res.status(200).json(result);
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching market price:", err);
    return res.status(500).json({
      error: "An error occurred while fetching the market price",
    });
  }
};

exports.editMarketPrice = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    // Validate input data
    const { id } = req.params;
    const body = await ValidateSchema.editMarketPriceSchema.validateAsync({
      ...req.body,
      id,
    });

    let imageData = null;
    if (req.file) {
      imageData = req.file.buffer; // Store the binary image data from req.file
    }

    // Call DAO to update the market price
    const updateData = {
      ...body,
      imageData,
    };

    await adminDao.editMarketPrice(id, updateData);

    console.log("Market price updated successfully");
    return res
      .status(200)
      .json({ message: "Market price updated successfully" });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error updating market price:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while updating market price" });
  }
};

exports.getAllOngoingCultivations = async (req, res) => {
  try {
    // Validate query parameters
    const queryParams =
      await ValidateSchema.getAllOngoingCultivationsSchema.validateAsync(
        req.query
      );

    console.log("queryParams", queryParams);

    const page = queryParams.page;
    const limit = queryParams.limit;
    const offset = (page - 1) * limit;
    const searchNIC = queryParams.nic || "";

    console.log("page", page, "limit", limit, "searchNIC", searchNIC);

    // Call DAO to fetch the cultivations
    const { total, items } = await adminDao.getAllOngoingCultivations(
      searchNIC,
      limit,
      offset
    );

    console.log("items", items);

    console.log("Successfully fetched ongoing cultivations");
    res.json({
      total,
      items,
    });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching ongoing cultivations:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.getOngoingCultivationsWithUserDetails = async (req, res) => {
  try {
    // Validate the request
    await ValidateSchema.getOngoingCultivationsWithUserDetailsSchema.validateAsync(
      req.query
    );

    // Fetch cultivations with user details from DAO
    const results = await adminDao.getOngoingCultivationsWithUserDetails();

    console.log("Successfully fetched ongoing cultivations with user details");
    res.status(200).json({
      items: results,
    });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching ongoing cultivations:", err);
    res.status(500).json({ error: "An error occurred while fetching data." });
  }
};

exports.getOngoingCultivationsById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    // Validate the request params (ID)
    const { id } =
      await ValidateSchema.getOngoingCultivationsByIdSchema.validateAsync(
        req.params
      );

    // Fetch cultivation crops data from DAO
    const results = await adminDao.getOngoingCultivationsById(id);

    console.log("Successfully fetched cultivation crops by ID");
    res.status(200).json(results);
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching cultivation crops:", err);
    res.status(500).json({ error: "An error occurred while fetching data." });
  }
};

exports.getFixedAssetsByCategory = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    // Validate the request params (id and category)
    const { id, category } =
      await ValidateSchema.getFixedAssetsByCategorySchema.validateAsync(
        req.params
      );

    // Fetch assets by category from DAO
    const results = await adminDao.getFixedAssetsByCategory(id, category);

    console.log("Successfully retrieved assets");
    res.status(200).json(results);
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    } else if (err === "Invalid category.") {
      return res.status(400).json({ error: "Invalid category." });
    }

    console.error("Error fetching assets:", err);
    res.status(500).json({ error: "An error occurred while fetching data." });
  }
};

exports.getCurrentAssetsByCategory = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    // Validate the request params (id and category)
    const { id, category } = req.params;
    // const { id, category } =
    // await ValidateSchema.getCurrentAssetsByCategorySchema.validateAsync(
    //     req.params
    // );

    // Fetch current assets by category from DAO
    const results = await adminDao.getCurrentAssetsByCategory(id, category);

    console.log("Successfully retrieved current assets");
    res.status(200).json(results);
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching current assets:", err);
    res.status(500).json({ error: "An error occurred while fetching data." });
  }
};

exports.deleteAdminUser = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    // Validate the request parameters (id)
    const { id } = await ValidateSchema.deleteAdminUserSchema.validateAsync(
      req.params
    );

    // Delete admin user by id from DAO
    const results = await adminDao.deleteAdminUserById(id);

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Admin user not found" });
    }

    console.log("Admin user deleted successfully");
    return res.status(200).json({ message: "Admin user deleted successfully" });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error deleting admin user:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting admin user" });
  }
};

exports.editAdminUser = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  const { id } = req.params;

  try {
    const { mail, userName, role, position } = req.body;

    // Update admin user in the DAO
    const results = await adminDao.updateAdminUserById(
      id,
      mail,
      userName,
      role,
      position
    );

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Admin user not found" });
    }

    console.log("Admin user updated successfully");
    return res.status(200).json({ message: "Admin user updated successfully" });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error updating admin user:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while updating admin user" });
  }
};

exports.editAdminUserWithoutId = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    // Validate the request body
    // const { id, mail, userName, role, position } =
    //   await ValidateSchema.editAdminUserWithoutIdSchema.validateAsync(req.body);

    const { id, mail, userName, role, position } = req.body;

    console.log(id, mail, userName, role, position);

    // Call DAO to update the user
    const results = await adminDao.updateAdminUser(
      id,
      mail,
      userName,
      role,
      position
    );

    if (results.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "No admin user found with the provided ID" });
    }

    console.log("Admin user updated successfully");
    return res.status(200).json({ message: "Admin user updated successfully" });
  } catch (err) {
    if (err.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error updating admin user:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while updating admin user" });
  }
};

exports.getAdminById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    // Validate request params
    const { id } = await ValidateSchema.getAdminByIdSchema.validateAsync(
      req.params
    );

    // Fetch admin user from DAO
    const results = await adminDao.getAdminUserById(id);

    if (results.length === 0) {
      return res
        .status(404)
        .json({ error: "No admin user found with the provided ID" });
    }

    console.log("Successfully retrieved admin user");
    return res.json(results);
  } catch (err) {
    if (err.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching admin user:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching admin user" });
  }
};

exports.editAdminUserPassword = async (req, res) => {
  try {
    // Validate the request body
    const { id, currentPassword, newPassword } =
      await ValidateSchema.editAdminUserPasswordSchema.validateAsync(req.body);

    // Retrieve the current hashed password from the DAO
    const passwordResults = await adminDao.getAdminPasswordById(id);

    if (passwordResults.length === 0) {
      return res.status(404).json({ error: "Admin user not found" });
    }

    const existingPassword = passwordResults[0].password;

    // Check if the provided current password matches the existing hashed password
    const isMatch = await bcrypt.compare(currentPassword, existingPassword);

    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash the new password before storing it in the database
    const hashedNewPassword = await bcrypt.hash(newPassword, 10); // 10 is the salt rounds

    // Update the password using the DAO with the hashed new password
    await adminDao.updateAdminPasswordById(id, hashedNewPassword);

    console.log("Password updated successfully");
    return res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    if (err.isJoi) {
      // Handle validation errors
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error updating password:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while updating the password" });
  }
};

exports.deletePlantCareUser = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const { id } = await ValidateSchema.deletePlantCareUserSchema.validateAsync(
      req.params
    );

    const user = await adminDao.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: "PlantCare User not found" });
    }

    const imageUrl = user.profileImage;

    // let s3Key;

    // if (imageUrl && imageUrl.startsWith(`https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`)) {
    //   s3Key = imageUrl.split(`https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`)[1];
    // }

    const result = await adminDao.deletePlantCareUserById(id);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Failed to delete PlantCare User" });
    }

    if (imageUrl) {
      try {
        await deleteFromS3(imageUrl);
      } catch (s3Error) {
        console.error("Failed to delete image from S3:", s3Error);
        // Optionally handle the failure, e.g., log but not block user deletion
      }
    }

    console.log("PlantCare User deleted successfully");
    return res.status(200).json({
      status: true,
      message: "PlantCare User deleted successfully",
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error deleting PlantCare User:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting PlantCare User" });
  }
};

// exports.updatePlantCareUser = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const validatedBody =
//       await ValidateSchema.updatePlantCareUserSchema.validateAsync(req.body);
//     const {
//       firstName,
//       lastName,
//       phoneNumber,
//       NICnumber,
//       district,
//       membership,
//     } = validatedBody;

//     let profileImage;
//     const user = await adminDao.getUserById(id);
//     if (!user) {
//       return res.status(404).json({ message: "PlantCare User not found" });
//     }

//     if (req.file) {
//       const imageUrl = user.profileImage;
//       await deleteFromS3(imageUrl);

//       const fileBuffer = req.file.buffer;
//       const fileName = req.file.originalname;
//       profileImage = await uploadFileToS3(
//         fileBuffer,
//         fileName,
//         "users/profile-images"
//       );
//     }

//     const userData = {
//       firstName,
//       lastName,
//       phoneNumber,
//       NICnumber,
//       district,
//       membership,
//       profileImage,
//     };

//     const result = await adminDao.updatePlantCareUserById(userData, id);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "PlantCare User not found" });
//     }

//     console.log("PlantCare User updated successfully");
//     return res
//       .status(200)
//       .json({ message: "PlantCare User updated successfully" });
//   } catch (error) {
//     if (error.isJoi) {
//       return res.status(400).json({ error: error.details[0].message });
//     }

//     console.error("Error updating PlantCare User:", error);
//     return res
//       .status(500)
//       .json({ error: "An error occurred while updating PlantCare User" });
//   }
// };

exports.updatePlantCareUser = async (req, res) => {
  const { id } = req.params;

  try {
    // Validate request body
    const validatedBody =
      await ValidateSchema.updatePlantCareUserSchema.validateAsync(req.body);
    const {
      firstName,
      lastName,
      phoneNumber,
      NICnumber,
      district,
      membership,
      language,
      accNumber,
      accHolderName,
      bankName,
      branchName,
    } = validatedBody;

    // Check if user exists
    const user = await adminDao.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: "PlantCare User not found" });
    }

    // Handle profile image upload if provided
    let profileImageUrl = user.profileImage;
    if (req.file) {
      // Delete old image if exists
      if (profileImageUrl) {
        await deleteFromS3(profileImageUrl);
      }

      // Upload new image
      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;
      profileImageUrl = await uploadFileToS3(
        fileBuffer,
        fileName,
        "users/profile-images"
      );
    }

    // Prepare user data for update
    const userData = {
      firstName,
      lastName,
      phoneNumber,
      NICnumber,
      district,
      membership,
      language,
      profileImageUrl,
      accNumber,
      accHolderName,
      bankName,
      branchName,
    };

    // Update user and bank details in transaction
    const result = await adminDao.updatePlantCareUserById(userData, id);

    // Return success response
    console.log("PlantCare User updated successfully");
    return res.status(200).json({
      message: result.message,
      userId: id,
      profileImage: profileImageUrl,
    });
  } catch (error) {
    // Handle validation errors
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Handle duplicate phone/NIC errors
    if (error.message && error.message.includes("already exists")) {
      return res.status(409).json({ error: error.message });
    }

    console.error("Error updating PlantCare User:", error);
    return res.status(500).json({
      error: "An error occurred while updating PlantCare User",
      details: error.message,
    });
  }
};

exports.createPlantCareUser = async (req, res) => {
  try {
    // Validate input data
    const validatedBody = req.body;

    const {
      firstName,
      lastName,
      phoneNumber,
      NICnumber,
      district,
      membership,
      language,
      // Add bank details fields
      accNumber,
      accHolderName,
      bankName,
      branchName,
    } = validatedBody;

    let profileImageUrl;
    // Ensure a file is uploaded
    if (req.file) {
      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;

      profileImageUrl = await uploadFileToS3(
        fileBuffer,
        fileName,
        "users/profile-images"
      );
    }

    const userData = {
      firstName,
      lastName,
      phoneNumber,
      NICnumber,
      district,
      membership,
      language,
      profileImageUrl,
      // Include bank details in userData
      accNumber,
      accHolderName,
      bankName,
      branchName,
    };

    console.log(userData);
    const result = await adminDao.createPlantCareUser(userData);

    console.log("PlantCare user created successfully");
    return res.status(201).json({
      message: result.message,
      id: result.userId,

      bankDetailsCreated: !!accNumber && !!accHolderName && !!bankName,
    });
  } catch (error) {
    if (error.message && error.message.includes("already exists")) {
      return res.status(400).json({ error: error.message });
    }

    if (error.isJoi) {
      // Handle Joi validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error creating PlantCare user:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while creating PlantCare user" });
  }
};

// exports.getUserById = async (req, res) => {
//   try {
//     // Validate the request params
//     const validatedParams =
//       await ValidateSchema.getUserByIdSchema.validateAsync(req.params);
//     const { id } = validatedParams;

//     // Fetch the user from the DAO
//     const user = await adminDao.getUserById(id);

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     console.log("User retrieved successfullyyyy");
//     return res.status(200).json(user);
//   } catch (error) {
//     if (error.isJoi) {
//       // Validation error
//       return res.status(400).json({ error: error.details[0].message });
//     }

//     console.error("Error retrieving user:", error);
//     return res
//       .status(500)
//       .json({ error: "An error occurred while fetching user" });
//   }
// };

exports.getUserById = async (req, res) => {
  try {
    // Validate the request params
    const validatedParams =
      await ValidateSchema.getUserByIdSchema.validateAsync(req.params);
    const { id } = validatedParams;

    // Fetch the user from the DAO (now includes bank details)
    const user = await adminDao.getUserById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Clean up the response object (remove join-specific fields)
    const { bankDetailId, bankDetailCreatedAt, ...cleanUser } = user;

    console.log("User retrieved successfully with bank details");
    return res.status(200).json(cleanUser);
  } catch (error) {
    if (error.isJoi) {
      // Validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error retrieving user:", error);
    return res.status(500).json({
      error: "An error occurred while fetching user",
      details: error.message,
    });
  }
};

exports.createAdmin = async (req, res) => {
  try {
    const validatedBody = req.body;

    const existingUser = await adminDao.findAdminByEmailOrUsername(
      validatedBody.mail,
      validatedBody.userName
    );

    if (existingUser[0].userName === validatedBody.userName) {
      return res.status(400).json({
        error: "An admin with the same username already exists.",
      });
    }

    if (existingUser[0].mail === validatedBody.mail) {
      return res.status(400).json({
        error: "An admin with the same email already exists.",
      });
    }

    if (existingUser.length > 0) {
      return res.status(400).json({
        error: "An admin with the same email or username already exists.",
      });
    }

    if (validatedBody.role === "Super Admin") {
      const superAdminCount = await adminDao.countSuperAdmins();
      if (superAdminCount >= 3) {
        return res.status(400).json({
          error: "Super Admin limit reached. Cannot create more than 3.",
        });
      }
    }

    const hashedPassword = await bcrypt.hash(validatedBody.password, 10);
    const result = await adminDao.createAdmin(validatedBody, hashedPassword);

    console.log("Admin created successfully");
    return res.status(201).json({
      message: "Admin user created successfully",
      id: result.insertId,
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error creating admin:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while creating admin user" });
  }
};

// exports.getTotalFixedAssetValue = (req, res) => {
//     const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
//     console.log(fullUrl);
//     const { id } = req.params;

//     const sql = `SELECT SUM(price) AS total_price FROM fixedasset WHERE userId  = ?`;
//     const values = [id];
//     db.query(sql, values, (err, results) => {
//         if (err) {
//             console.error("Error executing query:", err);
//             res.status(500).send("An error occurred while fetching data.");
//             return;
//         }
//         console.log("Successfully get Total assets");
//         res.json(results);
//         console.log("");
//     });
// };

//Report current assert --- get-assert-using-catogort-userid
exports.getCurrentAssertGroup = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    // Validate the request parameters (userId)
    const validatedParams =
      await ValidateSchema.getCurrentAssetGroupSchema.validateAsync(req.params);

    // Fetch data from the DAO
    const results = await adminDao.getCurrentAssetGroup(validatedParams.id);

    console.log(
      "Successfully retrieved total current assets grouped by category"
    );
    res.json(results);
  } catch (error) {
    if (error.isJoi) {
      // If validation error occurs
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching current assets:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching current assets" });
  }
};

exports.getCurrentAssetRecordById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    // Validate request parameters (currentAssetId)
    const validatedParams =
      await ValidateSchema.getCurrentAssetRecordByIdSchema.validateAsync(
        req.params
      );

    // Fetch the data from the DAO
    const results = await adminDao.getCurrentAssetRecordById(
      validatedParams.id
    );

    console.log("Successfully retrieved current asset record");
    res.json(results);
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching current asset record:", error);
    return res.status(500).json({
      error: "An error occurred while fetching the current asset record",
    });
  }
};

//delete crop task
exports.deleteCropTask = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    // Validate request parameters (taskId)
    // const validatedParams =
    //   await ValidateSchema.deleteCropTaskSchema.validateAsync(req.params);
    const id = req.params.id;
    const cropId = req.params.cropId;
    const indexId = parseInt(req.params.indexId);

    // Fetch the data from the DAO
    const results = await adminDao.deleteCropTask(id);

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Crop Calendar task not found" });
    }

    const taskIdArr = await adminDao.getAllTaskIdDao(cropId);
    console.log("Task array:", taskIdArr);

    for (let i = 0; i < taskIdArr.length; i++) {
      const existingTask = taskIdArr[i];

      if (existingTask.taskIndex > indexId) {
        console.log(
          `Updating task ${existingTask.id}, current taskIndex: ${existingTask.taskIndex}`
        );
        await adminDao.shiftUpTaskIndexDao(
          existingTask.id,
          existingTask.taskIndex - 1
        );
      }
    }

    console.log("Crop Calendar task deleted successfully");
    res.status(200).json({ status: true });
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error deleting crop task:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting the crop task" });
  }
};

exports.getCropCalendarDayById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    // Validate request parameters (id)
    const validatedParams =
      await ValidateSchema.getCropCalendarDayByIdSchema.validateAsync(
        req.params
      );

    // Fetch the data from the DAO
    const result = await adminDao.getCropCalendarDayById(validatedParams.id);

    if (!result) {
      return res
        .status(404)
        .json({ message: "No record found with the given ID" });
    }

    console.log("Successfully retrieved task by ID");
    res.status(200).json(result);
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching crop task:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the crop task" });
  }
};

exports.editTask = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  console.log("Update task", req.body);

  const id = req.params.id;
  console.log(id);

  try {
    const validatedParams = req.body;

    // Call DAO to update task
    const result = await adminDao.editTask(
      validatedParams.taskEnglish,
      validatedParams.taskSinhala,
      validatedParams.taskTamil,
      validatedParams.taskTypeEnglish,
      validatedParams.taskTypeSinhala,
      validatedParams.taskTypeTamil,
      validatedParams.taskCategoryEnglish,
      validatedParams.taskCategorySinhala,
      validatedParams.taskCategoryTamil,
      validatedParams.taskDescriptionEnglish,
      validatedParams.taskDescriptionSinhala,
      validatedParams.taskDescriptionTamil,
      validatedParams.reqImages,
      validatedParams.imageLink,
      validatedParams.videoLinkEnglish,
      validatedParams.videoLinkSinhala,
      validatedParams.videoLinkTamil,
      validatedParams.id
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    console.log("Task updated successfully");
    res.status(200).json({ message: "Task updated successfully" });
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error updating task:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while updating task" });
  }
};


exports.getAllUsersTaskByCropId = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    // Validate request parameters (cropId, userId, page, limit)
    const { cropId, userId } = req.params;
    const { page, limit } =
      await ValidateSchema.getAllCropCalendarSchema.validateAsync(req.query);

    const offset = (page - 1) * limit;

    console.log("cropId:", cropId);
    console.log("userId:", userId);

    // Fetch total, first starting date, and paginated tasks from the DAO
    const { total, firstStartingDate, items } =
      await adminDao.getAllUserTaskByCropId(cropId, userId, limit, offset);

    console.log("Successfully fetched user tasks for crop ID:", cropId);

    const formattedItems = items.map((task) => ({
      ...task,
      images: task.imageUploads ? task.imageUploads.split(", ") : [], // Convert images string to array
    }));

    console.log(formattedItems);

    // Send response with paginated tasks, total count, and first starting date
    res.json({
      total,
      firstStartingDate,
      items: formattedItems,
    });
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching tasks for crop ID:", error);
    return res.status(500).json({
      error: "An error occurred while fetching tasks for the crop ID",
    });
  }
};

exports.editUserTaskStatus = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    // Validate the `id` parameter
    const { id } =
      await ValidateSchema.editMarketPriceStatusSchema.validateAsync(
        req.params
      );

    // Fetch the current status of the market price
    const result = await adminDao.getUserTaskStatusById(id);

    if (result.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const currentStatus = result[0].status;
    let newStatus;

    // Toggle between 'Draft' and 'Published'
    if (currentStatus === "pending") {
      newStatus = "completed";
    } else if (currentStatus === "completed") {
      newStatus = "pending";
    } else {
      return res.status(400).json({ error: "Invalid current status" });
    }

    // Update the status using the DAO
    await adminDao.updateUserTaskStatusById(id, newStatus);

    console.log("Status updated successfully");
    return res.status(200).json({ message: "Status updated successfully" });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error updating Task status:", err);
    return res.status(500).json({
      error: "An error occurred while updating the Task status",
    });
  }
};

exports.getSlaveCropCalendarDayById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    // Validate request parameters (id)
    const validatedParams =
      await ValidateSchema.getCropCalendarDayByIdSchema.validateAsync(
        req.params
      );

    // Fetch the data from the DAO
    const result = await adminDao.getSlaveCropCalendarDayById(
      validatedParams.id
    );

    if (!result) {
      return res
        .status(404)
        .json({ message: "No record found with the given ID" });
    }

    console.log("Successfully retrieved task by ID");
    res.status(200).json(result);
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching crop task:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the crop task" });
  }
};

//get each post reply

exports.getAllReplyByPost = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const postId = req.params.postId;

    const results = await adminDao.getAllPostReplyDao(postId);

    res.json(results);
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching tasks for crop ID:", error);
    return res.status(500).json({
      error: "An error occurred while fetching tasks for the crop ID",
    });
  }
};

exports.DeletPublicForumPost = async (req, res) => {
  try {
    const postId = req.params.postId;
    const results = await adminDao.deletePublicForumPost(postId);
    // const results = await adminDao.deletePublicForumPost(postId);
    if (results.affectedRows === 1) {
      console.log("Delete");
      res.json({ status: true });
    } else {
      res.json({ status: false });
    }
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }
    console.error("Error fetching post for post ID:", error);
    return res.status(500).json({
      error: "An error occurred while fetching post for the postID",
    });
  }
};

exports.DeleteReply = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const postId = req.params.postId;

    const results = await adminDao.deleteReply(postId);
    if (results.affectedRows === 1) {
      console.log("Delete");
      res.json({ status: true });
    } else {
      res.json({ status: false });
    }
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching tasks for crop ID:", error);
    return res.status(500).json({
      error: "An error occurred while fetching tasks for the crop ID",
    });
  }
};

exports.editUserTask = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  console.log("Update task", req.body);

  const id = req.params.id;
  console.log(id);

  try {
    const validatedParams = req.body;

    // Call DAO to update task
    const result = await adminDao.editUserTask(
      validatedParams.taskEnglish,
      validatedParams.taskSinhala,
      validatedParams.taskTamil,
      validatedParams.taskTypeEnglish,
      validatedParams.taskTypeSinhala,
      validatedParams.taskTypeTamil,
      validatedParams.taskCategoryEnglish,
      validatedParams.taskCategorySinhala,
      validatedParams.taskCategoryTamil,
      validatedParams.startingDate,
      validatedParams.reqImages,
      validatedParams.imageLink,
      validatedParams.videoLinkEnglish,
      validatedParams.videoLinkSinhala,
      validatedParams.videoLinkTamil,
      validatedParams.id
    );

    console.log("Task updated successfully");
    res.status(200).json({ message: "Task updated successfully" });
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error updating task:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while updating task" });
  }
};
exports.getAllPostyById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const results = await adminDao.getAllPost();
    // console.log(results);

    if (!results || results.length === 0) {
      return res.status(404).json({ error: "No post found." });
    }

    // console.log(results);

    // Modify the results to convert images to base64
    // results.forEach((result, indexId) => {
    //   if (result.postimage) {
    //     const base64Image = Buffer.from(result.postimage).toString("base64");
    //     const mimeType = "image/png";
    //     results[indexId].postimage = `data:${mimeType};base64,${base64Image}`;
    //   }
    // });

    res.json(results);
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }
    console.error("Error fetching posts:", error);
    return res.status(500).json({
      error: "An error occurred while fetching posts.",
    });
  }
};

exports.addNewTask = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  console.log("Add new task data:", req.body);

  const cropId = req.params.cropId;
  const indexId = parseInt(req.params.indexId);

  try {
    const task = req.body;
    // console.log(req.params);

    const taskIdArr = await adminDao.getAllTaskIdDao(cropId);
    console.log("Task array:", taskIdArr);

    for (let i = 0; i < taskIdArr.length; i++) {
      const existingTask = taskIdArr[i];

      if (existingTask.taskIndex > indexId) {
        console.log(
          `Updating task ${existingTask.id}, current taskIndex: ${existingTask.taskIndex}`
        );
        await adminDao.shiftUpTaskIndexDao(
          existingTask.id,
          existingTask.taskIndex + 1
        );
      }
    }

    const addedTaskResult = await adminDao.addNewTaskDao(
      task,
      indexId + 1,
      cropId
    );

    if (addedTaskResult.insertId > 0) {
      res
        .status(201)
        .json({ status: true, message: "Succcesfull Task Added!" });
    } else {
      res
        .status(500)
        .json({ status: false, message: "Issue Occor in Task Adding!" });
    }
  } catch (error) {
    console.error("Error adding task:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while adding the task" });
  }
};

exports.sendMessage = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  console.log("Send message data:", req.body);
  console.log("Send message data:", req.user);

  const chatId = req.params.chatId;
  const replyId = req.user.userId;
  const replyMessage = req.body.replyMessage;

  try {
    //const replyMessage = replyMessage;
    // const createdAt = new Date().toISOString(); // Generate current timestamp
    console.log(req.params);

    // Get all the replies for the chatId
    const replyIdArr = await adminDao.addNewReplyDao(
      chatId,
      replyId,
      replyMessage
    );
    console.log("Reply ID array:", replyIdArr);

    // Send a success response with the added reply
    return res.status(200).json({
      message: "Reply sent successfully!",
    });
  } catch (err) {
    console.error("Error sending message:", err);
    return res.status(500).json({
      error: "An error occurred while sending the reply.",
    });
  }
};

exports.getReplyCountByChatId = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    // Use DAO to get reply count for the given chatId
    const result = await adminDao.getReplyCount();
    console.log(result);

    res.json(result);
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error (if using Joi for validation)
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching reply count for chatId:", error);
    return res.status(500).json({
      error: "An error occurred while fetching reply count for the chatId",
    });
  }
};

exports.addNewTaskU = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  console.log("Request URL:", fullUrl);
  console.log("Add new task data:", req.body);

  const userId = req.params.userId;
  const cropId = req.params.cropId;
  const onCulscropID = req.params.onCulscropID;
  const indexId = parseInt(req.params.indexId);
  console.log(req.params);
  

  try {
    const task = req.body;
    console.log(req.params);

    const taskIdArr = await adminDao.getAllTaskIdDaoU(cropId, userId);
    console.log("Task array:", taskIdArr);

    for (let i = 0; i < taskIdArr.length; i++) {
      const existingTask = taskIdArr[i];

      if (existingTask.taskIndex > indexId) {
        console.log(
          `Updating task ${existingTask.id}, current taskIndex: ${existingTask.taskIndex}`
        );
        await adminDao.shiftUpTaskIndexDaoU(
          existingTask.id,
          existingTask.taskIndex + 1
        );
      }
    }

    const addedTaskResult = await adminDao.addNewTaskDaoU(
      task,
      indexId + 1,
      userId,
      cropId,
      onCulscropID
    );

    if (addedTaskResult.insertId > 0) {
      res
        .status(201)
        .json({ status: true, message: "Succcesfull Task Added!" });
    } else {
      res
        .status(500)
        .json({ status: false, message: "Issue Occor in Task Adding!" });
    }
  } catch (error) {
    console.error("Error adding task:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while adding the task" });
  }
};

// exports.uploadUsersXLSX = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ error: "No file uploaded." });
//     }

//     console.log("File details:", {
//       fieldname: req.file.fieldname,
//       originalname: req.file.originalname,
//       encoding: req.file.encoding,
//       mimetype: req.file.mimetype,
//       size: req.file.size,
//       path: req.file.path, // Log the path if it exists
//       buffer: req.file.buffer ? "Buffer exists" : "Buffer is undefined",
//     });

//     // Validate file type
//     const allowedExtensions = [".xlsx", ".xls"];
//     const fileExtension = path.extname(req.file.originalname).toLowerCase();
//     if (!allowedExtensions.includes(fileExtension)) {
//       return res.status(400).json({
//         error: "Invalid file type. Only XLSX and XLS files are allowed.",
//       });
//     }

//     // Read the XLSX file
//     let workbook;
//     try {
//       if (req.file.buffer) {
//         // If buffer exists, read from buffer
//         workbook = xlsx.read(req.file.buffer, { type: "buffer" });
//       } else if (req.file.path) {
//         // If path exists, read from file
//         workbook = xlsx.readFile(req.file.path);
//       } else {
//         throw new Error("Neither file buffer nor path is available");
//       }
//     } catch (error) {
//       console.error("Error reading XLSX file:", error);
//       return res.status(400).json({
//         error:
//           "Unable to read the uploaded file. Please ensure it's a valid XLSX or XLS file.",
//       });
//     }

//     if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
//       return res
//         .status(400)
//         .json({ error: "The uploaded file is empty or invalid." });
//     }

//     const sheetName = workbook.SheetNames[0];
//     const worksheet = workbook.Sheets[sheetName];
//     const data = xlsx.utils.sheet_to_json(worksheet);

//     // Validate data structure
//     if (data.length === 0) {
//       return res
//         .status(400)
//         .json({ error: "The uploaded file contains no valid data." });
//     }

//     // console.log("First row of data:", data[0]);

//     // Insert data into the database via DAO
//     const rowsAffected = await adminDao.insertUserXLSXData(data);

//     // Respond with success
//     return res.status(200).json({
//       message: "File uploaded and data inserted successfully",
//       rowsAffected,
//     });
//   } catch (error) {
//     if (error.isJoi) {
//       return res.status(400).json({ error: error.details[0].message });
//     }
//     console.error("Error processing XLSX file:", error);
//     return res
//       .status(500)
//       .json({ error: "An error occurred while processing the XLSX file." });
//   }
// };

exports.uploadUsersXLSX = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    const result = await adminDao.insertUserXLSXData(data);

    return res.status(200).json({
      message: "File processed successfully",
      newUsersInserted: result.insertedRows,
      existingUsers: result.existingUsers,
      duplicateEntries: result.duplicateData, // Sending duplicate entries
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.uploadUsersXLSXtest = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    console.log("File details:", {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      encoding: req.file.encoding,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      buffer: req.file.buffer ? "Buffer exists" : "Buffer is undefined",
    });

    console.log("Files comes");

    // Validate file type
    const allowedExtensions = [".xlsx", ".xls"];
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({
        error: "Invalid file type. Only XLSX and XLS files are allowed.",
      });
    }

    // Read the XLSX file
    let workbook;
    try {
      if (req.file.buffer) {
        workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      } else if (req.file.path) {
        workbook = xlsx.readFile(req.file.path);
      } else {
        throw new Error("Neither file buffer nor path is available");
      }
    } catch (error) {
      console.error("Error reading XLSX file:", error);
      return res.status(400).json({
        error:
          "Unable to read the uploaded file. Please ensure it's a valid XLSX or XLS file.",
      });
    }

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res
        .status(400)
        .json({ error: "The uploaded file is empty or invalid." });
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res
        .status(400)
        .json({ error: "The uploaded file contains no valid data." });
    }

    console.log("getting data");
    // Insert data and check for existing users
    const result = await adminDao.insertUserXLSXData(data);

    console.log("after dao");

    // If there are existing users, generate and send XLSX file
    if (result.existingUsers && result.existingUsers.length > 0) {
      // Create a new workbook for existing users
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(result.existingUsers);
      xlsx.utils.book_append_sheet(wb, ws, "Existing Users");

      // Generate buffer
      const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      // Set headers for file download
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=existing_users.xlsx"
      );

      // Send both the file and JSON response
      return res.status(200).send({
        message: "Some users already exist in the database",
        existingUsers: result.existingUsers,
        newUsersInserted: result.insertedRows,
        file: excelBuffer,
      });
    }

    // If no existing users, send success response
    return res.status(200).json({
      message: "File uploaded and data inserted successfully",
      rowsAffected: result.insertedRows,
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }
    console.error("Error processing XLSX file:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while processing the XLSX file." });
  }
};

exports.getAllRoles = async (req, res) => {
  try {
    const roles = await adminDao.getAllRoles();

    console.log("Successfully fetched admin roles");
    res.json({
      roles,
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

exports.getAllPosition = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  try {
    const positions = await adminDao.getAllPosition();

    console.log("Successfully fetched admin roles");
    res.json({
      positions,
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

//delete crop task
exports.deleteUserCropTask = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const id = req.params.id;
    const cropId = req.params.cropId;
    const userId = req.params.userId;
    const indexId = parseInt(req.params.indexId);

    const results = await adminDao.deleteUserCropTask(id);

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Crop Calendar task not found" });
    }

    const taskIdArr = await adminDao.getAllUserTaskIdDao(cropId, userId);

    for (let i = 0; i < taskIdArr.length; i++) {
      const existingTask = taskIdArr[i];

      if (existingTask.taskIndex > indexId) {
        console.log(
          `Updating task ${existingTask.id}, current taskIndex: ${existingTask.taskIndex}`
        );
        await adminDao.shiftUpUserTaskIndexDao(
          existingTask.id,
          existingTask.taskIndex - 1
        );
      }
    }
    console.log("Crop Calendar task deleted successfully");
    res.status(200).json({ status: true });
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error deleting crop task:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting the crop task" });
  }
};

// exports.getPaymentSlipReport = async (req, res) => {
//   try {
//     const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
//     console.log("Request URL:", fullUrl);

//     const { page , limit } = await ValidateSchema.getAllUsersRepSchema.validateAsync(req.query);

//     const offset = (page - 1) * limit;

//     const officerID = parseInt(req.params.officerID);
//     console.log("Officer ID:", officerID);
//     console.log("Officer ID:", page);
//     console.log("Officer ID:", offset);

//     const { total, items } = await adminDao.getPaymentSlipReport(officerID, limit, offset);

//     console.log("Successfully fetched farmer payments");
//     console.log(items);

//     // Send response
//     res.json({
//       total,
//       items,
//     });

//   } catch (error) {
//     console.error("Error fetching farmer payments:", error);
//     return res.status(500).json({
//       error: "An error occurred while fetching farmer payments",
//     });
//   }
// };

exports.getPaymentSlipReport = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const date = req.query.date;
    const page = parseInt(req.query.page) || 1; // Default to page 1 if no page is provided
    const limit = parseInt(req.query.limit) || 10; // Default to limit of 10 if no limit is provided
    const offset = (page - 1) * limit;
    const search = req.query.search;

    const officerID = parseInt(req.params.officerID);
    console.log("Officer ID:", officerID);
    console.log("Page:", limit);
    console.log("Offset:", offset);
    console.log("Date Filter:", date);
    console.log("search:", search);

    const { total, items } = await adminDao.getPaymentSlipReport(
      officerID,
      limit,
      offset,
      date,
      search
    );

    console.log("Successfully fetched farmer payments");
    res.json({
      total,
      items,
    });
  } catch (error) {
    console.error("Error fetching farmer payments:", error);
    return res.status(500).json({
      error: "An error occurred while fetching farmer payments",
    });
  }
};

exports.getFarmerListReport = async (req, res) => {
  try {
    // Construct the full URL for logging purposes
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const id = req.params.id;
    const userId = req.params.userId;
    console.log(id);

    // Fetch farmer list report data from the DAO
    const cropList = await adminDao.getFarmerCropListReport(id);
    const userdetails = await adminDao.getReportfarmerDetails(userId);
    const date = await adminDao.getFarmerCropListReportDate(id);

    console.log("Successfully fetched farmer list report");
    console.log(userdetails);

    // Respond with the farmer list report data
    //
    res.json({ crops: [cropList], farmer: [userdetails], date: [date] });
  } catch (error) {
    console.error("Error fetching farmer list report:", error);
    return res.status(500).json({
      error: "An error occurred while fetching the farmer list report",
    });
  }
};

// exports.getUserFeedbackDetails = async (req, res) => {
//   try {
//     // Construct the full URL for logging purposes
//     const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
//     console.log("Request URL:", fullUrl);

//     // Log request parameters if needed
//     console.log("Fetching user feedback details");

//     // Fetch user feedback details from the DAO
//     const feedbackDetails = await adminDao.getUserFeedbackDetails();
//     const feedbackCount = await adminDao.getUserFeedbackCount();
//     const deletedUserCount = await adminDao.getDeletedUserCount();
//     console.log(feedbackCount);
//     console.log("Successfully fetched user feedback details");
//     console.log(feedbackDetails);
//     console.log(deletedUserCount);

//     // Respond with the feedback details
//     res.json({ feedbackDetails, feedbackCount, deletedUserCount });
//   } catch (error) {
//     console.error("Error fetching user feedback details:", error);
//     return res.status(500).json({
//       error: "An error occurred while fetching user feedback details",
//     });
//   }
// };

exports.getUserFeedbackDetails = async (req, res) => {
  try {
    // Construct the full URL for logging purposes
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    // Extract pagination parameters (page and limit) from the query string
    const { page = 1, limit = 10 } = req.query; // Set default values for page and limit
    console.log("Pagination:", page, limit);

    // Validate that page and limit are numbers
    if (isNaN(page) || isNaN(limit) || page < 1 || limit < 1) {
      return res.status(400).json({ error: "Invalid page or limit" });
    }

    // Fetch user feedback details from the DAO with pagination
    const feedbackDetails = await adminDao.getUserFeedbackDetails(page, limit);
    const feedbackCount = await adminDao.getUserFeedbackCount();
    const deletedUserCount = await adminDao.getDeletedUserCount();

    console.log("Successfully fetched user feedback details");
    console.log(feedbackDetails);
    console.log("Feedback Count:", feedbackCount);
    console.log("Deleted User Count:", deletedUserCount);

    // Respond with the paginated feedback details and count information
    res.json({
      feedbackDetails,
      feedbackCount,
      deletedUserCount,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error fetching user feedback details:", error);
    return res.status(500).json({
      error: "An error occurred while fetching user feedback details",
    });
  }
};

exports.getNextOrderNumber = async (req, res) => {
  try {
    const nextOrderNumber = await adminDao.getNextOrderNumber(); // Call the DAO function
    res.status(200).json({
      success: true,
      nextOrderNumber: nextOrderNumber,
    });
  } catch (error) {
    console.error("Error fetching next order number:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve the next order number.",
      error: error.message,
    });
  }
};

exports.getAllfeedackList = async (req, res) => {
  try {
    const feedbacks = await adminDao.getAllfeedackList();

    console.log("Successfully fetched feedback list");
    res.json({
      feedbacks,
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

exports.createFeedback = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    console.log(req.body);

    await ValidateSchema.createfeedback.validateAsync(req.body);

    const { orderNumber, feedbackEnglish, feedbackSinahala, feedbackTamil } =
      req.body;

    // Call DAO to save news and the image file as longblob
    const feedBack = await adminDao.createFeedback(
      orderNumber,
      feedbackEnglish,
      feedbackSinahala,
      feedbackTamil
    );

    return res.status(201).json({
      message: "Feedback option created successfully",
      id: feedBack,
      status: true,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while creating feedback" });
  }
};

exports.updateFeedbackOrder = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    const feedbacks = req.body.feedbacks; // Array of {id, orderNumber}
    const result = await adminDao.updateFeedbackOrder(feedbacks);

    if (result) {
      return res.status(200).json({
        status: true,
        message: "Feedback order updated successfully",
      });
    }

    return res.status(400).json({
      status: false,
      message: "Failed to update feedback order",
    });
  } catch (error) {
    console.error("Error in updateFeedbackOrder:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.deleteFeedback = async (req, res) => {
  const feedbackId = parseInt(req.params.id, 10);

  if (isNaN(feedbackId)) {
    return res.status(400).json({ error: "Invalid feedback ID" });
  }

  try {
    // Retrieve the feedback's current orderNumber before deletion
    const feedback = await adminDao.getFeedbackById(feedbackId);
    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    const orderNumber = feedback.orderNumber;

    // Delete feedback and update subsequent order numbers
    const result = await adminDao.deleteFeedbackAndUpdateOrder(
      feedbackId,
      orderNumber
    );

    return res.status(200).json({
      message: "Feedback deleted and order updated successfully",
      result,
    });
  } catch (error) {
    console.error("Error deleting feedback:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllfeedackListForBarChart = async (req, res) => {
  try {
    const feedbacks = await adminDao.getAllfeedackListForBarChart();

    console.log("Successfully fetched feedback list");
    res.json({
      feedbacks,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.plantcareDashboard = async (req, res) => {
  try {
    // Fetch all necessary data from the database
    const activeUsers = await adminDao.activeUsers();
    const newUsers = await adminDao.newUsers();
    const allUsers = await adminDao.allUsers();
    const allUsersTillPreviousMonth =
      await adminDao.allUsersTillPreviousMonth();
    const allQrUsersTillPreviousMonth =
      await adminDao.qrUsersTillPreviousMonth();
    const qrUsers = await adminDao.qrUsers();
    const vegCultivation = await adminDao.vegEnroll();
    const grainCultivation = await adminDao.grainEnroll();
    const fruitCultivation = await adminDao.fruitEnroll();
    const mushCultivation = await adminDao.mushEnroll();
    const vegEnrollTillPreviousMonth =
      await adminDao.vegEnrollTillPreviousMonth();
    const fruitEnrollTillPreviousMonth =
      await adminDao.fruitEnrollTillPreviousMonth();
    const grainEnrollTillPreviousMonth =
      await adminDao.grainEnrollTillPreviousMonth();
    const mushEnrollTillPreviousMonth =
      await adminDao.mushEnrollTillPreviousMonth();

    // Calculate percentage increases
    const qrUserPreviousMonth = (
      ((qrUsers.farmer_qr_count -
        allQrUsersTillPreviousMonth.farmer_qr_count_previous_month) /
        allQrUsersTillPreviousMonth.farmer_qr_count_previous_month) *
      100
    ).toFixed(2);

    const totalCultivationTillPreviousMonth =
      vegEnrollTillPreviousMonth.veg_cultivation_count_till_previous_month +
      fruitEnrollTillPreviousMonth.fruit_cultivation_count_till_previous_month +
      grainEnrollTillPreviousMonth.grain_cultivation_count_till_previous_month +
      mushEnrollTillPreviousMonth.mush_cultivation_count_till_previous_month;

    const totalCultivationTillThisMonth =
      vegCultivation.veg_cultivation_count +
      fruitCultivation.fruit_cultivation_count +
      grainCultivation.grain_cultivation_count +
      mushCultivation.mush_cultivation_count;

    const cultivationIncreasePercentage = (
      ((totalCultivationTillThisMonth - totalCultivationTillPreviousMonth) /
        totalCultivationTillPreviousMonth) *
      100
    ).toFixed(2);

    const userIncreasePercentage = (
      ((allUsers.all_farmer_count -
        allUsersTillPreviousMonth.all_previous_month_farmer_count) /
        allUsersTillPreviousMonth.all_previous_month_farmer_count) *
      100
    ).toFixed(2);

    // Fetch farmer registration counts by district
    const district = req.query.district || "DefaultDistrict"; // Get district from query params or use a default
    const farmerRegistrationCounts =
      await adminDao.getFarmerRegistrationCountsByDistrict(district);

    // Prepare the response data
    const data = {
      active_users: activeUsers.active_users_count,
      new_users: newUsers.new_users_count,
      vegCultivation: vegCultivation.veg_cultivation_count,
      grainCultivation: grainCultivation.grain_cultivation_count,
      fruitCultivation: fruitCultivation.fruit_cultivation_count,
      mushCultivation: mushCultivation.mush_cultivation_count,
      allusers: allUsers.all_farmer_count,
      allusersTillPreviousMonth:
        allUsersTillPreviousMonth.all_previous_month_farmer_count,
      user_increase_percentage: userIncreasePercentage,
      qrUsers: qrUsers.farmer_qr_count,
      qr_user_increase_percentage: qrUserPreviousMonth,
      total_cultivation_till_previous_month: totalCultivationTillPreviousMonth,
      total_cultivation_till_this_month: totalCultivationTillThisMonth,
      cultivation_increase_percentage: cultivationIncreasePercentage,
      farmerRegistrationCounts: {
        registered_count: farmerRegistrationCounts.registered_count,
        unregistered_count: farmerRegistrationCounts.unregistered_count,
      },
    };

    console.log("Successfully fetched dashboard data");
    res.json({ data });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.updateAdminRoleById = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    // Ensure request body has required fields
    if (!req.body || !req.body.id || !req.body.role || !req.body.email) {
      return res.status(400).json({
        status: false,
        message: "Missing required fields: id, role, or email",
      });
    }

    const { id, role, email } = req.body;
    const result = await adminDao.updateAdminRoleById(id, role, email);

    if (result?.affectedRows > 0) {
      return res.status(200).json({
        status: true,
        message: "Admin role updated successfully",
      });
    }

    return res.status(400).json({
      status: false,
      message: "Failed to update admin role",
    });
  } catch (error) {
    console.error("Error updating admin role:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.deleteOngoingCultivationsById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    // Validate the request parameters (id)
    const { id } = await ValidateSchema.deleteAdminUserSchema.validateAsync(
      req.params
    );

    // Delete ongoing cultivation by id from DAO
    const results = await adminDao.deleteOngoingCultivationsById(id);

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Ongoing cultivation not found" });
    }

    console.log("Ongoing cultivation deleted successfully");
    return res
      .status(200)
      .json({ message: "Ongoing cultivation deleted successfully" });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error deleting ongoing cultivation:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting ongoing cultivation" });
  }
};



exports.getFarmerStaff = async (req, res) => {
  try {
    const { id, role } = await ValidateSchema.getFarmerStaffShema.validateAsync(req.query);
    console.log(role);
    
    const result = await adminDao.getFarmerStaffDao(id, role);

    console.log("Successfully fetched feedback list");
    res.json({
      result,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};