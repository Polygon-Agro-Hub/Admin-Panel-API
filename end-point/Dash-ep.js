const DashDao = require("../dao/Dash-dao");
const ValidateSchema = require("../validations/SalesAgentDash-validation");
const bcrypt = require("bcryptjs");
const uploadFileToS3 = require("../middlewares/s3upload");
const deleteFromS3 = require("../middlewares/s3delete");

exports.getAllCustomers = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    const { page, limit, searchText } = await ValidateSchema.getAllSalesAgentsSchema.validateAsync(req.query);
    const { items, total } = await DashDao.getAllSalesCustomers(page, limit, searchText);

    res.json({ items, total });
  } catch (err) {
    if (err.isJoi) {
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching customers:", err);
    res.status(500).json({ error: "An error occurred while fetching customers" });
  }
};


exports.getAllSalesAgents = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  try {
  
    const { page, limit, searchText, status } = req.query;
    const result = await DashDao.getAllSalesAgents(
      page,
      limit,
      searchText,
      status
    );

    return res.status(200).json(result);
  } catch (error) {
    
    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};

exports.deleteSalesAgent = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    // Validate the request parameters
    const { id } =
      await ValidateSchema.deleteSalesAgentSchema.validateAsync(
        req.params
      );

    const affectedRows = await DashDao.deleteSalesAgent(id);

    if (affectedRows === 0) {
      return res.status(404).json({ message: "company head not found" });
    } else {
      return res.status(200).json({ status: true });
    }
  } catch (err) {
    if (err.isJoi) {
     
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error deleting company head:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting company head" });
  }
};

exports.getForCreateId = async (req, res) => {
  try {

    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    
    const role = 'SA';
    const results = await DashDao.getForCreateId(role);

    if (results.length === 0) {
      return res.json({ result: { empId: "00001" }, status: true });
    }

    res.status(200).json({ result: results[0], status: true });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};


exports.createSalesAgent = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const officerData = JSON.parse(req.body.officerData);
    let errors = [];

    // Check if phone numbers, NIC, or email already exist
    const isExistingPhone1 = await DashDao.checkPhoneExist(officerData.phoneNumber1);
    if (isExistingPhone1) {
      errors.push("Mobile number 01 already exists");
    }

    const isExistingPhone2 = await DashDao.checkPhoneExist(officerData.phoneNumber2);
    if (isExistingPhone2) {
      errors.push("Mobile number 02 already exists");
    }

    const isExistingNIC = await DashDao.checkNICExist(officerData.nic);
    if (isExistingNIC) {
      errors.push("NIC already exists");
    }

    const isExistingEmail = await DashDao.checkEmailExist(officerData.email);
    if (isExistingEmail) {
      errors.push("Email already exists");
    }

    // If there are errors, return them as array
    if (errors.length > 0) {
      return res.status(400).json({ status: false, errors: errors });
    }

    let profileImageUrl = null;

    // Handle Base64 Image Upload (if provided)
    if (req.body.file) {
      try {
        const base64String = req.body.file.split(",")[1];
        const mimeType = req.body.file.match(/data:(.*?);base64,/)[1];
        const fileBuffer = Buffer.from(base64String, "base64");

        const fileExtension = mimeType.split("/")[1];
        const fileName = `${officerData.firstName || 'user'}_${officerData.lastName || 'image'}.${fileExtension}`;

        profileImageUrl = await uploadFileToS3(
          fileBuffer,
          fileName,
          "salesagent/image"
        );
      } catch (err) {
        console.error("Error processing image file:", err);
        return res.status(400).json({ errors: ["Invalid file format or file upload error"] });
      }
    }

    // Generate a new Sales Agent ID
    const newSalseAgentId = await DashDao.genarateNewSalesAgentIdDao();
    // Save sales agent data
    const resultsPersonal = await DashDao.createSalesAgent(
      officerData,
      profileImageUrl,
      newSalseAgentId
    );

    return res.status(201).json({
      message: "Sales Agent created successfully",
      id: resultsPersonal.insertId,
      status: true,
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ errors: [error.details[0].message] });
    }

    console.error("Error creating Sales Agent:", error);
    return res.status(500).json({
      errors: ["An error occurred while creating the Sales Agent"],
    });
  }
};


exports.getSalesAgentDataById = async (req, res) => {
  try {
    const id = req.params.id;
    const officerData = await DashDao.getSalesAgentDataById(id);

    if (!officerData) {
      return res.status(404).json({ error: "Collection Officer not found" });
    }

    res.json({ officerData });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};


exports.updateSalesAgentDetails = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  const { id } = req.params;

  const officerData = JSON.parse(req.body.officerData);
  let validationErrors = [];

  // Check duplicates
  const isExistingNIC = await DashDao.checkNICExistSaEdit(officerData.nic, id);
  if (isExistingNIC) validationErrors.push('NIC');

  const isExistingEmail = await DashDao.checkEmailExistSaEdit(officerData.email, id);
  if (isExistingEmail) validationErrors.push('Email');

  const isExistingPhoneNumber01 = await DashDao.checkPhoneExistSaEdit(officerData.phoneNumber1, id);
  if (isExistingPhoneNumber01) validationErrors.push('PhoneNumber01');

  if (officerData.phoneNumber02) {
    const isExistingPhoneNumber02 = await DashDao.checkPhoneExistSaEdit(officerData.phoneNumber2, id);
    if (isExistingPhoneNumber02) validationErrors.push('PhoneNumber02');
  }

  // If any validation errors, send all at once
  if (validationErrors.length > 0) {
    return res.status(400).json({
      errors: validationErrors,
      status: false
    });
  }

  if (req.body.file) {
    await deleteFromS3(officerData.image);
    
    const base64String = req.body.file.split(",")[1]; // Extract the Base64 content
    const mimeType = req.body.file.match(/data:(.*?);base64,/)[1]; // Extract MIME type
    const fileBuffer = Buffer.from(base64String, "base64"); // Decode Base64 to buffer

    const fileExtension = mimeType.split("/")[1]; // Extract file extension from MIME type
    const fileName = `${officerData.firstName}_${officerData.lastName}.${fileExtension}`;

    officerData.image = await uploadFileToS3(
      fileBuffer,
      fileName,
      "salesagent/image"
    );
  }

  const {

    firstName,
    lastName,
    empId,
    empType,
    phoneCode1,
    phoneNumber1,
    phoneCode2,
    phoneNumber2,
    nic,
    email,
    houseNumber,
    streetName,
    city,
    district,
    province,
    country,
    accHolderName,
    accNumber,
    bankName,
    branchName,
    image
  } = officerData;

  try {
    await DashDao.updateSalesAgentDetails(
      id,

      firstName,
      lastName,
      empId,
      empType,
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      nic,
      email,
      houseNumber,
      streetName,
      city,
      district,
      province,
      country,
      accHolderName,
      accNumber,
      bankName,
      branchName,
      image
    );
    res.json({ message: "Collection officer details updated successfully" });
  } catch (err) {
    console.error("Error updating collection officer details:", err);
    res
      .status(500)
      .json({ error: "Failed to update collection officer details" });
  }
};

exports.UpdateStatusAndSendPassword = async (req, res) => {
  try {
    const { id, status } = req.params;

    // Validate input
    if (!id || !status) {
      return res
        .status(400)
        .json({ message: "ID and status are required.", status: false });
    }

    // Fetch officer details by ID
    const officerData = await DashDao.getSalesAgentEmailDao(
      id
    );
    if (!officerData) {
      return res
        .status(404)
        .json({ message: "Collection officer not found.", status: false });
    }

    // Destructure email, firstNameEnglish, and empId from fetched data
    const { email, firstName, empId } = officerData;
    // Generate a new random password
    const generatedPassword = Math.random().toString(36).slice(-8); // Example: 8-character random password

    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    if (status === "Approved") {
      const emailResult = await DashDao.SendGeneratedPasswordDao(
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

      const newTarget = await DashDao.createSalesTarget(id);

    }

    const updateResult =
      await DashDao.UpdateSalesAgentStatusAndPasswordDao({
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

exports.getAllOrders = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { page, limit, orderStatus, paymentMethod, paymentStatus, deliveryType, searchText, date } = req.query;

    // Call the DAO to get all collection officers
    const result = await DashDao.getAllOrders(
      page,
      limit,
      orderStatus,
      paymentMethod,
      paymentStatus,
      deliveryType,
      searchText,
      date

    );

    return res.status(200).json(result);
  } catch (error) {
    
    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};

exports.getDashUserOrders = async (req, res) => {
  try {
    const userId = req.params.userId;
    const statusFilter = req.query.status || "Ordered";

    const userOrders = await DashDao.getUserOrdersDao(
      parseInt(userId),
      statusFilter
    );

    if (!userOrders || userOrders.length === 0) {
      return res.json({
        success: false,
        message: `No ${statusFilter.toLowerCase()} orders found for this user`,
        statusFilter: statusFilter,
      });
    }

    // Group orders by schedule type
    const ordersByScheduleType = userOrders.reduce((acc, order) => {
      const scheduleType = order.sheduleType || "unscheduled"; // Handle possible undefined
      if (!acc[scheduleType]) {
        acc[scheduleType] = [];
      }
      acc[scheduleType].push(order);
      return acc;
    }, {});

    // Format response data
    const responseData = {
      success: true,
      data: {
        orders: userOrders,
        ordersByScheduleType,
        count: userOrders.length,
        statusFilter: statusFilter,
      },
      metadata: {
        userId: userId,
        orderStatus: statusFilter,
        retrievedAt: new Date().toISOString(),
      },
    };

    res.json(responseData);
  } catch (err) {
    console.error("Error fetching user orders:", err);

    // Enhanced error handling
    let statusCode = 500;
    let message = "An error occurred while fetching user orders.";

    if (err.isJoi) {
      statusCode = 400;
      message = err.details[0].message;
    } else if (
      err.code === "ER_NO_SUCH_TABLE" ||
      err.code === "ER_BAD_FIELD_ERROR"
    ) {
      statusCode = 500;
      message = "Database configuration error";
    } else if (err.code === "ER_ACCESS_DENIED_ERROR") {
      statusCode = 503;
      message = "Database service unavailable";
    }

    const errorResponse = {
      success: false,
      message: message,
      ...(process.env.NODE_ENV === "development" && {
        error: err.stack,
        details: err.message,
      }),
    };

    res.status(statusCode).json(errorResponse);
  }
};