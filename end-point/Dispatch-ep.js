const jwt = require("jsonwebtoken");
const db = require("../startup/database");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const { log } = require("console");
const DispatchDao = require("../dao/Dispatch-dao");
const DispatchVali = require("../validations/Dispatch-validation");
const { type } = require("os");
const bcrypt = require("bcryptjs");

const { v4: uuidv4 } = require("uuid");
const uploadFileToS3 = require("../middlewares/s3upload");
const deleteFromS3 = require("../middlewares/s3delete");




exports.getPreMadePackages = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const validatedQuery = await DispatchVali.getPreMadePackages.validateAsync(req.query);
    const { page, limit, selectedStatus, date, search } = validatedQuery;

    console.log({ selectedStatus, date, search });

    const reportData = await DispatchDao.getPreMadePackages(
      page,
      limit,
      selectedStatus,
      date,
      search
    );

    // Add combinedStatus to each item in the response

    const finalResponse = {
      items: reportData.items,
      total: reportData.total
    };

    res.json(finalResponse);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};



exports.getSelectedPackages = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  // console.log(fullUrl);
  try {

    const validatedQuery = await DispatchVali.getPreMadePackages.validateAsync(req.query);
    const { page, limit, selectedStatus, date, search } = validatedQuery;

    // console.log({ selectedStatus, date, search })

    const reportData = await DispatchDao.getSelectedPackages(
      page,
      limit,
      selectedStatus,
      date,
      search
    );
    // console.log(reportData);
    res.json(reportData);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};


exports.getPackageItems = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {

    const validatedQuery = await DispatchVali.getPackageItems.validateAsync(req.query);


    const { id } = validatedQuery;
    console.log(id);

    const packageData = await DispatchDao.getPackageItems(
      id
    );
    console.log(packageData)
    res.json(packageData);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};


exports.updatePackageData = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { packedItems, id } = req.body;

    if (!Array.isArray(packedItems) || packedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or empty packedItems array'
      });
    }

    console.log('Updating isPacked status for items:', packedItems, id);

    const updateResult = await DispatchDao.updatePackageItemData(packedItems, id);
    console.log(updateResult);

    res.json({
      success: true,
      message: `${updateResult.affectedRows} items updated`,
      updatedItems: packedItems
    });

  } catch (err) {
    console.error("Error updating packed status:", err);

    res.status(500).json({
      success: false,
      message: 'An error occurred while updating packed status'
    });
  }
};


exports.getAllProducts = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {

    const productData = await DispatchDao.getAllProductsDao();
    console.log(productData)
    res.json(productData);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};


exports.replaceProductData = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { productId, quantity, totalPrice, id, previousProductId } = req.body;

    console.log('replacing products:', productId, quantity, totalPrice, id, previousProductId);

    const updateResult = await DispatchDao.replaceProductDataDao(productId, quantity, totalPrice, id, previousProductId);
    console.log(updateResult);

    res.json({
      success: true,
      message: `${updateResult.affectedRows} items updated`,
      updatedItems: updateResult
    });

  } catch (err) {
    console.error("Error replacing product:", err);

    res.status(500).json({
      success: false,
      message: 'An error occurred while replacing product'
    });
  }
};


exports.getAdditionalItems = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {

    const validatedQuery = await DispatchVali.geAdditionalItems.validateAsync(req.query);


    const { id } = validatedQuery;
    console.log(id);

    const AdditionalItemData = await DispatchDao.getAdditionalItems(
      id
    );
    console.log(AdditionalItemData)
    res.json(AdditionalItemData);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};


exports.updateAdditionalItemData = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { additionalItems, id } = req.body;

    if (!Array.isArray(additionalItems) || additionalItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or empty additional items array'
      });
    }

    console.log('Updating isPacked status for additional items:', additionalItems, id);

    const updateResult = await DispatchDao.updateAdditionalItemData(additionalItems, id);
    console.log(updateResult);
    res.json({
      success: true,
      message: `${updateResult.affectedRows} items updated`,
      updatedItems: additionalItems
    });

  } catch (err) {
    console.error("Error updating packed status:", err);

    res.status(500).json({
      success: false,
      message: 'An error occurred while updating packed status'
    });
  }
};


exports.getCustomOrderDetailsById = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log(fullUrl);

    // Validate the ID parameter
    const { id } = await DispatchVali.idValidate.validateAsync(
      req.params
    );

    // Call the DAO to get the news item by ID
    const items = await DispatchDao.getCustomOrderDetailsById(id);

    if (items.length === 0) {
      return res.status(404).json({ message: "items not found" });
    }

    console.log("Successfully fetched the items");
    return res.status(200).json(items);
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


exports.updateCustomPackItems = async (req, res) => {
  try {
    const { invoiceId, updatedItems } = req.body;

    if (!invoiceId || !Array.isArray(updatedItems)) {
      return res.status(400).json({ message: 'Invalid data format' });
    }

    await DispatchDao.updateCustomPackItems(updatedItems);

    return res.status(200).json({ message: 'Packed items updated successfully' });
  } catch (err) {
    console.error('Error updating packed items:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getCustomAdditionalItems = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {

    const validatedQuery = await DispatchVali.getCustomAdditionalItems.validateAsync(req.query);


    const { id } = validatedQuery;
    console.log(id);

    const CustomAdditionalItemData = await DispatchDao.getCustomAdditionalItems(
      id
    );
    console.log(CustomAdditionalItemData)
    res.json(CustomAdditionalItemData);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};

exports.updateCustomAdditionalItemData = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { customAdditionalItems, id } = req.body;

    if (!Array.isArray(customAdditionalItems) || customAdditionalItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or empty additional items array'
      });
    }

    console.log('Updating isPacked status for additional items:', customAdditionalItems, id);

    const updateResult = await DispatchDao.updateCustomAdditionalItemData(customAdditionalItems, id);
    console.log(updateResult);
    res.json({
      success: true,
      message: `${updateResult.affectedRows} items updated`,
      updatedItems: customAdditionalItems
    });

  } catch (err) {
    console.error("Error updating packed status:", err);

    res.status(500).json({
      success: false,
      message: 'An error occurred while updating packed status'
    });
  }
};


exports.getPackageOrderDetailsById = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log(fullUrl);

    // Validate the ID parameter
    const { id } = await DispatchVali.idValidate.validateAsync(
      req.params
    );

    // Call the DAO to get the news item by ID
    const items = await DispatchDao.getPackageOrderDetailsById(id);

    if (items.length === 0) {
      return res.status(404).json({ message: "items not found" });
    }

    console.log("Successfully fetched the items");
    return res.status(200).json(items);
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



exports.updatePackAdditionItems = async (req, res) => {
  try {
    const { invoiceId, updatedItems } = req.body;

    console.log('Request received:', { invoiceId, updatedItems });

    if (!updatedItems || !Array.isArray(updatedItems)) {
      return res.status(400).json({ message: 'Invalid request format.' });
    }

    // Update the items first
    await DispatchDao.updatePackItemsAdditional(updatedItems);
    console.log('Items updated successfully');

    // Get the orderPackageItemsId from the first item
    if (updatedItems.length > 0) {
      // We need to determine which ID to use
      const itemId = updatedItems[0].id;
      console.log('Processing item ID:', itemId);

      // Get associated order ID
      const orderResult = await DispatchDao.getOrderPackageId(itemId);
      console.log('Order result:', orderResult);

      if (orderResult && orderResult.length > 0) {
        const orderId = orderResult[0].orderId;
        console.log('Found order ID:', orderId);

        // Get status of additional items for this order
        const additionalItemsStatus = await DispatchDao.getAdditionalItemsStatus(orderId);
        console.log('Additional items status:', additionalItemsStatus);

        const totalItems = additionalItemsStatus.totalItems || 0;
        const packedItems = additionalItemsStatus.packedItems || 0;

        // Determine addItemStatus based on packed items
        let addItemStatus;
        if (packedItems === 0) {
          addItemStatus = 'Pending';  // No items packed
        } else if (packedItems < totalItems) {
          addItemStatus = 'Opened';   // Some items packed
        } else {
          addItemStatus = 'Completed'; // All items packed
        }
        console.log('Calculated addItemStatus:', addItemStatus);

        // Get current packItemStatus
        const packItemStatus = await DispatchDao.getPackItemStatus(orderId);
        console.log('Current packItemStatus:', packItemStatus);

        // Update the order statuses
        const updateResult = await DispatchDao.updateOrderStatuses(orderId, addItemStatus, packItemStatus);
        console.log('Update result:', updateResult);
      } else {
        console.log('No order found for item ID:', itemId);
      }
    }

    return res.status(200).json({ message: 'Updated successfully.' });
  } catch (error) {
    console.error('Error updating custom pack items:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};



exports.getMarketPlacePremadePackages = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const validatedQuery = await DispatchVali.getPreMadePackages.validateAsync(req.query);
    const { page, limit, selectedStatus, date, search } = validatedQuery;

    console.log({ selectedStatus, date, search });

    const packageData = await DispatchDao.getMarketPlacePremadePackagesDao(
      page,
      limit,
      selectedStatus,
      date,
      search
    );

    // Add combinedStatus to each item in the response

    const finalResponse = {
      items: packageData.items,
      total: packageData.total,
      status: true
    };

    res.json(finalResponse);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};

exports.getMarketPlacePremadePackagesItems = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { id } = await DispatchVali.idValidate.validateAsync(req.params);


    const packageData = await DispatchDao.getMarketPlacePremadePackagesItemsDao(id);
    const additionalData = await DispatchDao.getMarketPlacePremadePackagesAdditionalItemsDao(id);

    // Add combinedStatus to each item in the response



    res.json({ packageData, additionalData });
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};


exports.getMarketPlaceCustomePackages = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const validatedQuery = await DispatchVali.getPreMadePackages.validateAsync(req.query);
    const { page, limit, selectedStatus, date, search } = validatedQuery;

    console.log({ selectedStatus, date, search });

    const packageData = await DispatchDao.getMarketPlaceCustomePackagesDao(
      page,
      limit,
      selectedStatus,
      date,
      search
    );

    // Add combinedStatus to each item in the response

    const finalResponse = {
      items: packageData.items,
      total: packageData.total,
      status: true
    };

    console.log('-----',packageData.total,'---------');
    

    res.json(finalResponse);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};


exports.getPackageForDispatch = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { id } = await DispatchVali.idValidate.validateAsync(req.params);


    const packageData = await DispatchDao.getPackageForDispatchDao(id);
    console.log(packageData);
    


    res.json(packageData);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};