const jwt = require("jsonwebtoken");
const db = require("../startup/database");
const bodyParser = require("body-parser");
const fs = require("fs");
const xlsx = require("xlsx");
const collectionofficerDao = require("../dao/CollectionOfficer-dao");
const collectionofficerValidate = require("../validations/CollectionOfficer-validation");
const bcrypt = require("bcryptjs");

const { v4: uuidv4 } = require("uuid");
const uploadFileToS3 = require("../middlewares/s3upload");
const deleteFromS3 = require("../middlewares/s3delete");

// const s3 = new AWS.S3({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   region: process.env.AWS_REGION,
// });

// exports.createCollectionOfficer = async (req, res) => {
//     const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
//     console.log(fullUrl);

//     try {

//         const officerData = JSON.parse(req.body.officerData);

//         if (req.body.file) {
//             console.log('image recieved');
//            }

//         const isExistingNIC = await collectionofficerDao.checkNICExist(
//             officerData.nic
//         );

//         const isExistingEmail = await collectionofficerDao.checkEmailExist(
//             officerData.email
//         );

//         if (isExistingNIC) {
//             return res.status(500).json({
//                 error: "NIC already exists"
//             });
//         }

//         if (isExistingEmail) {
//             return res.status(500).json({
//                 error: "email already exists"
//             });
//         }

//         let profileImageUrl = null;
//         // Ensure a file is uploaded
//     if (req.body.file) {
//         const base64String = req.body.file.split(",")[1]; // Extract the Base64 content
//         const mimeType = req.body.file.match(/data:(.*?);base64,/)[1]; // Extract MIME type
//         const fileBuffer = Buffer.from(base64String, "base64"); // Decode Base64 to buffer

//         const fileExtension = mimeType.split("/")[1]; // Extract file extension from MIME type
//         const fileName = `${officerData.firstNameEnglish}_${officerData.lastNameEnglish}.${fileExtension}`;

//          profileImageUrl = await uploadFileToS3(fileBuffer, fileName, "collectionofficer/image");
//       }

//         const resultsPersonal = await collectionofficerDao.createCollectionOfficerPersonal(officerData, profileImageUrl);

//         console.log("Collection Officer created successfully");
//         return res.status(201).json({ message: "Collection Officer created successfully", id: resultsPersonal.insertId, status:true });
//     } catch (error) {
//         if (error.isJoi) {
//             // Handle validation error
//             return res.status(400).json({ error: error.details[0].message });
//         }

//         console.error("Error creating collection officer:", error);
//         return res.status(500).json({ error: "An error occurred while creating the collection officer" });
//     }
// };

exports.createCollectionOfficer = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const officerData = JSON.parse(req.body.officerData);

    const isExistingNIC = await collectionofficerDao.checkNICExist(
      officerData.nic
    );
    const isExistingEmail = await collectionofficerDao.checkEmailExist(
      officerData.email
    );

    if (isExistingNIC) {
      return res.status(500).json({
        error: "NIC already exists",
      });
    }

    if (isExistingEmail) {
      return res.status(500).json({
        error: "Email already exists",
      });
    }


    const isExistingPhoneNumber01 = await collectionofficerDao.checkPhoneNumberExist(officerData.phoneNumber01);
    if (isExistingPhoneNumber01) {
      return res.status(500).json({
        error: "Primary phone number already exists",
      });
    }

    if (officerData.phoneNumber02) {
      const isExistingPhoneNumber02 = await collectionofficerDao.checkPhoneNumberExist(officerData.phoneNumber02);
      if (isExistingPhoneNumber02) {
        return res.status(500).json({
          error: "Secondary phone number already exists",
        });
      }
    }

    let profileImageUrl = null; // Default to null if no image is provided
    const lastId = await collectionofficerDao.getCCIDforCreateEmpIdDao(officerData.jobRole);
    console.log("LastId",lastId);
    

    // Check if an image file is provided
    if (req.body.file) {
      try {
        const base64String = req.body.file.split(",")[1]; // Extract the Base64 content
        const mimeType = req.body.file.match(/data:(.*?);base64,/)[1]; // Extract MIME type
        const fileBuffer = Buffer.from(base64String, "base64"); // Decode Base64 to buffer

        const fileExtension = mimeType.split("/")[1]; // Extract file extension from MIME type
        const fileName = `${officerData.firstNameEnglish}_${officerData.lastNameEnglish}.${fileExtension}`;

        // Upload image to S3
        profileImageUrl = await uploadFileToS3(
          fileBuffer,
          fileName,
          "collectionofficer/image"
        );
      } catch (err) {
        console.error("Error processing image file:", err);
        return res
          .status(400)
          .json({ error: "Invalid file format or file upload error" });
      }
    }

    // Save officer data (without image if no image is uploaded)
    const resultsPersonal =
      await collectionofficerDao.createCollectionOfficerPersonal(
        officerData,
        profileImageUrl,
        lastId
      );

    console.log("Collection Officer created successfully");
    return res.status(201).json({
      message: "Collection Officer created successfully",
      id: resultsPersonal.insertId,
      status: true,
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error creating collection officer:", error);
    return res.status(500).json({
      error: "An error occurred while creating the collection officer",
    });
  }
};

//get all collection officer
exports.getAllCollectionOfficers = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    // Validate query parameters
    const validatedQuery =
      await collectionofficerValidate.getAllCollectionOfficersSchema.validateAsync(
        req.query
      );

    const { page, limit, centerStatus, status, nic, company, role, centerId } = validatedQuery;

    console.log(centerStatus, status)

    // Call the DAO to get all collection officers
    const result = await collectionofficerDao.getAllCollectionOfficers(
      page,
      limit,
      nic,
      company,
      role,
      centerStatus,
      status,
      centerId
    );

    console.log(result);

    console.log("Successfully fetched collection officers");
    return res.status(200).json(result);
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};

// exports.getAllCollectionOfficersStatus = async (req, res) => {
//   const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
//   console.log(fullUrl);

//   try {
//     // Validate query parameters
//     const validatedQuery =
//       await collectionofficerValidate.getAllCollectionOfficersSchema.validateAsync(
//         req.query
//       );

//     const { page, limit, nic, company } = validatedQuery;

//     // Call the DAO to get all collection officers
//     const result = await collectionofficerDao.getAllCollectionOfficersStatus(
//       page,
//       limit,
//       nic,
//       company
//     );

//     console.log("Successfully fetched collection officers");
//     return res.status(200).json(result);
//   } catch (error) {
//     if (error.isJoi) {
//       // Handle validation error
//       return res.status(400).json({ error: error.details[0].message });
//     }

//     console.error("Error fetching collection officers:", error);
//     return res
//       .status(500)
//       .json({ error: "An error occurred while fetching collection officers" });
//   }
// };

exports.getAllCollectionOfficersStatus = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    // Validate query parameters
    const validatedQuery =
      await collectionofficerValidate.getAllCollectionOfficersSchema.validateAsync(
        req.query
      );

    const { page, limit, nic, centerName } = validatedQuery;
    console.log("------------------");
    console.log(centerName);
    console.log("------------------");

    
    

    // Call the DAO to get all collection officers
    const result = await collectionofficerDao.getAllCollectionOfficersStatus(
      page,
      limit,
      nic,
      centerName
    );

    console.log("Successfully fetched collection officers");
    return res.status(200).json(result);
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};

exports.getCollectionOfficerReports = async (req, res) => {
  const { id: collectionOfficerId, date } = req.params;

  try {
    // Validate the request parameters
    await collectionofficerValidate.getCollectionOfficerReportsSchema.validateAsync(
      { id: collectionOfficerId, date }
    );

    // DAO to fetch `registeredfarmerpayments` IDs
    const registeredFarmerPayments =
      await collectionofficerDao.getRegisteredFarmerPaymentsByOfficer(
        collectionOfficerId,
        date
      );

    // if (!registeredFarmerPayments.length) {
    //     return res.status(404).json({ error: "No registered farmer payments found for the specified officer and date." });
    // }

    // Fetch the details for each `registeredFarmerId` from `farmerpaymentscrops`
    const farmerPaymentsCrops = await Promise.all(
      registeredFarmerPayments.map((payment) =>
        collectionofficerDao.getFarmerPaymentsCropsByRegisteredFarmerId(
          payment.id
        )
      )
    );

    // Flatten the results into one array
    const cropsDetails = farmerPaymentsCrops.flat();

    // Group data by cropName and quality
    const groupedData = {};
    cropsDetails.forEach((row) => {
      const {
        varietyNameEnglish,
        totalQuantity,
        gradeAquan,
        gradeBquan,
        gradeCquan,
      } = row;

      if (!groupedData[varietyNameEnglish]) {
        groupedData[varietyNameEnglish] = {
          "Grade A": 0,
          "Grade B": 0,
          "Grade C": 0,
          Total: 0,
        };
      }

      // groupedData[varietyNameEnglish][quality] = parseFloat(totalQuantity) || 0;
      groupedData[varietyNameEnglish]["Grade A"] += parseFloat(gradeAquan) || 0;
      groupedData[varietyNameEnglish]["Grade B"] += parseFloat(gradeBquan) || 0;
      groupedData[varietyNameEnglish]["Grade C"] += parseFloat(gradeCquan) || 0;
      groupedData[varietyNameEnglish]["Total"] +=
        parseFloat(totalQuantity) || 0;
    });

    return res.json(groupedData);
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching collection officer reports:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching reports" });
  }
};

exports.getCollectionOfficerDistrictReports = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    // Validate request parameters (district)
    const validatedParams =
      await collectionofficerValidate.getDistrictReportsSchema.validateAsync(
        req.params
      );

    // Fetch the data from the DAO
    const results =
      await collectionofficerDao.getCollectionOfficerDistrictReports(
        validatedParams.district
      );

    console.log("Successfully retrieved reports");
    res.status(200).json(results);
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error retrieving district reports:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the reports" });
  }
};

exports.getCollectionOfficerProvinceReports = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const validatedParams =
      await collectionofficerValidate.getDistrictProvinceSchema.validateAsync(
        req.params
      );

    const results =
      await collectionofficerDao.getCollectionOfficerProvinceReports(
        validatedParams.province
      );

    console.log("Successfully retrieved reports");
    res.status(200).json(results);
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error retrieving district reports:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the reports" });
  }
};

exports.getAllCompanyNames = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const results = await collectionofficerDao.getAllCompanyNamesDao();

    console.log("Successfully retrieved reports");
    res.status(200).json(results);
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error retrieving district reports:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the reports" });
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
    const officerData = await collectionofficerDao.getCollectionOfficerEmailDao(
      id
    );
    if (!officerData) {
      return res
        .status(404)
        .json({ message: "Collection officer not found.", status: false });
    }

    // Destructure email, firstNameEnglish, and empId from fetched data
    const { email, firstNameEnglish, empId } = officerData;
    console.log(`Email: ${email}, Name: ${firstNameEnglish}, Emp ID: ${empId}`);

    // Generate a new random password
    const generatedPassword = Math.random().toString(36).slice(-8); // Example: 8-character random password

    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    // Update status and password in the database
    const updateResult =
      await collectionofficerDao.UpdateCollectionOfficerStatusAndPasswordDao({
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

    // If status is 'Approved', send the password email
    if (status === "Approved") {
      const emailResult = await collectionofficerDao.SendGeneratedPasswordDao(
        email,
        generatedPassword,
        empId,
        firstNameEnglish
      );

      if (!emailResult.success) {
        return res.status(500).json({
          message: "Failed to send password email.",
          error: emailResult.error,
        });
      }
    }

    // Return success response with empId and email
    res.status(200).json({
      message: "Status updated and password sent successfully.",
      status: true,
      data: {
        empId, // Include empId for reference
        email, // Include the email sent to
      },
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "An error occurred.", error });
  }
};

exports.deleteCollectionOfficer = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { id } = req.params;

    const qrimage = await collectionofficerDao.getQrImage(id);

    const qrUrl = qrimage.QRcode;
    const imageUrl = qrimage.image;

    console.log(qrUrl);

    if (qrUrl) {
      try {
        await deleteFromS3(qrUrl);
      } catch (s3Error) {
        console.error("Failed to delete image from S3:", s3Error);
      }
    }

    if (imageUrl) {
      try {
        await deleteFromS3(imageUrl);
      } catch (s3Error) {
        console.error("Failed to delete image from S3:", s3Error);
      }
    }

    const results = await collectionofficerDao.DeleteCollectionOfficerDao(
      req.params.id
    );

    console.log("Successfully Delete Status");
    if (results.affectedRows > 0) {
      res.status(200).json({ results: results, status: true });
    } else {
      res.json({ results: results, status: false });
    }
  } catch (error) {
    if (error.isJoi) {
      return res
        .status(400)
        .json({ error: error.details[0].message, status: false });
    }

    console.error("Error retrieving Updated Status:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while Updated Statuss" });
  }
};

exports.getOfficerById = async (req, res) => {
  try {
    const id = req.params.id;
    const officerData = await collectionofficerDao.getOfficerById(id);

    if (!officerData) {
      return res.status(404).json({ error: "Collection Officer not found" });
    }

    console.log(
      "Successfully fetched collection officer, company, and bank details"
    );
    res.json({ officerData });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.updateCollectionOfficerDetails = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  const { id } = req.params;

  try {
    const officerData = JSON.parse(req.body.officerData);
    console.log('officer data',officerData)
    const qrCode = await collectionofficerDao.getQrImage(id);

    const isExistingNIC = await collectionofficerDao.checkNICExist(officerData.nic, id);
    if (isExistingNIC) {
      return res.status(400).json({ error: "NIC already exists" });
    }

    const isExistingEmail = await collectionofficerDao.checkEmailExist(officerData.email, id);
    if (isExistingEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const isExistingPhoneNumber01 = await collectionofficerDao.checkPhoneNumberExist(officerData.phoneNumber01, id);
    if (isExistingPhoneNumber01) {
      return res.status(400).json({ error: "Primary phone number already exists" });
    }

    if (officerData.phoneNumber02) {
      const isExistingPhoneNumber02 = await collectionofficerDao.checkPhoneNumberExist(officerData.phoneNumber02, id);
      if (isExistingPhoneNumber02) {
        return res.status(400).json({ error: "Secondary phone number already exists" });
      }
    }

    let profileImageUrl = null;

    if (req.body.file) {
      console.log("Received");
      // Delete existing QR code or profile image from S3 if it exists
      if (qrCode.image) {
        await deleteFromS3(qrCode.image);
      }

      const base64String = req.body.file.split(",")[1]; // Extract the Base64 content
      const mimeType = req.body.file.match(/data:(.*?);base64,/)[1]; // Extract MIME type
      const fileBuffer = Buffer.from(base64String, "base64"); // Decode Base64 to buffer

      const fileExtension = mimeType.split("/")[1]; // Extract file extension from MIME type
      const fileName = `${officerData.firstNameEnglish}_${officerData.lastNameEnglish}.${fileExtension}`;

      profileImageUrl = await uploadFileToS3(
        fileBuffer,
        fileName,
        "collectionofficer/image"
      );
    } else {
      profileImageUrl = qrCode.image; // Retain existing image if no new file is provided
    }

    const {
      centerId,
      companyId,
      irmId,
      firstNameEnglish,
      lastNameEnglish,
      firstNameSinhala,
      lastNameSinhala,
      firstNameTamil,
      lastNameTamil,
      jobRole,
      empId,
      empType,
      phoneCode01,
      phoneNumber01,
      phoneCode02,
      phoneNumber02,
      nic,
      email,
      houseNumber,
      streetName,
      city,
      district,
      province,
      country,
      languages,
      accHolderName,
      accNumber,
      bankName,
      branchName,
    } = officerData;
    console.log(empId);

    await collectionofficerDao.updateOfficerDetails(
      id,
      centerId,
      companyId,
      irmId,
      firstNameEnglish,
      lastNameEnglish,
      firstNameSinhala,
      lastNameSinhala,
      firstNameTamil,
      lastNameTamil,
      jobRole,
      empId,
      empType,
      phoneCode01,
      phoneNumber01,
      phoneCode02,
      phoneNumber02,
      nic,
      email,
      houseNumber,
      streetName,
      city,
      district,
      province,
      country,
      languages,
      accHolderName,
      accNumber,
      bankName,
      branchName,
      profileImageUrl
    );

    res.json({ message: "Collection officer details updated successfully" });
  } catch (err) {
    console.error("Error updating collection officer details:", err);
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    res.status(500).json({ error: "Failed to update collection officer details" });
  }
};

exports.getOfficerByIdMonthly = async (req, res) => {
  try {
    const id = req.params.id;
    const officerData = await collectionofficerDao.getOfficerByIdMonthly(id);

    if (!officerData) {
      return res.status(404).json({ error: "Collection Officer not found" });
    }

    console.log(
      "Successfully fetched collection officer, company, and bank details"
    );
    res.json({ officerData });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

// Controller to handle the logic for fetching the daily report
exports.getDailyReport = async (req, res) => {
  try {
    const { collectionOfficerId, fromDate, toDate } = req.query;

    // Validate and format the inputs
    const { error } = collectionofficerValidate.getDailyReportSchema.validate({
      collectionOfficerId,
      fromDate,
      toDate,
    });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Call the DAO to fetch the required data
    const reportData = await collectionofficerDao.getDailyReport(
      collectionOfficerId,
      fromDate,
      toDate
    );

    // Return the data
    res.json(reportData);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};

exports.getCollectionOfficerById = async (req, res) => {
  try {
    const id = req.params.id;
    const officerData = await collectionofficerDao.getOfficerByIdDAO(id);

    if (!officerData) {
      return res.status(404).json({ error: "Collection Officer not found" });
    }

    console.log(
      "Successfully fetched collection officer, company, and bank details"
    );
    res.json({ officerData });
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).json({ error: err.details[0].message });
    }
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.disclaimOfficer = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(id);

    const result = await collectionofficerDao.disclaimOfficerDetailsDao(id);

    res.json({ message: "Collection officer details updated successfully" });
  } catch (err) {
    console.error("Error updating collection officer details:", err);
    res
      .status(500)
      .json({ error: "Failed to update collection officer details" });
  }
};

exports.createCenterHead = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const officerData = JSON.parse(req.body.officerData);

    const isExistingNIC = await collectionofficerDao.checkNICExist(
      officerData.nic
    );
    const isExistingEmail = await collectionofficerDao.checkEmailExist(
      officerData.email
    );

    if (isExistingNIC) {
      return res.status(500).json({
        error: "NIC already exists",
      });
    }

    if (isExistingEmail) {
      return res.status(500).json({
        error: "Email already exists",
      });
    }

    let profileImageUrl = null; // Default to null if no image is provided

    // Check if an image file is provided
    if (req.body.file) {
      try {
        const base64String = req.body.file.split(",")[1]; // Extract the Base64 content
        const mimeType = req.body.file.match(/data:(.*?);base64,/)[1]; // Extract MIME type
        const fileBuffer = Buffer.from(base64String, "base64"); // Decode Base64 to buffer

        

        const fileExtension = mimeType.split("/")[1]; // Extract file extension from MIME type
        const fileName = `${officerData.firstNameEnglish}_${officerData.lastNameEnglish}.${fileExtension}`;

        // Upload image to S3

        console.log('go to s3');
        profileImageUrl = await uploadFileToS3(
          fileBuffer,
          fileName,
          "collectionofficer/image"
        );
      } catch (err) {
        console.error("Error processing image file:", err);
        return res
          .status(400)
          .json({ error: "Invalid file format or file upload error" });
      }
    }

    // Save officer data (without image if no image is uploaded)
    console.log('got to dao');
    const resultsPersonal =
      await collectionofficerDao.createCenterHeadPersonal(
        officerData,
        profileImageUrl
      );

    console.log("Center Head created successfully");
    return res.status(201).json({
      message: "Center Head created successfully",
      id: resultsPersonal.insertId,
      status: true,
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error creating Center Head:", error);
    return res.status(500).json({
      error: "An error occurred while creating the Center Head",
    });
  }
};

exports.updateCenterHeadDetails = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  const { id } = req.params;

  const officerData = JSON.parse(req.body.officerData);
  const qrCode = await collectionofficerDao.getQrImage(id);

  let qrImageUrl;

  let profileImageUrl = null;

  if (req.body.file) {
    console.log("Recieved");
    qrImageUrl = qrCode.image;
    if (qrImageUrl) {
      await deleteFromS3(qrImageUrl);
    }

    const base64String = req.body.file.split(",")[1]; // Extract the Base64 content
    const mimeType = req.body.file.match(/data:(.*?);base64,/)[1]; // Extract MIME type
    const fileBuffer = Buffer.from(base64String, "base64"); // Decode Base64 to buffer

    const fileExtension = mimeType.split("/")[1]; // Extract file extension from MIME type
    const fileName = `${officerData.firstNameEnglish}_${officerData.lastNameEnglish}.${fileExtension}`;

    profileImageUrl = await uploadFileToS3(
      fileBuffer,
      fileName,
      "collectionofficer/image"
    );
  } else {
    profileImageUrl = qrCode.image;
  }

  const {
    
    companyId,
    irmId,
    firstNameEnglish,
    lastNameEnglish,
    firstNameSinhala,
    lastNameSinhala,
    firstNameTamil,
    lastNameTamil,
    jobRole,
    empId,
    empType,
    phoneCode01,
    phoneNumber01,
    phoneCode02,
    phoneNumber02,
    nic,
    email,
    houseNumber,
    streetName,
    city,
    district,
    province,
    country,
    languages,
    accHolderName,
    accNumber,
    bankName,
    branchName,
  } = officerData;
  console.log(empId);

  try {
    await collectionofficerDao.updateCenterHeadDetails(
      id,
      companyId,
      irmId,
      firstNameEnglish,
      lastNameEnglish,
      firstNameSinhala,
      lastNameSinhala,
      firstNameTamil,
      lastNameTamil,
      jobRole,
      empId,
      empType,
      phoneCode01,
      phoneNumber01,
      phoneCode02,
      phoneNumber02,
      nic,
      email,
      houseNumber,
      streetName,
      city,
      district,
      province,
      country,
      languages,
      accHolderName,
      accNumber,
      bankName,
      branchName,
      profileImageUrl
    );
    res.json({ message: "Collection officer details updated successfully" });
  } catch (err) {
    console.error("Error updating collection officer details:", err);
    res
      .status(500)
      .json({ error: "Failed to update collection officer details" });
  }
};

exports.getAllCenterNames = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const results = await collectionofficerDao.getAllCenterNamesDao();

    console.log("Successfully retrieved reports");
    res.status(200).json(results);
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error retrieving", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching" });
  }
};



exports.getAllCollectionManagerNames = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const results = await collectionofficerDao.getAllCenterManagerDao();

    console.log("Successfully retrieved reports");
    res.status(200).json(results);
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error retrieving district reports:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the reports" });
  }
};

exports.claimOfficer = async (req, res) => {
  try {
    const { id } = req.params; // Officer ID from URL params
    const { centerId, irmId } = req.body; // Center ID and IRM ID from request body

    // Validate required fields
    if (!centerId) {
      return res.status(400).json({ error: "centerId is required" });
    }

    // Call the DAO function to update the officer's details
    const result = await collectionofficerDao.claimOfficerDetailsDao(
      id,
      centerId,
      irmId
    );

    // Send success response
    res.json({ message: "Collection officer details updated successfully" });
  } catch (err) {
    console.error("Error updating collection officer details:", err);
    res
      .status(500)
      .json({ error: "Failed to update collection officer details" });
  }
};














exports.getPurchaseReport = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {

    const validatedQuery = await collectionofficerValidate.getPurchaseReport.validateAsync(req.query);


    const { page, limit, centerId, startDate, endDate, search} = validatedQuery;

    const reportData = await collectionofficerDao.getPurchaseReport(
      page,
      limit,
      centerId,
      startDate,
      endDate, 
      search
    );
    res.json(reportData);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};





exports.getAllCentersForPurchaseReport = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
      const result = await collectionofficerDao.getAllCentersForPurchaseReport();

      return res.status(200).json(result);
  } catch (error) {
      if (error.isJoi) {
          return res.status(400).json({ error: error.details[0].message });
      }
      console.error("Error fetching collection centers:", error);
      return res.status(500).json({ error: "An error occurred while fetching collection centers" });
  }
};


exports.downloadPurchaseReport = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {

   


    const {centerId, monthNumber, createdDate, search} = req.query;

    const reportData = await collectionofficerDao.downloadPurchaseReport(
      centerId,
      monthNumber,
      createdDate, 
      search
    );
    res.json(reportData);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};





exports.getCollectionReport = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {

    const validatedQuery = await collectionofficerValidate.getPurchaseReport.validateAsync(req.query);


    const { page, limit, centerId, startDate, endDate, search} = validatedQuery;

    const reportData = await collectionofficerDao.getCollectionReport(
      page,
      limit,
      centerId,
      startDate,
      endDate, 
      search
    );
    res.json(reportData);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};


exports.getFarmerReportInvoice = async (req, res) => {
  try {
    const { invNo } = await collectionofficerValidate.invNoParmsSchema.validateAsync(req.params);

    const UserResult = await collectionofficerDao.getFarmerInvoiceDetailsDao(invNo);
    const CropResult = await collectionofficerDao.getFarmerCropsInvoiceDetailsDao(invNo);

    if (UserResult.length === 0 || CropResult.length === 0) {
      return res.json({ message: "No report items found", status: false });
    }

    res.json({ user: UserResult[0], crops: CropResult, status: true });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching report:", err);
    res.status(500).json({ error: "An error occurred while fetching news" });
  }
};



exports.getCollectionCenterForReport = async (req, res) => {
  try {
    const result = await collectionofficerDao.getCollectionCenterForReportDao();


    res.json({ data:result, status: true });
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching report:", err);
    res.status(500).json({ error: "An error occurred while fetching news" });
  }
};




