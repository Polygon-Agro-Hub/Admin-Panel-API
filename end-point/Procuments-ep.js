const jwt = require("jsonwebtoken");
const db = require("../startup/database");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const { log } = require("console");
const procumentDao = require("../dao/Procuments-dao");
const ValidateSchema = require("../validations/Admin-validation");
const { type } = require("os");
const bcrypt = require("bcryptjs");

const { v4: uuidv4 } = require("uuid");
const uploadFileToS3 = require("../middlewares/s3upload");
const deleteFromS3 = require("../middlewares/s3delete");

exports.getRecievedOrdersQuantity = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    // const validatedQuery = await collectionofficerValidate.getPurchaseReport.validateAsync(req.query);

    const { page, limit, filterType, date, search } = req.query;

    console.log(page, limit);

    const reportData = await procumentDao.getRecievedOrdersQuantity(
      page,
      limit,
      filterType,
      date,
      search
    );

    console.log(reportData);
    res.json(reportData);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};

// exports.getAllOrdersWithProcessInfo = async (req, res) => {
//   const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
//   console.log(fullUrl);
//   try {
//     // If you have validation, uncomment and use this:
//     // const validatedQuery = await ordersValidate.getAllOrdersWithProcessInfo.validateAsync(req.query);

//     const { page = 1, limit = 10, filterType, date, search } = req.query;

//     const ordersData = await procumentDao.getAllOrdersWithProcessInfo(
//       page,
//       limit,
//       filterType,
//       date,
//       search
//     );

//     res.json({
//       success: true,
//       data: ordersData.items,
//       total: ordersData.total,
//       currentPage: parseInt(page),
//       totalPages: Math.ceil(ordersData.total / limit),
//     });
//   } catch (err) {
//     console.error("Error fetching orders with process info:", err);

//     // More detailed error response
//     const statusCode = err.isJoi ? 400 : 500;
//     const message = err.isJoi
//       ? err.details[0].message
//       : "An error occurred while fetching orders data.";

//     res.status(statusCode).json({
//       success: false,
//       message: message,
//       error: process.env.NODE_ENV === "development" ? err.stack : undefined,
//     });
//   }
// };

exports.getAllOrdersWithProcessInfo = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const {
      page = 1,
      limit = 10,
      statusFilter,
      dateFilter,
      dateFilter1,
      searchText,
    } = req.query;
    console.log(req.query);

    const ordersData = await procumentDao.getAllOrdersWithProcessInfo(
      page,
      limit,
      statusFilter,
      dateFilter,
      dateFilter1,
      searchText
    );
    // console.log("Orders Data:", ordersData);

    res.json({
      success: true,
      data: ordersData.items, // Using the original data without transformation
      total: ordersData.total,
      // currentPage: parseInt(page),
      // totalPages: Math.ceil(ordersData.total / limit),
      // packingStatusSummary: {
      //   packed: ordersData.items.filter((o) => o.packingStatus === "packed")
      //     .length,
      //   not_packed: ordersData.items.filter(
      //     (o) => o.packingStatus === "not_packed"
      //   ).length,
      //   // Only count explicit "not_packed" statuses
      //   no_status: ordersData.items.filter((o) => !o.packingStatus).length,
      //   // Count records with null/undefined packingStatus separately
      // },
    });
  } catch (err) {
    console.error("Error fetching orders with process info:", err);

    const statusCode = err.isJoi ? 400 : 500;
    const message = err.isJoi
      ? err.details[0].message
      : "An error occurred while fetching orders data.";

    res.status(statusCode).json({
      success: false,
      message: message,
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

exports.getAllProductTypes = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const productTypes = await procumentDao.getAllProductTypes();
    res.json(productTypes);
  } catch (err) {
    console.error("Error fetching product types:", err);
    res.status(500).send("An error occurred while fetching product types.");
  }
};

exports.getOrderDetailsById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  const { id } = req.params;
  console.log(`[getOrderDetailsById] Fetching details for order ID: ${id}`);

  try {
    // The DAO now returns properly structured data

    const orderDetails = await procumentDao.getOrderDetailsById(id);
    console.log('orderDetails', orderDetails);
    const additionalItems = await procumentDao.getAllOrderAdditionalItemsDao(
      id
    );
    console.log("additional items:", additionalItems);

    if (!orderDetails) {
      console.log(`[getOrderDetailsById] No details found for order ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Order details not found",
      });
    }

    const btype = await procumentDao.getOrderTypeDao(id);
    const excludeList = await procumentDao.getExcludeListDao(btype.userId);
    const category = await procumentDao.productCategoryDao();



    console.log(`[getOrderDetailsById] Successfully fetched order details`);
    res.json({
      success: true,
      data: orderDetails,
      additionalItems: additionalItems,
      excludeList: excludeList,
      category
    });
  } catch (err) {
    console.error("[getOrderDetailsById] Error:", err);

    // Enhanced error handling
    let statusCode = 500;
    let message = "An error occurred while fetching order details";

    if (err.isJoi) {
      statusCode = 400;
      message = err.details[0].message;
    } else if (
      err.code === "ER_NO_SUCH_TABLE" ||
      err.code === "ER_BAD_FIELD_ERROR"
    ) {
      statusCode = 500;
      message = "Database configuration error";
    } else if (err.code === "ECONNREFUSED") {
      message = "Database connection failed";
    }

    const errorResponse = {
      success: false,
      message: message,
      ...(process.env.NODE_ENV === "development" && {
        error: err.message,
        stack: err.stack,
      }),
    };

    res.status(statusCode).json(errorResponse);
  }
};

exports.createOrderPackageItem = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    console.log("Request body:", req.body);

    // Validate request body structure
    if (
      !req.body ||
      !req.body.orderPackageId ||
      !req.body.products ||
      !Array.isArray(req.body.products)
    ) {
      return res.status(400).json({
        error:
          "Invalid request format. Expected { orderPackageId: number, products: array }",
        status: false,
      });
    }

    const { orderPackageId, products } = req.body;

    // Additional validation for products array
    if (products.length === 0) {
      return res.status(400).json({
        error: "Products array cannot be empty",
        status: false,
      });
    }

    // Validate each product in the array
    for (const product of products) {
      if (
        !product.productType ||
        !product.productId ||
        !product.qty ||
        !product.price
      ) {
        return res.status(400).json({
          error:
            "Each product must have productType, productId, qty, and price",
          status: false,
        });
      }
    }

    // Use batch insert
    const result = await procumentDao.createOrderPackageItemDao(
      orderPackageId,
      products
    );
    console.log(result);

    res.status(201).json({
      message: "Order package items created successfully",
      results: result,
      status: true,
    });
  } catch (err) {
    console.error("Error executing query:", err);
    return res.status(500).json({
      error:
        err.message || "An error occurred while creating order package items",
      status: false,
    });
  }
};

exports.getAllMarketplaceItems = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log(fullUrl);

    const orderId = req.params.id;
    const btype = await procumentDao.getOrderTypeDao(orderId);
    console.log('btype', btype);

    const marketplaceItems = await procumentDao.getAllMarketplaceItems(
      btype.buyerType,
      btype.userId
    );
    console.log('marketplaceItems', marketplaceItems);

    if (!marketplaceItems || marketplaceItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No marketplace items found",
      });
    }

    // Optional: Group items by category if needed
    // const itemsByCategory = marketplaceItems.reduce((acc, item) => {
    //   if (!acc[item.category]) {
    //     acc[item.category] = [];
    //   }
    //   acc[item.category].push(item);
    //   return acc;
    // }, {});

    res.json({
      success: true,
      data: {
        items: marketplaceItems,
        // itemsByCategory, // Optional grouped data
        count: marketplaceItems.length,
      },
    });
  } catch (err) {
    console.error("Error fetching marketplace items:", err);

    let statusCode = 500;
    let message = "An error occurred while fetching marketplace items.";

    if (err.isJoi) {
      statusCode = 400;
      message = err.details[0].message;
    } else if (
      err.code === "ER_NO_SUCH_TABLE" ||
      err.code === "ER_BAD_FIELD_ERROR"
    ) {
      statusCode = 500;
      message = "Database configuration error";
    }

    const errorResponse = {
      success: false,
      message: message,
    };

    if (process.env.NODE_ENV === "development") {
      errorResponse.error = err.stack;
      errorResponse.details = err.message;
    }

    res.status(statusCode).json(errorResponse);
  }
};

exports.getAllOrdersWithProcessInfoCompleted = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const { page = 1, limit = 10, statusFilter, dateFilter, searchTerm } = req.query;
    console.log(req.query);

    console.log('searchTerm', searchTerm)

    const ordersData = await procumentDao.getAllOrdersWithProcessInfoCompleted(
      page,
      limit,
      dateFilter,
      searchTerm

    );
    // console.log("Orders Data:", ordersData);

    res.json({
      success: true,
      data: ordersData.items, // Using the original data without transformation
      total: ordersData.total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(ordersData.total / limit),
      packingStatusSummary: {
        packed: ordersData.items.filter((o) => o.packingStatus === "packed")
          .length,
        not_packed: ordersData.items.filter(
          (o) => o.packingStatus === "not_packed"
        ).length,
        // Only count explicit "not_packed" statuses
        no_status: ordersData.items.filter((o) => !o.packingStatus).length,
        // Count records with null/undefined packingStatus separately
      },
    });
  } catch (err) {
    console.error("Error fetching orders with process info:", err);

    const statusCode = err.isJoi ? 400 : 500;
    const message = err.isJoi
      ? err.details[0].message
      : "An error occurred while fetching orders data.";

    res.status(statusCode).json({
      success: false,
      message: message,
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// In your controller file
exports.updateOrderPackagePackingStatus = async (req, res) => {
  try {
    const { orderPackageId, orderId, status } = req.body;

    console.log('orderId', orderId)

    if (!orderPackageId || !status) {
      return res.status(400).json({
        error: "orderPackageId and status are required",
        status: false,
      });
    }

    const result = await procumentDao.updateOrderPackagePackingStatusDao(
      orderPackageId,
      orderId,
      status
    );

    res.status(200).json({
      message: "Packing status updated successfully",
      results: result,
      status: true,
    });
  } catch (err) {
    console.error("Error updating packing status:", err);
    return res.status(500).json({
      error: err.message || "An error occurred while updating packing status",
      status: false,
    });
  }
};

exports.getOrderPackageItemsById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const { orderId } = req.params;

    console.log('orderId', orderId)

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const orderPackages = await procumentDao.getOrderPackagesByOrderId(orderId);

    console.log('orderPackages', orderPackages)

    if (!orderPackages) {
      return res.status(404).json({
        success: false,
        message: "Order not found or contains no packages",
      });
    }

    const formattedResponse = {
      success: true,
      data: {
        invNo: orderPackages.invNo,
        packages: orderPackages.packages.map((pkg) => ({
          packageId: pkg.packageId,
          displayName: pkg.displayName,
          productPrice: pkg.productPrice,
          productTypes: pkg.productTypes.map((type) => ({
            id: type.id,
            productTypeId: type.productTypeId, // Added productTypeId
            productType: type.typeName,
            productId: type.productId, // Use explicit productId if available, fallback to id
            qty: type.qty,
            price: type.price,
            productDescription: type.displayName,
            shortCode: type.shortCode,
          })),
        })),
      },
      message: "Order package items retrieved successfully",
    };

    console.log('formattedResponse', formattedResponse.data.packages[0].productTypes[0].price)

    res.json(formattedResponse);
  } catch (err) {
    console.error("Error fetching order package items:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching order package items",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

exports.updateOrderPackageItems = async (req, res) => {
  try {
    const { orderPackageId, products } = req.body;
    console.log("Request body:", req.body);
    console.log("Products array:", products);

    // Validate required fields
    if (!orderPackageId || !products) {
      return res.status(400).json({
        error: "orderPackageId and products array are required",
        status: false,
      });
    }

    // Validate products array
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        error: "products must be a non-empty array",
        status: false,
      });
    }

    let result;

    for (let i = 0; i < products.length; i++) {
      result = await procumentDao.updateOrderPackageItemsDao(products[i]);
      console.log("results", result);
    }

    console.log("Update result:", result);

    res.status(200).json({
      message: "Order package items updated successfully",
      results: result,
      status: true,
    });
  } catch (err) {
    console.error("Error updating order package items:", err);
    return res.status(500).json({
      error:
        err.message || "An error occurred while updating order package items",
      status: false,
    });
  }
};

exports.getAllOrdersWithProcessInfoDispatched = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const { page = 1, limit = 10, statusFilter, dateFilter, searchTerm } = req.query;
    console.log(req.query);

    console.log('datefilte', dateFilter, 'searchTerm', searchTerm)

    const ordersData = await procumentDao.getAllOrdersWithProcessInfoDispatched(
      page,
      limit,
      dateFilter,
      searchTerm
    );
    // console.log("Orders Data:", ordersData);

    res.json({
      success: true,
      data: ordersData.items, // Using the original data without transformation
      total: ordersData.total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(ordersData.total / limit),
      packingStatusSummary: {
        packed: ordersData.items.filter((o) => o.packingStatus === "packed")
          .length,
        not_packed: ordersData.items.filter(
          (o) => o.packingStatus === "not_packed"
        ).length,
        // Only count explicit "not_packed" statuses
        no_status: ordersData.items.filter((o) => !o.packingStatus).length,
        // Count records with null/undefined packingStatus separately
      },
    });
  } catch (err) {
    console.error("Error fetching orders with process info:", err);

    const statusCode = err.isJoi ? 400 : 500;
    const message = err.isJoi
      ? err.details[0].message
      : "An error occurred while fetching orders data.";

    res.status(statusCode).json({
      success: false,
      message: message,
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

exports.updateDefinePackageData = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { definePackageItems, orderId } = req.body;
    const userId = req.user.userId

    console.log(req.body);

    console.log('definePackageItems', definePackageItems)

    if (!Array.isArray(definePackageItems) || definePackageItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or empty definePackageItems array'
      });
    }

    console.log('items:', definePackageItems);

    const formattedData = {
      processOrderId: definePackageItems[0].processOrderId,
      packages: definePackageItems.map(pkg => {
        const {
          itemId,
          orderpkgId,
          packageId,
          displayName,
          definePkgPrice,
          productPrice,
          items
        } = pkg;

        return {
          orderpkgId,
          packageId,
          displayName,
          definePkgPrice,
          productPrice,
          items
        };
      })
    };

    console.log('formattedData', formattedData.packages[0].items[1])

    const updateResult = await procumentDao.updateDefinePackageItemData(formattedData);
    
    const trackResult = await procumentDao.trackDispatchOfficerDao(userId, orderId);


    res.json({
      success: true,
      message: `${formattedData.affectedRows} items updated`,
      updatedItems: updateResult
    });

  } catch (err) {
    console.error("Error updating packed status:", err);

    res.status(500).json({
      success: false,
      message: 'An error occurred while updating packed status'
    });
  }
};

exports.getExcludedItems = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const orderId = req.params.orderId; // ✅ correct usage
    console.log('orderId', orderId);

    const btype = await procumentDao.getOrderTypeDao(orderId);
    const excludeList = await procumentDao.getExcludeListDao(btype.userId);

    console.log('excludeList', excludeList);

    if (!excludeList) {
      return res.status(404).json({
        success: false,
        message: "Excluded items not found",
      });
    }

    res.json(excludeList);
  } catch (err) {
    console.error("Error fetching order package items:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching order package items",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
