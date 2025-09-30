const GoviLinkDAO = require("../dao/GoviLink-dao");
const uploadFileToS3 = require("../middlewares/s3upload");
const GoviLinkValidation = require("../validations/GoviLink-validation");
const deleteFromS3 = require("../middlewares/s3delete");


exports.saveOfficerService = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const { englishName, tamilName, sinhalaName,  srvFee } = req.body;

    // Validation (basic check)
    if (!englishName || !tamilName || !sinhalaName) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Save data through DAO
    const result = await GoviLinkDAO.saveOfficerService(
      englishName,
      tamilName,
      sinhalaName,
      srvFee
    );

    console.log("Officer service saved successfully");
    res.status(201).json(result);
  } catch (err) {
    console.error("Error saving officer service:", err);
    res.status(500).json({ error: "An error occurred while saving data." });
  }
};