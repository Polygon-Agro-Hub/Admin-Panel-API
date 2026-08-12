const jwt = require("jsonwebtoken");
const db = require("../startup/database");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const cropCalendarDao = require("../dao/CropCalendar-dao");
const cropCalendarValidations = require("../validations/CropCalendar-validation");
const mime = require("mime-types");
const deleteFromS3 = require("../middlewares/s3delete");
const uploadFileToS3 = require("../middlewares/s3upload");

exports.allCropGroups = async (req, res) => {
  try {
    const groups = await cropCalendarDao.allCropGroups();
    res.json({
      groups,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.createCropGroup = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const {
      cropNameEnglish,
      cropNameSinhala,
      cropNameTamil,
      category,
      costFeild,
      incomeFeild,
      bgColor,
      seedRate,
      rowSpace,
      plantSpace,
      AvgYield,
      nitrogen,
      phosphorus,
      potassium,
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const checkCropName = await cropCalendarDao.checkCropGroup(cropNameEnglish);

    if (checkCropName.length > 0) {
      return res.json({
        message: "This crop name is already exist!",
        status: false,
      });
    }

    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;

    const profileImageUrl = await uploadFileToS3(
      fileBuffer,
      fileName,
      "cropgroup/image",
    );

    const newsId = await cropCalendarDao.createCropGroup(
      cropNameEnglish,
      cropNameSinhala,
      cropNameTamil,
      category,
      costFeild,
      incomeFeild,
      profileImageUrl,
      bgColor,
      seedRate,
      rowSpace,
      plantSpace,
      AvgYield,
      nitrogen,
      phosphorus,
      potassium,
    );
    return res.status(201).json({
      message: "Crop group has been created successfully",
      id: newsId,
      status: true,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while creating crop group" });
  }
};
exports.checkDuplicateCropCalendar = async (req, res) => {
  try {
    const { varietyId, cultivationMethod, natureOfCultivation, excludeId } =
      req.query;

    if (!cultivationMethod || !natureOfCultivation) {
      return res.status(400).json({
        error:
          "Missing required query parameters: cultivationMethod and natureOfCultivation are required.",
      });
    }

    const normalizedVarietyId = varietyId ? varietyId.trim() : null;
    const normalizedCultivationMethod = cultivationMethod.trim().toLowerCase();
    const normalizedNatureOfCultivation = natureOfCultivation
      .trim()
      .toLowerCase();
    const parsedExcludeId = excludeId ? parseInt(excludeId) : undefined;

    const checkExist = await cropCalendarDao.checkExistanceCropCalander(
      normalizedVarietyId,
      normalizedCultivationMethod,
      normalizedNatureOfCultivation,
      parsedExcludeId,
    );

    if (checkExist.length > 0) {
      return res.json({
        message: "This crop calendar already exists!",
        status: false,
        exists: true,
      });
    } else {
      return res.json({
        message: "No duplicate found.",
        status: true,
        exists: false,
      });
    }
  } catch (err) {
    console.error("Error checking duplicate crop calendar:", err);
    return res.status(500).json({
      error: "An error occurred while checking duplicate crop calendar.",
    });
  }
};
exports.getAllCropGroups = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const { page, limit, searchText, category } =
      await cropCalendarValidations.getAllCropGroupsSchema.validateAsync(
        req.query,
      );

    const offset = (page - 1) * limit;

    const { total, items } = await cropCalendarDao.getAllCropGroups(
      limit,
      offset,
      searchText,
      category,
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

exports.deleteCropGroup = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const { id } =
      await cropCalendarValidations.deleteCropCalenderSchema.validateAsync(
        req.params,
      );

    const cropGroup = await cropCalendarDao.getGroupByIds3(id);
    if (!cropGroup) {
      return res.status(404).json({ message: "PlantCare User not found" });
    }

    const imageUrl = cropGroup.image;
    if (imageUrl) {
      try {
        await deleteFromS3(imageUrl);
      } catch (s3Error) {
        console.error("Failed to delete image from S3:", s3Error);
      }
    }

    const affectedRows = await cropCalendarDao.deleteCropGroup(id);

    if (affectedRows === 0) {
      return res.status(404).json({ message: "Crop group not found" });
    } else {
      return res.status(200).json({ status: true });
    }
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error deleting crop group:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting crop group" });
  }
};

exports.createCropVariety = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const {
      groupId,
      varietyNameEnglish,
      varietyNameSinhala,
      varietyNameTamil,
      descriptionEnglish,
      descriptionSinhala,
      descriptionTamil,
      bgColor,
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const checkCropVerityName = await cropCalendarDao.checkCropVerity(
      groupId,
      varietyNameEnglish,
    );

    if (checkCropVerityName.length > 0) {
      return res.json({
        message: "This crop verity name is already exist!",
        status: false,
      });
    }

    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;

    const image = await uploadFileToS3(
      fileBuffer,
      fileName,
      "cropvariety/image",
    );

    const newsId = await cropCalendarDao.createCropVariety(
      groupId,
      varietyNameEnglish,
      varietyNameSinhala,
      varietyNameTamil,
      descriptionEnglish,
      descriptionSinhala,
      descriptionTamil,
      image,
      bgColor,
    );
    return res.status(201).json({
      message: "crop variety created successfully",
      id: newsId,
      status: true,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while creating crop variety" });
  }
};

exports.allCropVariety = async (req, res) => {
  try {
    const cropGroupId = req.params.cropGroupId;

    const varieties = await cropCalendarDao.allCropVariety(cropGroupId);
    res.json({
      varieties,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.createCropCallender = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const {
      varietyId,
      cultivationMethod,
      natureOfCultivation,
      cropDuration,
      suitableAreas,
      specialNotes,
    } = req.body;

    const checkExist = await cropCalendarDao.checkExistanceCropCalander(
      varietyId,
      cultivationMethod,
      natureOfCultivation,
    );
    if (checkExist.length > 0) {
      return res.json({
        message: "This crop calander already exist !",
        status: false,
      });
    }

    const cropId = await cropCalendarDao.createCropCallender(
      varietyId,
      cultivationMethod,
      natureOfCultivation,
      cropDuration,
      suitableAreas,
      specialNotes,
    );
    return res.status(200).json({ cropId, status: true });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error executing query:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while creating Crop Calendar" });
  }
};

exports.uploadXLSX = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const { id } = req.params;

    await cropCalendarValidations.uploadXLSXSchema.validateAsync({ id });

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const allowedExtensions = [".xlsx", ".xls"];
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({
        error: "Invalid file type. Only XLSX and XLS files are allowed.",
      });
    }

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

    const rowsAffected = await cropCalendarDao.insertXLSXData(id, data);

    return res.status(200).json({
      message: "File uploaded and data inserted successfully",
      rowsAffected,
    });
  } catch (error) {
    try {
      await cropCalendarDao.deleteCropCalender(req.params.id);
    } catch (deleteErr) {
      console.error("Failed to rollback crop calendar record:", deleteErr);
    }

    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }
    console.error("Error processing XLSX file:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while processing the XLSX file." });
  }
};

exports.getAllVarietyByGroup = async (req, res) => {
  try {
    const cropGroupId = req.params.cropGroupId;
    const groups = await cropCalendarDao.getAllVarietyByGroup(cropGroupId);
    res.json({
      groups,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.deleteCropVariety = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const { id } =
      await cropCalendarValidations.deleteCropCalenderSchema.validateAsync(
        req.params,
      );

    const cropVariety = await cropCalendarDao.getVarietyByIds3(id);

    const imageUrl = cropVariety.image;

    await deleteFromS3(imageUrl);

    const affectedRows = await cropCalendarDao.deleteCropVariety(id);

    if (affectedRows === 0) {
      return res.status(404).json({ message: "Crop variety not found" });
    } else {
      return res.status(200).json({ status: true });
    }
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error deleting crop variety:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting crop variety" });
  }
};

exports.getGroupById = async (req, res) => {
  try {
    const id = req.params.id;
    const groups = await cropCalendarDao.getGroupById(id);
    res.json({
      groups,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.getVarietyById = async (req, res) => {
  try {
    const id = req.params.id;
    const groups = await cropCalendarDao.getVarietyById(id);
    res.json({
      groups,
    });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.updateGroup = async (req, res) => {
  const {
    cropNameEnglish,
    cropNameSinhala,
    cropNameTamil,
    category,
    costFeild,
    incomeFeild,
    bgColor,
    seedRate,
    rowSpace,
    plantSpace,
    AvgYield,
    nitrogen,
    phosphorus,
    potassium,
  } = req.body;

  const id = req.params.id;
  const Existname = req.params.name;
  let image = null;

  try {
    const cropGroup = await cropCalendarDao.getGroupByIds3(id);
    if (!cropGroup) {
      return res.status(404).json({ message: "Crop group not found" });
    }

    const imageUrl = cropGroup.image;

    if (Existname !== cropNameEnglish) {
      const checkCropName =
        await cropCalendarDao.checkCropGroup(cropNameEnglish);

      if (checkCropName.length > 0) {
        return res.json({
          message: "This crop name is already exist!",
          status: false,
        });
      }
    }

    if (req.file) {
      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;
      await deleteFromS3(imageUrl);
      image = await uploadFileToS3(fileBuffer, fileName, "cropgroup/image");
    }

    await cropCalendarDao.updateGroup(
      {
        cropNameEnglish,
        cropNameSinhala,
        cropNameTamil,
        category,
        costFeild,
        incomeFeild,
        bgColor,
        image,
        seedRate,
        rowSpace,
        plantSpace,
        AvgYield,
        nitrogen,
        phosphorus,
        potassium,
      },
      id,
    );

    res.json({ message: "Crop group updated successfully.", status: true });
  } catch (err) {
    console.error("Error updating crop group:", err);
    res.status(500).send("An error occurred while updating the crop group.");
  }
};

exports.updateCropVariety = async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    let image = null;

    const cropVariety = await cropCalendarDao.getVarietyByIds3(id);

    const imageUrl = cropVariety.image;

    if (req.file) {
      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;
      await deleteFromS3(imageUrl);
      image = await uploadFileToS3(fileBuffer, fileName, "cropvariety/image");
      updates.image = image;
    }

    await cropCalendarDao.updateCropVariety(id, updates);
    res.json({ message: "Crop variety updated successfully." });
  } catch (err) {
    console.error("Error updating crop variety:", err);
    res.status(500).send("An error occurred while updating the crop variety.");
  }
};

exports.getAllCropCalender = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const { page, limit, searchText, category } =
      await cropCalendarValidations.getAllCropCalendarSchema.validateAsync(
        req.query,
      );
    const offset = (page - 1) * limit;

    const { total, items } = await cropCalendarDao.getAllCropCalendars(
      limit,
      offset,
      searchText,
      category,
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

exports.editCropCalender = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  try {
    const updateData = req.body;
    const { id } = req.params;

    const affectedRows = await cropCalendarDao.updateCropCalender(
      id,
      updateData,
    );

    if (affectedRows === 0) {
      return res.status(404).json({ message: "Crop Calendar not found" });
    } else {
      return res
        .status(200)
        .json({ message: "Crop Calendar updated successfully" });
    }
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error updating crop calendar:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while updating the crop calendar" });
  }
};

exports.deleteCropCalender = async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const { id } =
      await cropCalendarValidations.deleteCropCalenderSchema.validateAsync(
        req.params,
      );

    const affectedRows = await cropCalendarDao.deleteCropCalender(id);

    if (affectedRows === 0) {
      return res.status(404).json({ message: "Crop Calendar not found" });
    } else {
      return res.status(200).json({ status: true });
    }
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error deleting crop calendar:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting crop calendar" });
  }
};

exports.getAllTaskByCropId = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  const { page, limit } = req.query;

  const offset = (page - 1) * limit;

  try {
    const validatedParams =
      await cropCalendarValidations.getAllTaskByCropIdSchema.validateAsync(
        req.params,
      );

    const { total, results } = await cropCalendarDao.getAllTaskByCropId(
      validatedParams.id,
      limit,
      offset,
    );
    res.json({ results, total });
  } catch (error) {
    console.error("Error fetching tasks for crop ID:", error);
    return res.status(500).json({
      error: "An error occurred while fetching tasks for the crop ID",
    });
  }
};

exports.updateVariety = async (req, res) => {
  const {
    varietyNameEnglish,
    varietyNameSinhala,
    varietyNameTamil,
    descriptionEnglish,
    descriptionSinhala,
    descriptionTamil,
    bgColor,
  } = req.body;
  const id = req.params.id;
  try {
    let imageData = null;
    if (req.file) {
      imageData = req.file.buffer;
    }

    await cropCalendarDao.updateVariety(
      {
        varietyNameEnglish,
        varietyNameSinhala,
        varietyNameTamil,
        descriptionEnglish,
        descriptionSinhala,
        descriptionTamil,
        bgColor,
        image: imageData,
      },
      id,
    );
    res.json({ message: "Crop group updated successfully." });
  } catch (err) {
    console.error("Error updating crop group:", err);
    res.status(500).send("An error occurred while updating the crop group.");
  }
};

exports.getCropGroupsForFilter = async (req, res) => {
  try {
    const crop = await cropCalendarDao.cropGroupsDao();

    res.json({ items: crop });
  } catch (err) {
    console.error("Error updating crop variety:", err);
    res.status(500).send("An error occurred while updating the crop variety.");
  }
};

exports.getAllCropGroupNamesOnly = async (req, res) => {
  try {
    const cropGroups = await cropCalendarDao.getAllCropGroupEnglishNamesOnly();
    res.json(cropGroups);
  } catch (err) {
    console.error("Error fetching crop group names:", err);
    res.status(500).send("An error occurred while fetching crop group names.");
  }
};
