const MarketPlaceDao = require("../dao/MarketPlace-dao");
const uploadFileToS3 = require("../middlewares/s3upload");
const deleteFromS3 = require("../middlewares/s3delete");
const MarketPriceValidate = require("../validations/MarketPlace-validation");


exports.getAllCropCatogory = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const result = await MarketPlaceDao.getAllCropNameDAO();


    return res.status(200).json(result);
  } catch (error) {
    if (error.isJoi) {

      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};



exports.createMarketProduct = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);


    const product = {
      cropName: req.body.displayName || req.body.cropName,
      normalPrice: req.body.normalPrice,
      discountedPrice: req.body.salePrice,
      promo: req.body.promo,
      unitType: req.body.unitType,
      startValue: req.body.startValue,
      changeby: req.body.changeby,
      tags: req.body.tags,
      category: req.body.category,
      discount: req.body.discount,
      varietyId: req.body.varietyId,
      displaytype: req.body.displaytype,
      maxQuantity: req.body.maxQuantity,
    };

    const { exists, varietyExists, nameExists } =
      await MarketPlaceDao.checkMarketProductExistsDao(
        product.varietyId,
        product.cropName,
        product.category
      );

    if (exists) {
      let message = "";
      if (varietyExists && nameExists) {
        message =
          "A product with the same display name and variety already exists in this category. Please enter unique values.";
      } else if (varietyExists) {
        message =
          "A product with the same variety already exists in this category. Please select a different variety.";
      } else if (nameExists) {
        message =
          "A product with the same display name already exists in this category. Please use a different display name.";
      }

      return res.status(201).json({
        message: message,
        status: false,
      });
    }


    const result = await MarketPlaceDao.createMarketProductDao(product);


    if (result.affectedRows === 0) {
      return res.json({
        message: "Market product creation failed",
        result: result,
        status: false,
      });
    }

    res.status(201).json({
      message: "Market product created successfully",
      result: result,
      status: true,
    });
  } catch (err) {
    if (err.isJoi) {
      return res
        .status(400)
        .json({ error: err.details[0].message, status: false });
    }

    console.error("Error executing query:", err);
    return res.status(500).json({
      error: "An error occurred while creating market product",
      status: false,
    });
  }
};

exports.getMarketplaceItems = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const { page, limit, search, displayTypeValue, categoryValue, discountFilter } = req.query;
    const parsedLimit = parseInt(limit, 10) || 10;
    const parsedPage = parseInt(page, 10) || 1;
    const offset = (parsedPage - 1) * parsedLimit;



    const { total, items } = await MarketPlaceDao.getMarketplaceItems(
      parsedLimit,
      offset,
      search,
      displayTypeValue,
      categoryValue,
      discountFilter
    );



    res.json({
      items,
      total,
    });
  } catch (error) {
    console.error("Error fetching marketplace items:", error);
    return res.status(500).json({
      error: "An error occurred while fetching marketplace items",
    });
  }
};
exports.deleteMarketplaceItem = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);


    const { id } = req.params;

    const affectedRows = await MarketPlaceDao.deleteMarketplaceItem(id);

    if (affectedRows === 0) {
      return res.status(404).json({ message: "Marketplace item not found" });
    } else {

      return res.status(200).json({ status: true });
    }
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error deleting marketplace item:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting the marketplace item" });
  }
};

exports.createCoupen = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);


    const coupen =
      await MarketPriceValidate.CreateCoupenValidation.validateAsync(req.body);



    const existingCoupon = await MarketPlaceDao.getCouponByCodeDao(coupen.code);
    if (existingCoupon) {
      return res.status(409).json({
        error: "Coupon with this code already exists",
        status: false,
      });
    }


    const result = await MarketPlaceDao.createCoupenDAO(coupen);


    return res.status(201).json({
      message: "coupen created successfully",
      result: result,
      status: true,
    });
  } catch (err) {
    if (err.isJoi) {

      return res
        .status(400)
        .json({ error: err.details[0].message, status: false });
    }

    console.error("Error executing query:", err);
    return res.status(500).json({
      error: "An error occurred while creating coupon",
      status: false,
    });
  }
};

exports.getAllCoupen = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const { page, limit, status, types, searchText } =
      await MarketPriceValidate.couponQuaryParamSchema.validateAsync(req.query);


    const offset = (page - 1) * limit;
    const { total, items } = await MarketPlaceDao.getAllCoupenDAO(
      limit,
      offset,
      status,
      types,
      searchText
    );

    res.json({ total, items });

  } catch (error) {
    console.error("Error fetching marketplace items:", error);
    return res.status(500).json({
      error: "An error occurred while fetching marketplace items",
    });
  }
};

exports.deleteCoupenById = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);



    const { id } = await MarketPriceValidate.deleteCoupenSchema.validateAsync(
      req.params
    );


    const affectedRows = await MarketPlaceDao.deleteCoupenById(id);

    if (affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Coupen not found", status: false });
    } else {

      return res.status(200).json({ message: "Coupen Deleted", status: true });
    }
  } catch (err) {
    if (err.isJoi) {

      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error deleting Coupen:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting Coupen" });
  }
};

exports.deleteAllCoupen = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const affectedRows = await MarketPlaceDao.deleteAllCoupen();

    if (affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Coupenes not found", status: false });
    } else {

      return res
        .status(200)
        .json({ message: "Coupenes Deleted", status: true });
    }
  } catch (err) {
    if (err.isJoi) {

      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error deleting Coupenes:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting Coupenes" });
  }
};

exports.getAllProductCropCatogory = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const result = await MarketPlaceDao.getAllProductCropCatogoryDAO();

    return res.status(200).json(result);
  } catch (error) {
    if (error.isJoi) {

      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};
exports.createPackage = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const package = JSON.parse(req.body.package);


    let profileImageUrl = null;

    if (req.body.file) {
      try {
        const base64String = req.body.file.split(",")[1];
        const mimeType = req.body.file.match(/data:(.*?);base64,/)[1];
        const fileBuffer = Buffer.from(base64String, "base64");
        const fileExtension = mimeType.split("/")[1];
        const fileName = `${package.displayName}.${fileExtension}`;

        profileImageUrl = await uploadFileToS3(
          fileBuffer,
          fileName,
          "marketplacepackages/image"
        );
      } catch (err) {
        console.error("Error processing image file:", err);
        return res.status(400).json({
          error: "Invalid file format or file upload error",
          status: false,
        });
      }
    }



    const packageId = await MarketPlaceDao.creatPackageDAO(
      package,
      profileImageUrl
    );

    if (!packageId || packageId <= 0) {
      return res.status(500).json({
        message: "Package creation failed",
        status: false,
      });
    }

    try {
      const quantities = package.quantities;

      for (const [productTypeId, qty] of Object.entries(quantities)) {

        if (qty <= 0) continue;


        const itemData = {
          productTypeId: parseInt(productTypeId),
          qty: parseInt(qty),
        };

        await MarketPlaceDao.creatPackageDetailsDAO(itemData, packageId);
      }
    } catch (err) {
      console.error("Error creating package details:", err);
      return res.status(500).json({
        error: "Error creating package details",
        status: false,
      });
    }

    return res.status(201).json({
      message: "Package created successfully",
      status: true,
      packageId: packageId,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({
        error: err.details[0].message,
        status: false,
      });
    }

    console.error("Error creating package:", err);
    return res.status(500).json({
      error: "An error occurred while creating marketplace package",
      status: false,
    });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const { id } = await MarketPriceValidate.IdparamsSchema.validateAsync(
      req.params
    );

    const result = await MarketPlaceDao.getProductById(id);


    res.json(result);

  } catch (error) {
    console.error("Error fetching marketplace items:", error);
    return res.status(500).json({
      error: "An error occurred while fetching marketplace items",
    });
  }
};

exports.editMarketProduct = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    const { id } = await MarketPriceValidate.IdparamsSchema.validateAsync(
      req.params
    );

    const product = req.body;

    const { exists, varietyExists, nameExists } =
      await MarketPlaceDao.checkMarketEditProductExistsDao(
        product.varietyId,
        product.cropName,
        product.category,
        id
      );

    if (exists) {
      let message = "";
      if (varietyExists && nameExists) {
        message =
          "A product with the same display name and variety already exists in this category. Please enter unique values.";
      } else if (varietyExists) {
        message =
          "A product with the same variety already exists in this category. Please select a different variety.";
      } else if (nameExists) {
        message =
          "A product with the same display name already exists in this category. Please use a different display name.";
      }

      return res.status(201).json({
        message: message,
        status: false,
      });
    }


    const result = await MarketPlaceDao.updateMarketProductDao(req.body, id);

    if (result.affectedRows === 0) {
      return res.json({
        message: "market product update unsuccessful",
        result: result,
        status: false,
      });
    }


    res.status(201).json({
      message: "market product updated successfully",
      result: result,
      status: true,
    });
  } catch (err) {
    if (err.isJoi) {

      return res
        .status(400)
        .json({ error: err.details[0].message, status: false });
    }

    console.error("Error executing query:", err);
    return res.status(500).json({
      error: "An error occurred while updating market product",
      status: false,
    });
  }
};
exports.getAllMarketplacePackages = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {

    const { searchText, date } =
      await MarketPriceValidate.getAllPackageSchema.validateAsync(req.query);



    const packages = await MarketPlaceDao.getAllMarketplacePackagesDAO(
      searchText,
      date
    );


    return res.status(200).json({
      success: true,
      message: "Marketplace packages retrieved successfully",
      data: packages,
    });
  } catch (error) {
    if (error.isJoi) {

      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    console.error("Error fetching marketplace packages:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred while fetching marketplace packages",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.deleteMarketplacePackages = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);


    const { id } = req.params;

    const affectedRows = await MarketPlaceDao.removeMarketplacePckages(id);

    if (affectedRows === 0) {
      return res.status(404).json({ message: "Marketplace item not found" });
    } else {

      return res.status(200).json({ status: true });
    }
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error deleting marketplace item:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting the marketplace item" });
  }
};

exports.getMarketplacePackagesByDate = async (req, res) => {
  try {
    const { date } = req.query;
    const data = await MarketPlaceDao.getMarketplacePackagesByDateDAO(date);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error in getMarketplacePackagesByDate:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.updateMarketplacePackage = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);


    const { id } = await MarketPriceValidate.IdparamsSchema.validateAsync(
      req.params
    );


    const packageData =
      await MarketPriceValidate.UpdatePackageSchema.validateAsync(req.body);



    const result = await MarketPlaceDao.updateMarketplacePackageDAO(
      id,
      packageData
    );

    if (result.message === "Package updated successfully") {

      return res.status(200).json({
        message: "Marketplace package updated successfully",
        result: result,
        status: true,
      });
    } else {
      return res.status(404).json({
        message: "Marketplace package update unsuccessful - package not found",
        result: result,
        status: false,
      });
    }
  } catch (err) {
    if (err.isJoi) {

      return res.status(400).json({
        error: err.details[0].message,
        status: false,
      });
    }

    console.error("Error updating marketplace package:", err);
    return res.status(500).json({
      error: "An error occurred while updating marketplace package",
      status: false,
      details: err.message,
    });
  }
};

exports.getMarketplacePackageById = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const { id } = await MarketPriceValidate.IdparamsSchema.validateAsync(
      req.params
    );

    const resultRows = await MarketPlaceDao.getMarketplacePackageByIdDAO(id);


    const firstRow = resultRows[0];

    const productPrice = parseFloat(firstRow.productPrice) || 0;
    const packingFee = parseFloat(firstRow.packingFee) || 0;
    const serviceFee = parseFloat(firstRow.serviceFee) || 0;

    const total = productPrice + packingFee + serviceFee;
    const packageItems = await MarketPlaceDao.getPackageEachItemsDao(id);

    const packageData = {
      displayName: firstRow.displayName,
      status: firstRow.status || "Enabled",
      description: firstRow.description,
      productPrice,
      packageFee: packingFee,
      serviceFee,
      approximatedPrice: parseFloat(total.toFixed(2)),
      imageUrl:
        firstRow.image && !firstRow.image.startsWith("http")
          ? `${req.protocol}://${req.get("host")}/${firstRow.image}`
          : firstRow.image,
      packageItems,
    };



    res.json(packageData);

  } catch (error) {
    console.error("Error fetching marketplace package:", error);

    if (error.message === "Package not found") {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "An error occurred while fetching marketplace package",
    });
  }
};



exports.getMarketplacePackageWithDetailsById = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const { id } = await MarketPriceValidate.IdparamsSchema.validateAsync(
      req.params
    );


    const packageData =
      await MarketPlaceDao.getMarketplacePackageByIdWithDetailsDAO(id);


    const definePackageData =
      await MarketPlaceDao.getDefinePackageItemsByPackageIdDAO(id);


    const baseTotal =
      packageData.productPrice +
      packageData.packingFee +
      packageData.serviceFee;


    const productsTotal = packageData.packageDetails.reduce((sum, item) => {
      return sum + (item.productType?.price || 0) * item.qty;
    }, 0);


    const grandTotal = baseTotal + productsTotal + definePackageData.totalPrice;


    const formattedResponse = {
      ...packageData,
      definePackage: {
        createdAt: definePackageData.createdAt,
        items: definePackageData.items,
        totalPrice: definePackageData.totalPrice,
      },
      pricingSummary: {
        basePrice: packageData.productPrice,
        packingFee: packageData.packingFee,
        serviceFee: packageData.serviceFee,
        productsTotal,
        definePackageTotal: definePackageData.totalPrice,
        grandTotal,
      },
      packageDetails: packageData.packageDetails.map((detail) => ({
        ...detail,
        totalPrice: (detail.productType?.price || 0) * detail.qty,
      })),
    };

    const response = {
      success: true,
      message: "Marketplace package retrieved successfully",
      data: formattedResponse,
    };

    res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching marketplace package:", error.message);

    if (error.message === "Package not found") {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    res.status(500).json({
      success: false,
      error:
        "An internal server error occurred while fetching marketplace package",
    });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    let package;
    if (typeof req.body.package === "string") {
      package = JSON.parse(req.body.package);
    } else {
      package = req.body.package;
    }



    let profileImageUrl = package.existingImage || null;

    if (req.body.file) {
      try {
        const base64String = req.body.file.split(",")[1];
        const mimeType = req.body.file.match(/data:(.*?);base64,/)[1];
        const fileBuffer = Buffer.from(base64String, "base64");
        const fileExtension = mimeType.split("/")[1];
        const fileName = `${package.displayName}.${fileExtension}`;

        profileImageUrl = await uploadFileToS3(
          fileBuffer,
          fileName,
          "marketplacepackages/image"
        );
      } catch (err) {
        console.error("Error processing image file:", err);
        return res.status(400).json({
          error: "Invalid file format or file upload error",
          status: false,
        });
      }
    }


    const updatedRows = await MarketPlaceDao.updatePackageDAO(
      package,
      profileImageUrl,
      package.packageId || req.params.id
    );

    if (updatedRows === 0) {
      return res.status(404).json({
        message: "Package not found or no changes made",
        status: false,
      });
    }


    try {

      if (typeof MarketPlaceDao.deletePackageDetails === "function") {
        await MarketPlaceDao.deletePackageDetails(
          package.packageId || req.params.id
        );
      } else {
        throw new Error("deletePackageDetails DAO function not available");
      }


      for (const item of package.Items) {
        await MarketPlaceDao.creatPackageDetailsDAOEdit(
          item,
          package.packageId || req.params.id
        );
      }
    } catch (err) {
      console.error("Error updating package details:", err);
      return res.status(500).json({
        error: "Error updating package details: " + err.message,
        status: false,
      });
    }

    return res.status(200).json({
      message: "Package updated successfully",
      status: true,
      packageId: package.packageId || req.params.id,
    });
  } catch (err) {
    console.error("Error updating package:", err);
    return res.status(500).json({
      error: "An error occurred while updating marketplace package",
      status: false,
    });
  }
};

exports.getMarketplaceUsers = async (req, res) => {
  const buyerType = req.query.buyerType || "retail";
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("URL:", fullUrl);

  try {
    const result = await MarketPlaceDao.getMarketplaceUsers(buyerType);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching marketplace users:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching marketplace users" });
  }
};

exports.deleteMarketplaceUser = async (req, res) => {
  const userId = req.params.userId;
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("URL:", fullUrl);

  try {
    const result = await MarketPlaceDao.deleteMarketplaceUser(userId);

    return res.status(200).json({ status: true, message: result.message });
  } catch (error) {
    console.error("Error deactivating marketplace user:", error.message);
    return res.status(400).json({ status: false, message: error.message });
  }
};

exports.getNextBannerIndexRetail = async (req, res) => {
  try {
    const nextOrderNumber = await MarketPlaceDao.getNextBannerIndexRetail();
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

exports.getNextBannerIndexWholesale = async (req, res) => {
  try {
    const nextOrderNumber = await MarketPlaceDao.getNextBannerIndexWholesale();
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

exports.uploadBanner = async (req, res) => {
  try {
    const validatedBody = req.body;
    const { index, name } = validatedBody;

    const currentCount = await MarketPlaceDao.getBannerCount("Retail");

    if (currentCount >= 5) {
      return res.status(400).json({
        error:
          "You have added the maximum number of banner options. If you want to add another, please delete one first.",
      });
    }

    let image;

    if (req.file) {
      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;

      image = await uploadFileToS3(
        fileBuffer,
        fileName,
        "marketplacebanners/image"
      );
    }

    const bannerData = {
      index,
      name,
      image,
    };

    const result = await MarketPlaceDao.createBanner(bannerData);


    return res.status(201).json({
      message: result.message,
    });
  } catch (error) {
    console.error("Error creating banner:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while creating banner" });
  }
};

exports.uploadBannerWholesale = async (req, res) => {
  try {
    const validatedBody = req.body;

    const { index, name } = validatedBody;

    const currentCount = await MarketPlaceDao.getBannerCount("Wholesale");

    if (currentCount >= 5) {
      return res.status(400).json({
        error:
          "You have added the maximum number of banner options. If you want to add another, please delete one first.",
      });
    }

    let image;

    if (req.file) {
      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;

      image = await uploadFileToS3(
        fileBuffer,
        fileName,
        "marketplacebanners/image"
      );
    }

    const bannerData = {
      index,
      name,
      image,
    };

    const result = await MarketPlaceDao.createBannerWholesale(bannerData);

    return res.status(201).json({
      message: result.message,
    });
  } catch (error) {
    console.error("Error creating PlantCare user:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while creating PlantCare user" });
  }
};

exports.getAllBanners = async (req, res) => {
  try {
    const banners = await MarketPlaceDao.getAllBanners();


    res.json({
      banners,
    });
  } catch (err) {
    if (err.isJoi) {

      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.getAllBannersWholesale = async (req, res) => {
  try {
    const banners = await MarketPlaceDao.getAllBannersWholesale();


    res.json({
      banners,
    });
  } catch (err) {
    if (err.isJoi) {

      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.updateBannerOrder = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);
    const feedbacks = req.body.feedbacks;
    const result = await MarketPlaceDao.updateBannerOrder(feedbacks);

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

exports.deleteBannerRetail = async (req, res) => {
  const bannerId = parseInt(req.params.id, 10);

  if (isNaN(bannerId)) {
    return res.status(400).json({ error: "Invalid bannerId ID" });
  }

  try {

    const banner = await MarketPlaceDao.getBannerById(bannerId);
    if (!banner) {
      return res.status(404).json({ error: "banner not found" });
    }

    const orderNumber = banner.indexId;


    const result = await MarketPlaceDao.deleteBannerRetail(
      bannerId,
      orderNumber
    );

    return res.status(200).json({
      message: "banner deleted and order updated successfully",
      result,
    });
  } catch (error) {
    console.error("Error deleting feedbannerback:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteBannerWhole = async (req, res) => {
  const bannerId = parseInt(req.params.id, 10);

  if (isNaN(bannerId)) {
    return res.status(400).json({ error: "Invalid bannerId ID" });
  }

  try {

    const banner = await MarketPlaceDao.getBannerById(bannerId);
    if (!banner) {
      return res.status(404).json({ error: "banner not found" });
    }

    const orderNumber = banner.indexId;


    const result = await MarketPlaceDao.deleteBannerWhole(
      bannerId,
      orderNumber
    );

    return res.status(200).json({
      message: "banner deleted and order updated successfully",
      result,
    });
  } catch (error) {
    console.error("Error deleting feedbannerback:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.createProductType = async (req, res) => {
  try {
    const data =
      await MarketPriceValidate.createProductTypeSchema.validateAsync(req.body);
    const result = await MarketPlaceDao.createProductTypesDao(data);

    if (result.affectedRows === 0) {
      return res.json({
        message: "Product type creation failed",
        status: false,
      });
    }

    return res.status(201).json({
      message: "Product type created successfully",
      status: true,
    });
  } catch (error) {
    console.error("Error creating Product type:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.viewProductType = async (req, res) => {
  try {
    const result = await MarketPlaceDao.viewProductTypeDao();

    return res.status(201).json({
      message: "Product find successfully",
      status: true,
      data: result,
    });
  } catch (error) {
    console.error("Error creating Product type:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getProductType = async (req, res) => {
  try {
    const result = await MarketPlaceDao.getProductType();

    return res.status(201).json({
      message: "Product find successfully",
      status: true,
      data: result,
    });
  } catch (error) {
    console.error("Error creating Product type:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.editPackage = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const package = JSON.parse(req.body.package);
    const packageItems = package.packageItems;
    const id = req.params.id;


    let profileImageUrl = null;


    const exists = await MarketPlaceDao.checkPackageDisplayNameExistsDao(
      package.displayName,
      id
    );

    if (exists) {
      return res.json({
        status: false,
        message: "A package with this display name already exists. Please choose a different name.",
      });
    }




    if (req.body.file) {

      const imageUrl = package.imageUrl;
      if (imageUrl) {
        await deleteFromS3(imageUrl);
      }

      try {
        const base64String = req.body.file.split(",")[1];
        const mimeType = req.body.file.match(/data:(.*?);base64,/)[1];
        const fileBuffer = Buffer.from(base64String, "base64");
        const fileExtension = mimeType.split("/")[1];
        const fileName = `${package.displayName}.${fileExtension}`;

        profileImageUrl = await uploadFileToS3(
          fileBuffer,
          fileName,
          "marketplacepackages/image"
        );
      } catch (err) {
        console.error("Error processing image file:", err);
        return res.status(400).json({
          error: "Invalid file format or file upload error",
          status: false,
        });
      }
    } else {

      profileImageUrl = package.imageUrl;
    }




    const packageId = await MarketPlaceDao.creatPackageDAO(
      package,
      profileImageUrl
    );

    if (!packageId || packageId <= 0) {
      return res.status(500).json({
        message: "Package Edit failed",
        status: false,
      });
    }

    const removepackage = await MarketPlaceDao.removeMarketplacePckages(id);
    if (removepackage === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Marketplace item not found" });
    }



    for (let i = 0; i < packageItems.length; i++) {
      if (
        packageItems[i].productTypeId !== null &&
        packageItems[i].qty !== 0 &&
        packageItems[i].qty !== null
      ) {
        const itemData = {
          productTypeId: parseInt(packageItems[i].productTypeId),
          qty: parseInt(packageItems[i].qty),
        };
        await MarketPlaceDao.creatPackageDetailsDAO(itemData, packageId);
      }
    }

    return res.status(200).json({
      message: "Package updated successfully",
      status: true,
      id: id,
      packageId: packageId
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({
        error: err.details[0].message,
        status: false,
      });
    }

    console.error("Error updating package:", err);
    return res.status(500).json({
      error: "An error occurred while updating marketplace package",
      status: false,
    });
  }
};

exports.getProductTypeById = async (req, res) => {
  try {
    const { id } = await MarketPriceValidate.IdparamsSchema.validateAsync(
      req.params
    );

    const result = await MarketPlaceDao.getProductTypeByIdDao(id);

    res.status(201).json({
      message: "Product find successfully",
      status: true,
      data: result,
    });
  } catch (error) {
    console.error("Error creating Product type:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.editProductType = async (req, res) => {
  try {
    const { id } = await MarketPriceValidate.IdparamsSchema.validateAsync(
      req.params
    );
    const data =
      await MarketPriceValidate.createProductTypeSchema.validateAsync(req.body);
    const result = await MarketPlaceDao.editProductTypesDao(data, id);

    if (result.affectedRows === 0) {
      return res.json({
        message: "Product type edit failed",
        status: false,
      });
    }

    return res.status(201).json({
      message: "Product type edit successfully",
      status: true,
    });
  } catch (error) {
    console.error("Error edit Product type:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteProductType = async (req, res) => {
  try {
    const { id } = await MarketPriceValidate.IdparamsSchema.validateAsync(
      req.params
    );
    const result = await MarketPlaceDao.DeleteProductTypeByIdDao(id);

    if (result.affectedRows === 0) {
      return res.json({
        message: "Product type delete failed",
        status: false,
      });
    }

    return res.status(201).json({
      message: "Product type delete successfully",
      status: true,
    });
  } catch (error) {
    console.error("Error edit Product type:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllRetailOrders = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { page, limit, status, method, searchItem, formattedDate } =
      await MarketPriceValidate.getAllRetailOrderSchema.validateAsync(
        req.query
      );

    const offset = (page - 1) * limit;

    const { total, items } = await MarketPlaceDao.getAllRetailOrderDetails(
      limit,
      offset,
      status,
      method,
      searchItem,
      formattedDate
    );
    res.json({
      items,
      total,
    });
  } catch (err) {
    if (err.isJoi) {

      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.getAllDeliveryCharges = async (req, res) => {
  try {


    const { searchItem, city } = req.query;

    const deliveryCharges = await MarketPlaceDao.getAllDeliveryCharges(
      searchItem,
      city
    );

    res.json(deliveryCharges);
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching delivery charges.");
  }
};

exports.uploadDeliveryCharges = async (req, res) => {
  try {
    const userId = req.user.userId
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const result = await MarketPlaceDao.uploadDeliveryCharges(req.file.buffer, userId);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        inserted: result.inserted,
        duplicates: result.duplicates,
      },
    });
  } catch (error) {
    console.error("Error uploading delivery charges:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload delivery charges",
    });
  }
};

exports.editDeliveryCharge = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const deliveryData = req.body;
    const id = req.params.id;
    const userId = req.user.userId

    if (!deliveryData.city || !deliveryData.charge) {
      return res.status(400).json({
        error: "City and charge are required fields",
        status: false,
      });
    }


    const results = await MarketPlaceDao.editDeliveryChargeDAO(
      deliveryData,
      id,
      userId
    );

    if (!results || results.affectedRows === 0) {
      return res.status(404).json({
        message: "Delivery charge not found or update failed",
        status: false,
      });
    }

    return res.status(200).json({
      message: "Delivery charge updated successfully",
      status: true,
      id: id,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({
        error: err.details[0].message,
        status: false,
      });
    }

    console.error("Error updating delivery charge:", err);
    return res.status(500).json({
      error: "An error occurred while updating delivery charge",
      status: false,
    });
  }
};


exports.checkPackageDisplayNameExists = async (req, res) => {
  try {
    const { displayName } = req.query;

    if (!displayName) {
      return res.status(400).json({
        error: "Display name is required",
        status: false,
      });
    }

    const exists = await MarketPlaceDao.checkPackageDisplayNameExistsDao(
      displayName
    );

    return res.status(200).json({
      exists,
      status: true,
    });
  } catch (err) {
    console.error("Error checking display name:", err);
    return res.status(500).json({
      error: "An error occurred while checking display name",
      status: false,
    });
  }
};

exports.getAllRetailCustomers = async (req, res) => {
  try {
    const { page, limit, searchText } =
      await MarketPriceValidate.getmarketplaceCustomerParamSchema.validateAsync(
        req.query
      );
    const offset = (page - 1) * limit;
    const { total, items } = await MarketPlaceDao.getAllRetailCustomersDao(
      limit,
      offset,
      searchText
    );

    return res.status(200).json({
      total,
      items,
    });
  } catch (err) {
    console.error("Error checking display name:", err);
    return res.status(500).json({
      error: "An error occurred while checking display name",
      status: false,
    });
  }
};

exports.getOrderDetailsById = async (req, res) => {
  const { id } = req.params;


  try {

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }


    const orderDetails = await MarketPlaceDao.getOrderDetailsById(id);

    if (!orderDetails) {

      return res.status(404).json({
        success: false,
        message: "Order details not found",
      });
    }

    const response = {
      success: true,
      data: {
        invNo: orderDetails.invNo || null,
        packages: orderDetails.packages.map((pkg) => ({
          packageId: pkg.packageId,
          displayName: pkg.displayName,
          productPrice: pkg.productPrice || null,
          productTypes: pkg.productTypes.map((item) => ({
            id: item.id,
            typeName: item.typeName,
            shortCode: item.shortCode,
            qty: item.qty,
          })),
        })),
      },
    };


    res.json(response);
  } catch (err) {
    console.error("[getOrderDetailsById] Error:", err);


    const statusCode = err.message.includes("Database error") ? 503 : 500;
    const message = err.message.includes("Database error")
      ? "Database service error"
      : "An error occurred while fetching order details";

    res.status(statusCode).json({
      success: false,
      message: message,
      ...(process.env.NODE_ENV === "development" && { error: err.message }),
    });
  }
};

exports.getAllMarketplaceItems = async (req, res) => {
  try {



    const marketplaceItems = await MarketPlaceDao.getAllMarketplaceItems();

    if (!marketplaceItems || marketplaceItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No marketplace items found",
      });
    }


    const itemsByCategory = marketplaceItems.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        items: marketplaceItems,
        itemsByCategory,
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

exports.createDefinePackageWithItems = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const userId = req.user.userId;


    if (
      !req.body ||
      !req.body.packageData ||
      !req.body.packageItems ||
      !Array.isArray(req.body.packageItems)
    ) {
      return res.status(400).json({
        error:
          "Invalid request format. Expected { packageData: object, packageItems: array }",
        status: false,
      });
    }

    const { packageData, packageItems } = req.body;


    if (!packageData.packageId || !packageData.price) {
      return res.status(400).json({
        error: "Package data must include packageId and price",
        status: false,
      });
    }

    if (packageItems.length === 0) {
      return res.status(400).json({
        error: "Package items array cannot be empty",
        status: false,
      });
    }


    for (const item of packageItems) {
      if (!item.productType || !item.productId || !item.qty || !item.price) {
        return res.status(400).json({
          error:
            "Each package item must have productType, productId, qty, and price",
          status: false,
        });
      }
    }

    try {

      const packageResult = await MarketPlaceDao.createDefinePackageDao(
        packageData,
        userId
      );
      const definePackageId = packageResult.insertId;


      const itemsResult = await MarketPlaceDao.createDefinePackageItemsDao(
        definePackageId,
        packageItems
      );

      res.status(201).json({
        message: "Package and items created successfully",
        packageId: definePackageId,
        itemsCreated: itemsResult.affectedRows,
        status: true,
      });
    } catch (err) {
      throw err;
    }
  } catch (err) {
    console.error("Error creating package with items:", err);
    return res.status(500).json({
      error:
        err.message || "An error occurred while creating package with items",
      status: false,
    });
  }
};

exports.getAllWholesaleCustomers = async (req, res) => {
  try {
    const { page, limit, searchText } =
      await MarketPriceValidate.getmarketplaceCustomerParamSchema.validateAsync(
        req.query
      );
    const offset = (page - 1) * limit;
    const { total, items } = await MarketPlaceDao.getAllWholesaleCustomersDao(
      limit,
      offset,
      searchText
    );

    return res.status(200).json({
      total,
      items,
    });
  } catch (err) {
    console.error("Error checking display name:", err);
    return res.status(500).json({
      error: "An error occurred while checking display name",
      status: false,
    });
  }
};

exports.getUserOrders = async (req, res) => {
  try {


    const userId = req.params.userId;
    const statusFilter = req.query.status || "Ordered";

    const userOrders = await MarketPlaceDao.getUserOrdersDao(
      parseInt(userId),
      statusFilter
    );

    const ordersByScheduleType = userOrders.reduce((acc, order) => {
      const scheduleType = order.sheduleType || "unscheduled";
      if (!acc[scheduleType]) {
        acc[scheduleType] = [];
      }
      acc[scheduleType].push(order);
      return acc;
    }, {});


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

exports.getCoupen = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);


    const validatedParams =
      await MarketPriceValidate.getCoupenValidation.validateAsync(req.params);
    const coupenId = validatedParams.coupenId;




    const result = await MarketPlaceDao.getCoupenDAO(coupenId);

    return res.status(201).json({
      message: "coupen created successfully",
      result: result,
      status: true,
    });
  } catch (err) {
    if (err.isJoi) {

      return res
        .status(400)
        .json({ error: err.details[0].message, status: false });
    }

    console.error("Error executing query:", err);
    return res.status(500).json({
      error: "An error occurred while creating marcket product",
      status: false,
    });
  }
};

exports.updateCoupen = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);


    const coupen =
      await MarketPriceValidate.updateCoupenValidation.validateAsync(req.body);


    const result = await MarketPlaceDao.updateCoupenDAO(coupen);

    return res.status(201).json({
      message: "coupen created successfully",
      result: result,
      status: true,
    });
  } catch (err) {
    if (err.isJoi) {

      return res
        .status(400)
        .json({ error: err.details[0].message, status: false });
    }

    console.error("Error executing query:", err);
    return res.status(500).json({
      error: "An error occurred while creating marcket product",
      status: false,
    });
  }
};

exports.getInvoiceDetails = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const { processOrderId } = req.params;


    if (!processOrderId) {
      return res.status(400).json({
        success: false,
        error: "Process order ID is required",
      });
    }


    const invoiceDetails = await MarketPlaceDao.getInvoiceDetailsDAO(
      processOrderId
    );



    if (!invoiceDetails) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }


    const [familyPackItems, additionalItems, billingDetails] =
      await Promise.all([
        MarketPlaceDao.getFamilyPackItemsDAO(processOrderId),
        MarketPlaceDao.getAdditionalItemsDAO(invoiceDetails.orderId),
        MarketPlaceDao.getBillingDetailsDAO(invoiceDetails.orderId),
      ]);


    let pickupCenterDetails = null;
    let deliveryChargeDetails = null;

    if (invoiceDetails.deliveryMethod === "Pickup" && invoiceDetails.centerId) {
      pickupCenterDetails = await MarketPlaceDao.getPickupCenterDetailsDAO(
        invoiceDetails.centerId
      );
    } else if (
      invoiceDetails.deliveryMethod !== "Pickup" &&
      invoiceDetails.city
    ) {

      deliveryChargeDetails = await MarketPlaceDao.getDeliveryChargeByCityDAO(
        invoiceDetails.city
      );
    }


    const packageDetailsPromises = familyPackItems.map((item) =>
      MarketPlaceDao.getPackageDetailsDAO(item.packageId)
    );
    const packageDetails = await Promise.all(packageDetailsPromises);


    const familyPackItemsWithDetails = familyPackItems.map((item, index) => ({
      ...item,
      packageDetails: packageDetails[index],
    }));


    const response = {
      invoice: invoiceDetails,
      items: {
        familyPacks: familyPackItemsWithDetails,
        additionalItems: additionalItems,
      },
      billing: billingDetails,
      pickupCenter: pickupCenterDetails,
      deliveryCharge: deliveryChargeDetails,
    };


    return res.status(200).json({
      success: true,
      message: "Invoice details retrieved successfully",
      data: response,
    });
  } catch (error) {
    if (error.isJoi) {

      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    console.error("Error fetching invoice details:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred while fetching invoice details",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getAllWholesaleOrders = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { page, limit, status, method, searchItem, formattedDate } =
      await MarketPriceValidate.getAllRetailOrderSchema.validateAsync(
        req.query
      );

    const offset = (page - 1) * limit;

    const { total, items } = await MarketPlaceDao.getAllWholesaleOrderDetails(
      limit,
      offset,
      status,
      method,
      searchItem,
      formattedDate
    );


    res.json({
      items,
      total,
    });
  } catch (err) {
    if (err.isJoi) {

      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.getMarketplacePackageBeforeDate = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);


    const { id } = await MarketPriceValidate.IdparamsSchema.validateAsync(
      req.params
    );


    const { date } = req.query;
    if (!date) {
      return res.status(400).json({
        success: false,
        error: "Missing required query parameter: date",
      });
    }


    const packageData =
      await MarketPlaceDao.getMarketplacePackageByIdWithDetailsDAO(id);


    const definePackageData =
      await MarketPlaceDao.getDefinePackageItemsBeforeDateDAO(id, date);


    const baseTotal =
      packageData.productPrice +
      packageData.packingFee +
      packageData.serviceFee;


    const productsTotal = packageData.packageDetails.reduce((sum, item) => {
      return sum + (item.productType?.price || 0) * item.qty;
    }, 0);


    const grandTotal = baseTotal + productsTotal + definePackageData.totalPrice;


    const formattedResponse = {
      ...packageData,
      definePackage: {
        createdAt: definePackageData.createdAt,
        items: definePackageData.items,
        totalPrice: definePackageData.totalPrice,
      },
      pricingSummary: {
        basePrice: packageData.productPrice,
        packingFee: packageData.packingFee,
        serviceFee: packageData.serviceFee,
        productsTotal,
        definePackageTotal: definePackageData.totalPrice,
        grandTotal,
      },
      packageDetails: packageData.packageDetails.map((detail) => ({
        ...detail,
        totalPrice: (detail.productType?.price || 0) * detail.qty,
      })),
    };

    res.status(200).json({
      success: true,
      message: `Marketplace package as of or before ${date} retrieved successfully`,
      data: formattedResponse,
    });


  } catch (error) {
    console.error("Error fetching package on or before date:", error.message);

    if (error.message === "Package not found") {
      return res.status(404).json({ success: false, error: error.message });
    }

    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    res.status(500).json({
      success: false,
      error: "An internal server error occurred",
    });
  }
};

exports.marketDashbordDetails = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {

    const todaySalses = await MarketPlaceDao.toDaySalesDao();
    const yesterdaySalses = await MarketPlaceDao.yesterdaySalesDao();
    const thisMonthSales = await MarketPlaceDao.thisMonthSalesDao();
    const newUserCount = await MarketPlaceDao.toDayUserCountDao(true);


    const salsesAnalize = await MarketPlaceDao.salesAnalyzeDao();
    const totalSales = await MarketPlaceDao.totalMarketOrderCountDao();
    const totUsers = await MarketPlaceDao.toDayUserCountDao(false);

    const areaData = await MarketPlaceDao.areaOrderDataDao();
    const pieData = await MarketPlaceDao.pieDataDao();
    const orders = await MarketPlaceDao.lastFiveOrdersDao();

    res.json({
      message: "Data found!",
      firstRow: {
        todaySalses,
        yesterdaySalses,
        thisMonthSales,
        newUserCount,
      },
      secondRow: {
        salsesAnalize,
        totalSales,
        totUsers,
      },
      areaData,
      pieData,
      orders,
    });
  } catch (err) {
    if (err.isJoi) {

      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};


exports.changePackageStatus = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);


    const data = await MarketPriceValidate.changePackageStatusValidation.validateAsync(req.body);


    const result = await MarketPlaceDao.changePackageStatusDao(data);
    if (result.affectedRows === 0) {
      return res.json({
        message: "Package Status change failed",
        status: false,
      });
    }

    return res.status(201).json({
      message: "Package Status change successfully",
      status: true,
    });
  } catch (err) {
    if (err.isJoi) {

      return res
        .status(400)
        .json({ error: err.details[0].message, status: false });
    }

    console.error("Error executing query:", err);
    return res.status(500).json({
      error: "An error occurred while creating marcket product",
      status: false,
    });
  }
};

exports.getPostInvoiceDetails = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const { processOrderId } = req.params;

    if (!processOrderId) {
      return res.status(400).json({
        success: false,
        error: "Process order ID is required",
      });
    }

    const invoiceDetails = await MarketPlaceDao.getInvoiceDetailsDAO(
      processOrderId
    );

    if (!invoiceDetails) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    const [familyPackItems, additionalItems, billingDetails] =
      await Promise.all([
        MarketPlaceDao.getFamilyPackItemsDAO(processOrderId),
        MarketPlaceDao.getAdditionalItemsDAO(invoiceDetails.orderId),
        MarketPlaceDao.getBillingDetailsDAO(invoiceDetails.orderId),
      ]);

    let pickupCenterDetails = null;
    let deliveryChargeDetails = null;

    if (invoiceDetails.deliveryMethod === "Pickup" && invoiceDetails.centerId) {
      pickupCenterDetails = await MarketPlaceDao.getPickupCenterDetailsDAO(
        invoiceDetails.centerId
      );
    } else if (
      invoiceDetails.deliveryMethod !== "Pickup" &&
      invoiceDetails.city
    ) {
      deliveryChargeDetails = await MarketPlaceDao.getDeliveryChargeByCityDAO(
        invoiceDetails.city
      );
    }

    // Get package details for each family pack item
    const packageDetailsPromises = familyPackItems.map((item) =>
      MarketPlaceDao.getPosPackageDetailsDAO(processOrderId) // Use processOrderId instead of item.packageId
    );
    const packageDetailsResults = await Promise.all(packageDetailsPromises);

    // Map family pack items with their corresponding package details
    const familyPackItemsWithDetails = familyPackItems.map((item, index) => {
      const packageDetail = packageDetailsResults[index] || [];
      
      // Find the specific package that matches the current item
      const matchedPackage = packageDetail.find(pkg => 
        pkg.packageName === item.name
      );

      return {
        id: item.id,
        packageId: item.packageId,
        name: item.name,
        amount: item.amount,
        packageDetails: matchedPackage ? matchedPackage.items : []
      };
    });

    const response = {
      invoice: invoiceDetails,
      items: {
        familyPacks: familyPackItemsWithDetails,
        additionalItems: additionalItems,
      },
      billing: billingDetails,
      pickupCenter: pickupCenterDetails,
      deliveryCharge: deliveryChargeDetails,
    };

    return res.status(200).json({
      success: true,
      message: "Invoice details retrieved successfully",
      data: response,
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    console.error("Error fetching invoice details:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred while fetching invoice details",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.manageSeo = async (req, res) => {
  try {
    
    const { id, pageName, slug, discription, keywords } = req.body;

    if (!pageName) {
      return res.status(400).json({
        message: "Page name is required",
        status: false,
      });
    }

    const result = await MarketPlaceDao.postManageSeoDao({
      id,
      pageName,
      slug,
      discription,
      keywords
    });

    return res.status(201).json({
      message: "SEO details saved successfully",
      status: true,
    });

  } catch (error) {
    console.error("Error saving SEO details:", error);
    return res.status(500).json({
      message: "An error occurred while saving SEO details",
      status: false,
    });
  }
}
