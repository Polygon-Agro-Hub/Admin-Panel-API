const {
  plantcare,
  collectionofficer,
  marketPlace,
  dash,
} = require("../startup/database");
const QRCode = require("qrcode");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const uploadFileToS3 = require("../middlewares/s3upload");
const { resolve } = require("path");
const path = require("path");

exports.getCollectionOfficerDistrictReports = (district) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT cg.cropNameEnglish AS cropName,
             c.district, 
             SUM(fpc.gradeAquan) AS qtyA, 
             SUM(fpc.gradeBquan) AS qtyB, 
             SUM(fpc.gradeCquan) AS qtyC, 
             SUM(fpc.gradeAprice) AS priceA, 
             SUM(fpc.gradeBprice) AS priceB, 
             SUM(fpc.gradeCprice) AS priceC
            FROM registeredfarmerpayments rp, collectionofficer c, plant_care.cropvariety cv , plant_care.cropgroup cg, farmerpaymentscrops fpc
            WHERE rp.id = fpc.registerFarmerId AND rp.collectionOfficerId = c.id AND fpc.cropId = cv.id AND cv.cropGroupId = cg.id AND c.district = ? AND c.companyId = 1
            GROUP BY cg.cropNameEnglish, c.district
        `;
    collectionofficer.query(sql, [district], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      console.log(results);

      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.checkNICExist = async (nic, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT COUNT(*) as count FROM collectionofficer WHERE nic = ?`;
    const params = [nic];
    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }
    collectionofficer.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results[0].count > 0);
    });
  });
};


exports.checkEmailExist = async (email, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT COUNT(*) as count FROM collectionofficer WHERE email = ?`;
    const params = [email];
    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }
    collectionofficer.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results[0].count > 0);
    });
  });
};

// Check if phone number exists, excluding the current officer
exports.checkPhoneNumberExist = async (phoneNumber, excludeId = null) => {
  console.log('officer', excludeId);
  return new Promise((resolve, reject) => {
    let sql = `SELECT COUNT(*) as count 
               FROM collectionofficer 
               WHERE (phoneNumber01 = ? OR phoneNumber02 = ?)`;
    const params = [phoneNumber, phoneNumber];
    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }
    collectionofficer.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results[0].count > 0);
    });
  });
};


// exports.createCollectionOfficerPersonal = (officerData, profileImageUrl) => {
//   return new Promise(async (resolve, reject) => {
//     try {
//       // Prepare data for QR code generation
//       const qrData = `
//             {
//                 "empId": "${officerData.empId}",
//             }
//             `;

//       const qrCodeBase64 = await QRCode.toDataURL(qrData);
//       const qrCodeBuffer = Buffer.from(
//         qrCodeBase64.replace(/^data:image\/png;base64,/, ""),
//         "base64"
//       );
//       const qrcodeURL = await uploadFileToS3(
//         qrCodeBuffer,
//         `${officerData.empId}.png`,
//         "collectionofficer/QRcode"
//       );
//       console.log(qrcodeURL);

//       const sql = `
//                 INSERT INTO collectionofficer (
//                     centerId, companyId ,irmId ,firstNameEnglish, firstNameSinhala, firstNameTamil, lastNameEnglish,
//                     lastNameSinhala, lastNameTamil, jobRole, empId, empType, phoneCode01, phoneNumber01, phoneCode02, phoneNumber02,
//                     nic, email, houseNumber, streetName, city, district, province, country,
//                     languages, accHolderName, accNumber, bankName, branchName, image, QRcode, status
//                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
//                          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
//                          ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?, 'Not Approved')
//             `;

//       // Database query with QR image data added
//       collectionofficer.query(
//         sql,
//         [
//           officerData.centerId,
//           officerData.companyId,
//           officerData.irmId,
//           officerData.firstNameEnglish,
//           officerData.firstNameSinhala,
//           officerData.firstNameTamil,
//           officerData.lastNameEnglish,
//           officerData.lastNameSinhala,
//           officerData.lastNameTamil,
//           officerData.jobRole,
//           officerData.empId,
//           officerData.empType,
//           officerData.phoneCode01,
//           officerData.phoneNumber01,
//           officerData.phoneCode02,
//           officerData.phoneNumber02,
//           officerData.nic,
//           officerData.email,
//           officerData.houseNumber,
//           officerData.streetName,
//           officerData.city,
//           officerData.district,
//           officerData.province,
//           officerData.country,
//           officerData.languages,
//           officerData.accHolderName,
//           officerData.accNumber,
//           officerData.bankName,
//           officerData.branchName,
//           profileImageUrl,
//           qrcodeURL,
//         ],
//         (err, results) => {
//           if (err) {
//             console.log(err);

//             return reject(err); // Reject promise if an error occurs
//           }
//           resolve(results); // Resolve the promise with the query results
//         }
//       );
//     } catch (error) {
//       reject(error); // Reject if any error occurs during QR code generation
//     }
//   });
// };


exports.createCollectionOfficerPersonal = (
  officerData,
  profileImageUrl,
  lastId
) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Prepare data for QR code generation
      const qrData = `
            {
                "empId": "${officerData.empId}",
            }
            `;

      const qrCodeBase64 = await QRCode.toDataURL(qrData);
      const qrCodeBuffer = Buffer.from(
        qrCodeBase64.replace(/^data:image\/png;base64,/, ""),
        "base64"
      );
      const qrcodeURL = await uploadFileToS3(
        qrCodeBuffer,
        `${officerData.empId}.png`,
        "collectionofficer/QRcode"
      );
      console.log(qrcodeURL);

      // If no image URL, set it to null
      const imageUrl = profileImageUrl || null; // Use null if profileImageUrl is not provided
      if (officerData.jobRole === 'Collection Center Manager' || officerData.jobRole === 'Collection Center Head') {
        officerData.irmId = null;
      }

      const sql = `
                INSERT INTO collectionofficer (
                    centerId, companyId ,irmId ,firstNameEnglish, firstNameSinhala, firstNameTamil, lastNameEnglish,
                    lastNameSinhala, lastNameTamil, jobRole, empId, empType, phoneCode01, phoneNumber01, phoneCode02, phoneNumber02,
                    nic, email, houseNumber, streetName, city, district, province, country,
                    languages, accHolderName, accNumber, bankName, branchName, image, QRcode, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                         ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?, 'Not Approved')
            `;

      // Database query with QR image data added
      collectionofficer.query(
        sql,
        [
          officerData.centerId,
          officerData.companyId,
          officerData.irmId,
          officerData.firstNameEnglish,
          officerData.firstNameSinhala,
          officerData.firstNameTamil,
          officerData.lastNameEnglish,
          officerData.lastNameSinhala,
          officerData.lastNameTamil,
          officerData.jobRole,
          lastId, //this is latest empId
          officerData.empType,
          officerData.phoneCode01,
          officerData.phoneNumber01,
          officerData.phoneCode02,
          officerData.phoneNumber02,
          officerData.nic,
          officerData.email,
          officerData.houseNumber,
          officerData.streetName,
          officerData.city,
          officerData.district,
          officerData.province,
          officerData.country,
          officerData.languages,
          officerData.accHolderName,
          officerData.accNumber,
          officerData.bankName,
          officerData.branchName,
          imageUrl, // Use the potentially null image URL
          qrcodeURL,
        ],
        (err, results) => {
          if (err) {
            console.log(err);
            return reject(err); // Reject promise if an error occurs
          }
          resolve(results); // Resolve the promise with the query results
        }
      );
    } catch (error) {
      reject(error); // Reject if any error occurs during QR code generation
    }
  });
};

exports.getQrImage = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT image, QRcode FROM collectionofficer WHERE id = ?";
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0]);
    });
  });
};

// exports.getAllCollectionOfficers = (page, limit, searchNIC, companyid) => {
//   return new Promise((resolve, reject) => {
//     const offset = (page - 1) * limit;

//     let countSql = `
//             SELECT COUNT(*) as total
//             FROM collectionofficer coff
//             JOIN company cm ON coff.companyId  = cm.id
//             JOIN collectioncenter cc ON coff.centerId = cc.id
//             WHERE 1 = 1
//         `;

//     let dataSql = `
//             SELECT
//                 coff.id,
//                 coff.image,
//                 coff.firstNameEnglish,
//                 coff.lastNameEnglish,
//                 coff.empId,
//                 coff.status,
//                 coff.claimStatus,
//                 coff.jobRole,
//                 coff.phoneCode01,
//                 coff.phoneNumber01,
//                 coff.nic,
//                 cm.companyNameEnglish,
//                 cc.centerName
//             FROM collectionofficer coff
//             JOIN company cm ON coff.companyId  = cm.id
//             JOIN collectioncenter cc ON coff.centerId = cc.id
//             WHERE 1 = 1
//         `;

//     const countParams = [];
//     const dataParams = [];

//     // Apply filters for company ID
//     if (companyid) {
//       countSql += " AND cm.id = ?";
//       dataSql += " AND cm.id = ?";
//       countParams.push(companyid);
//       dataParams.push(companyid);
//     }

//     // Apply search filters for NIC or related fields
//     if (searchNIC) {
//       const searchCondition = `
//                 AND (
//                     coff.nic LIKE ?
//                     OR coff.firstNameEnglish LIKE ?
//                     OR cm.companyNameEnglish LIKE ?
//                     OR coff.phoneNumber01 LIKE ?
//                     OR coff.phoneNumber02 LIKE ?
//                     OR coff.district LIKE ?
//                     OR coff.empId LIKE ?
//                 )
//             `;
//       countSql += searchCondition;
//       dataSql += searchCondition;
//       const searchValue = `%${searchNIC}%`;
//       countParams.push(
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue
//       );
//       dataParams.push(
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue
//       );
//     }

//     dataSql += " ORDER BY coff.createdAt DESC";

//     // Add pagination to the data query
//     dataSql += " LIMIT ? OFFSET ?";
//     dataParams.push(limit, offset);

//     // Execute count query
//     collectionofficer.query(countSql, countParams, (countErr, countResults) => {
//       if (countErr) {
//         console.error("Error in count query:", countErr);
//         return reject(countErr);
//       }

//       const total = countResults[0].total;

//       // Execute data query
//       collectionofficer.query(dataSql, dataParams, (dataErr, dataResults) => {
//         if (dataErr) {
//           console.error("Error in data query:", dataErr);
//           return reject(dataErr);
//         }

//         resolve({ items: dataResults, total });
//       });
//     });
//   });
// };

exports.getAllCollectionOfficers = (
  page,
  limit,
  searchNIC,
  companyid,
  role,
  centerStatus,
  status,
  centerId
) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let countSql = `
            SELECT COUNT(*) as total
            FROM collectionofficer coff
            JOIN company cm ON coff.companyId = cm.id
            LEFT JOIN collectioncenter cc ON coff.centerId = cc.id
            WHERE coff.jobRole IN ('Collection Center Manager', 'Collection Officer') AND cm.id = 1
        `;

    let dataSql = `
            SELECT
                coff.id,
                coff.image,
                coff.firstNameEnglish,
                coff.lastNameEnglish,
                coff.empId,
                coff.status,
                coff.claimStatus,
                coff.jobRole,
                coff.phoneCode01,
                coff.phoneNumber01,
                coff.nic,
                cm.companyNameEnglish,
                cc.centerName
            FROM collectionofficer coff
            JOIN company cm ON coff.companyId = cm.id
            LEFT JOIN collectioncenter cc ON coff.centerId = cc.id
            WHERE coff.jobRole IN ('Collection Center Manager', 'Collection Officer') AND cm.id = 1
        `;

    const countParams = [];
    const dataParams = [];

    // Apply filters for company ID
    if (companyid) {
      countSql += " AND cm.id = ?";
      dataSql += " AND cm.id = ?";
      countParams.push(companyid);
      dataParams.push(companyid);
    }

    if (centerStatus) {
      let claimStatusValue;
      if (centerStatus === "Claimed") {
        claimStatusValue = 1;
      } else if (centerStatus === "Disclaimed") {
        claimStatusValue = 0;
      }

      console.log("this is claimstatus value", claimStatusValue);

      if (claimStatusValue !== undefined) {
        countSql += " AND coff.claimStatus = ? ";
        dataSql += " AND coff.claimStatus = ? ";
        countParams.push(claimStatusValue);
        dataParams.push(claimStatusValue);
      }
    }

    if (status) {
      countSql += " AND coff.status LIKE ? ";
      dataSql += " AND coff.status LIKE ? ";
      countParams.push(status);
      dataParams.push(status);
    }

    if (role) {
      countSql += " AND coff.jobRole = ?";
      dataSql += " AND coff.jobRole = ?";
      countParams.push(role);
      dataParams.push(role);
    }

    if (centerId) {
      countSql += " AND coff.centerId = ?";
      dataSql += " AND coff.centerId = ?";
      countParams.push(centerId);
      dataParams.push(centerId);
    }

    if (searchNIC) {
      const searchCondition = `
                AND (
                    coff.nic LIKE ?
                    OR coff.firstNameEnglish LIKE ?
                    OR cm.companyNameEnglish LIKE ?
                    OR coff.phoneNumber01 LIKE ?
                    OR coff.phoneNumber02 LIKE ?
                    OR coff.district LIKE ?
                    OR coff.empId LIKE ?
                    OR cc.centerName LIKE ?
                )
            `;
      countSql += searchCondition;
      dataSql += searchCondition;
      const searchValue = `%${searchNIC}%`;
      countParams.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
      dataParams.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    // Modified ORDER BY to prioritize CCMs and sort by empId ASC, then others by createdAt DESC
    dataSql += `
      ORDER BY 
        CASE WHEN coff.jobRole = 'Collection Center Manager' THEN 0 ELSE 1 END,
        CASE WHEN coff.jobRole = 'Collection Center Manager' THEN coff.empId END ASC,
        CASE WHEN coff.jobRole = 'Collection Officer' THEN coff.createdAt END DESC
    `;

    // Add pagination to the data query
    dataSql += " LIMIT ? OFFSET ?";
    dataParams.push(limit, offset);

    // Execute count query
    collectionofficer.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      // Execute data query
      collectionofficer.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }

        resolve({ items: dataResults, total });
      });
    });
  });
};
// exports.getAllCollectionOfficersStatus = (
//   page,
//   limit,
//   searchNIC,
//   centerName // Change parameter name from companyid to centerName
// ) => {
//   return new Promise((resolve, reject) => {
//     const offset = (page - 1) * limit;

//     let countSql = `
//       SELECT COUNT(*) as total
//       FROM collectionofficer Coff
//       JOIN company Ccom ON Coff.companyId = Ccom.id
//       JOIN collectioncenter CC ON Coff.centerId = CC.id
//       WHERE Coff.status = 'Approved' AND Coff.companyId = 1
//     `;

//     let dataSql = `
//       SELECT
//         Coff.id,
//         Coff.image,
//         Coff.firstNameEnglish,
//         Coff.lastNameEnglish,
//         Ccom.companyNameEnglish,
//         Coff.empId,
//         Coff.phoneCode01,
//         Coff.phoneNumber01,
//         Coff.phoneCode02,
//         Coff.phoneNumber02,
//         Coff.nic,
//         Coff.district,
//         Coff.status,
//         CC.centerName,
//         Coff.QRcode
//       FROM collectionofficer Coff
//       JOIN company Ccom ON Coff.companyId = Ccom.id
//       JOIN collectioncenter CC ON Coff.centerId = CC.id
//       WHERE Coff.status = 'Approved' AND Coff.companyId = 1
//     `;

//     const countParams = [];
//     const dataParams = [];

//     // Apply filter for centerName
//     if (centerName) {
//       countSql += " AND CC.centerName = ?";
//       dataSql += " AND CC.centerName = ?";
//       countParams.push(centerName);
//       dataParams.push(centerName);
//     }

//     // Apply search filters for NIC or related fields
//     if (searchNIC) {
//       const searchCondition = `
//         AND (
//           Coff.nic LIKE ?
//           OR Coff.firstNameEnglish LIKE ?
//           OR Ccom.companyNameEnglish LIKE ?
//           OR Coff.phoneNumber01 LIKE ?
//           OR Coff.phoneNumber02 LIKE ?
//           OR Coff.district LIKE ?
//         )
//       `;
//       countSql += searchCondition;
//       dataSql += searchCondition;
//       const searchValue = `%${searchNIC}%`;
//       countParams.push(
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue
//       );
//       dataParams.push(
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue,
//         searchValue
//       );
//     }

//     // Add pagination to the data query
//     dataSql += " LIMIT ? OFFSET ?";
//     dataParams.push(limit, offset);

//     // Execute count query
//     collectionofficer.query(countSql, countParams, (countErr, countResults) => {
//       if (countErr) {
//         console.error("Error in count query:", countErr);
//         return reject(countErr);
//       }

//       const total = countResults[0].total;

//       // Execute data query
//       collectionofficer.query(dataSql, dataParams, (dataErr, dataResults) => {
//         if (dataErr) {
//           console.error("Error in data query:", dataErr);
//           return reject(dataErr);
//         }

//         // Convert QRcode to Base64 (if needed)
//         const processedResults = dataResults.map((item) => {
//           return item;
//         });

//         resolve({ items: processedResults, total });
//       });
//     });
//   });
// };
exports.getAllCollectionOfficersStatus = (
  page,
  limit,
  searchNIC,
  centerName
) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let countSql = `
      SELECT COUNT(*) as total
      FROM collectionofficer Coff
      JOIN company Ccom ON Coff.companyId = Ccom.id
      JOIN collectioncenter CC ON Coff.centerId = CC.id
      WHERE Coff.status = 'Approved' AND Coff.companyId = 1
    `;

    let dataSql = `
      SELECT
        Coff.id,
        Coff.image,
        Coff.firstNameEnglish,
        Coff.lastNameEnglish,
        Ccom.companyNameEnglish,
        Coff.empId,
        Coff.phoneCode01,
        Coff.phoneNumber01,
        Coff.phoneCode02,
        Coff.phoneNumber02,
        Coff.nic,
        Coff.district,
        Coff.status,
        CC.centerName,
        Coff.QRcode
      FROM collectionofficer Coff
      JOIN company Ccom ON Coff.companyId = Ccom.id
      JOIN collectioncenter CC ON Coff.centerId = CC.id
      WHERE Coff.status = 'Approved' AND Coff.companyId = 1
    `;

    const countParams = [];
    const dataParams = [];

    // Apply filter for centerName only if non-empty
    if (centerName) {
      countSql += " AND CC.centerName LIKE ?";
      dataSql += " AND CC.centerName LIKE ?";
      countParams.push(`%${centerName}%`);
      dataParams.push(`%${centerName}%`);
    }

    // Apply search filters for NIC or related fields
    if (searchNIC && searchNIC.trim()) {
      const searchCondition = `
        AND (
          Coff.nic LIKE ?
          OR Coff.firstNameEnglish LIKE ?
          OR Ccom.companyNameEnglish LIKE ?
          OR Coff.phoneNumber01 LIKE ?
          OR Coff.phoneNumber02 LIKE ?
          OR Coff.district LIKE ?
        )
      `;
      countSql += searchCondition;
      dataSql += searchCondition;
      const searchValue = `%${searchNIC.trim()}%`;
      countParams.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
      dataParams.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    // Add pagination to the data query
    dataSql += " LIMIT ? OFFSET ?";
    dataParams.push(limit, offset);

    // Execute count query
    collectionofficer.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      // Execute data query
      collectionofficer.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }

        // Convert QRcode to Base64 (if needed)
        const processedResults = dataResults.map((item) => {
          return item;
        });

        resolve({ items: processedResults, total });
      });
    });
  });
};
exports.getRegisteredFarmerPaymentsByOfficer = (collectionOfficerId, date) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT id 
            FROM registeredfarmerpayments
            WHERE collectionOfficerId = ? 
            AND DATE(createdAt) = ?;
        `;
    const values = [collectionOfficerId, date];

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getFarmerPaymentsCropsByRegisteredFarmerId = (registeredFarmerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT c.varietyNameEnglish, fc.gradeAprice AS 'Grade A', fc.gradeBprice AS 'Grade B', fc.gradeCprice AS 'Grade C',
                   (fc.gradeAquan + fc.gradeBquan + fc.gradeCquan) AS totalQuantity, fc.gradeAquan, fc.gradeBquan, fc.gradeCquan
            FROM farmerpaymentscrops fc
            JOIN plant_care.cropvariety c ON fc.cropId = c.id
            WHERE fc.registerFarmerId = ?;
        `;
    const values = [registeredFarmerId];

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getCollectionOfficerProvinceReports = (province) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        cg.cropNameEnglish AS cropName,
        cc.province, 
        SUM(fpc.gradeAquan) AS qtyA, 
        SUM(fpc.gradeBquan) AS qtyB, 
        SUM(fpc.gradeCquan) AS qtyC, 
        SUM(fpc.gradeAprice) AS priceA, 
        SUM(fpc.gradeBprice) AS priceB, 
        SUM(fpc.gradeCprice) AS priceC
      FROM registeredfarmerpayments rp
      INNER JOIN collectionofficer c ON rp.collectionOfficerId = c.id
      INNER JOIN farmerpaymentscrops fpc ON rp.id = fpc.registerFarmerId
      INNER JOIN plant_care.cropvariety cv ON fpc.cropId = cv.id
      INNER JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      INNER JOIN collectioncenter cc ON c.centerId = cc.id
      WHERE cc.province = ? AND c.companyId = 1
      GROUP BY cg.cropNameEnglish, cc.province
    `;

    collectionofficer.query(sql, [province], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getAllCompanyNamesDao = (district) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT id, companyNameEnglish
            FROM company
            WHERE isCollection = 1;
        `;
    collectionofficer.query(sql, [district], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.getCollectionOfficerEmailDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT c.email, c.firstNameEnglish, c.empId AS empId
            FROM collectionofficer c
            WHERE c.id = ?
        `;
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      if (results.length > 0) {
        resolve({
          email: results[0].email, // Resolve with email
          firstNameEnglish: results[0].firstNameEnglish,
          empId: results[0].empId, // Resolve with employeeType (empId)
        });
      } else {
        resolve(null); // Resolve with null if no record is found
      }
    });
  });
};

exports.SendGeneratedPasswordDao = async (
  email,
  password,
  empId,
  firstNameEnglish
) => {
  try {
    const doc = new PDFDocument();

    // Create a buffer to hold the PDF in memory
    const pdfBuffer = [];
    doc.on("data", pdfBuffer.push.bind(pdfBuffer));
    doc.on("end", () => { });

    const watermarkPath = path.resolve(__dirname, "../assets/bg.png");
    doc.opacity(0.2).image(watermarkPath, 100, 300, { width: 400 }).opacity(1);

    doc
      .fontSize(20)
      .fillColor("#071a51")
      .text("Welcome to PolygonAgro (Pvt) Ltd - Registration Confirmation", {
        align: "center",
      });

    doc.moveDown();

    const lineY = doc.y;

    doc.moveTo(50, lineY).lineTo(550, lineY).stroke();

    doc.moveDown();

    doc.fontSize(12).text(`Dear ${firstNameEnglish},`);

    doc.moveDown();

    doc
      .fontSize(12)
      .text(
        "Thank you for registering with us! We are excited to have you on board."
      );

    doc.moveDown();

    doc
      .fontSize(12)
      .text(
        "You have successfully created an account with PolygonAgro (Pvt) Ltd. Our platform will help you with all your agricultural needs, providing guidance, weather reports, asset management tools, and much more. We are committed to helping farmers like you grow and succeed.",
        {
          align: "justify",
        }
      );

    doc.moveDown();

    doc.fontSize(12).text(`Your User Name/ID: ${empId}`);
    doc.fontSize(12).text(`Your Password: ${password}`);

    doc.moveDown();

    doc
      .fontSize(12)
      .text(
        "If you have any questions or need assistance, feel free to reach out to our support team at polygonagro.inf@gmail.com",
        {
          align: "justify",
        }
      );

    doc.moveDown();

    doc.fontSize(12).text("We are here to support you every step of the way!", {
      align: "justify",
    });

    doc.moveDown();
    doc.fontSize(12).text(`Best Regards,`);
    doc.fontSize(12).text(`The PolygonAgro Team`);
    doc.fontSize(12).text(`PolygonAgro (Pvt) Ltd. | All rights reserved.`);
    doc.moveDown();
    doc.fontSize(12).text(`Address: No:14,`);
    doc.fontSize(12).text(`            Sir Baron Jayathilake Mawatha,`);
    doc.fontSize(12).text(`            Colombo 01.`);
    doc.moveDown();
    doc.fontSize(12).text(`Email: polygonagro.inf@gmail.com`);

    doc.end();

    // Wait until the PDF is fully created and available in the buffer
    await new Promise((resolve) => doc.on("end", resolve));

    const pdfData = Buffer.concat(pdfBuffer); // Concatenate the buffer data

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465, // or 587 for TLS
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        family: 4,
      },
    });

    // const transporter = nodemailer.createTransport({
    //   host: "smtp.gmail.com",
    //   port: 465, // SSL
    //   secure: true, // true for 465, false for 587
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS,
    //   },
    //   tls: {
    //     rejectUnauthorized: false, // <-- This allows self-signed certificates
    //     family: 4, // optional if you want to force IPv4
    //   },
    // });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to PolygonAgro (Pvt) Ltd - Registration Confirmation",
      text: `Dear ${firstNameEnglish},\n\nYour registration details are attached in the PDF.`,
      attachments: [
        {
          filename: `password_${empId}.pdf`, // PDF file name
          content: pdfData, // Attach the PDF buffer directly
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);

    return { success: true, message: "Email sent successfully!" };
  } catch (error) {
    console.error("Error sending email:", error);

    return { success: false, message: "Failed to send email.", error };
  }
};

exports.UpdateCollectionOfficerStatusAndPasswordDao = (params) => {
  return new Promise((resolve, reject) => {
    const sql = `
            UPDATE collectionofficer
            SET status = ?, password = ?, passwordUpdated = 0
            WHERE id = ?
        `;
    collectionofficer.query(
      sql,
      [params.status, params.password, parseInt(params.id)],
      (err, results) => {
        if (err) {
          return reject(err); // Reject promise if an error occurs
        }
        resolve(results); // Resolve with the query results
      }
    );
  });
};

exports.UpdateCollectionOfiicerStatusDao = (params) => {
  return new Promise((resolve, reject) => {
    const sql = `
            UPDATE collectionofficer
            SET status = ?
            WHERE id = ?
        `;
    collectionofficer.query(
      sql,
      [params.status, parseInt(params.id)],
      (err, results) => {
        if (err) {
          return reject(err); // Reject promise if an error occurs
        }
        resolve(results); // Resolve the promise with the query results
      }
    );
  });
};

exports.DeleteCollectionOfficerDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
            DELETE FROM collectionofficer
            WHERE id = ?
        `;
    collectionofficer.query(sql, [parseInt(id)], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.getOfficerById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT 
                co.*, 
                cocd.companyNameEnglish, cocd.companyNameSinhala, cocd.companyNameTamil,
                cocd.jobRole, cocd.empId, cocd.IRMname, cocd.companyEmail, cocd.assignedDistrict, cocd.employeeType,
                cobd.accHolderName, cobd.accNumber, cobd.bankName, cobd.branchName
            FROM 
                collectionofficer co
            LEFT JOIN 
                collectionofficercompanydetails cocd ON co.id = cocd.collectionOfficerId
            LEFT JOIN 
                collectionofficerbankdetails cobd ON co.id = cobd.collectionOfficerId
            WHERE 
                co.id = ?`;

    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      if (results.length === 0) {
        return resolve(null); // No officer found
      }

      const officer = results[0];

      // Process image field if present
      if (officer.image) {
        const base64Image = Buffer.from(officer.image).toString("base64");
        officer.image = `data:image/png;base64,${base64Image}`;
      }

      // Process QRcode field if present
      if (officer.QRcode) {
        const base64QRcode = Buffer.from(officer.QRcode).toString("base64");
        officer.QRcode = `data:image/png;base64,${base64QRcode}`;
      }

      // Remove the first 3 characters from empId if it exists
      const empIdWithoutPrefix = officer.empId
        ? officer.empId.substring(3)
        : null;

      resolve({
        collectionOfficer: {
          id: officer.id,
          centerId: officer.centerId,
          firstNameEnglish: officer.firstNameEnglish,
          firstNameSinhala: officer.firstNameSinhala,
          firstNameTamil: officer.firstNameTamil,
          lastNameEnglish: officer.lastNameEnglish,
          lastNameSinhala: officer.lastNameSinhala,
          lastNameTamil: officer.lastNameTamil,
          phoneNumber01: officer.phoneNumber01,
          phoneNumber02: officer.phoneNumber02,
          image: officer.image,
          QRcode: officer.QRcode,
          nic: officer.nic,
          email: officer.email,
          passwordUpdated: officer.passwordUpdated,
          address: {
            houseNumber: officer.houseNumber,
            streetName: officer.streetName,
            city: officer.city,
            district: officer.district,
            province: officer.province,
            country: officer.country,
          },
          languages: officer.languages,
        },
        companyDetails: {
          companyNameEnglish: officer.companyNameEnglish,
          companyNameSinhala: officer.companyNameSinhala,
          companyNameTamil: officer.companyNameTamil,
          jobRole: officer.jobRole,
          empId: empIdWithoutPrefix, // Updated to exclude first 3 characters
          IRMname: officer.IRMname,
          companyEmail: officer.companyEmail,
          assignedDistrict: officer.assignedDistrict,
          employeeType: officer.employeeType,
        },
        bankDetails: {
          accHolderName: officer.accHolderName,
          accNumber: officer.accNumber,
          bankName: officer.bankName,
          branchName: officer.branchName,
        },
      });
    });
  });
};

// exports.updateOfficerDetails = (
//     id,
//     centerId,
//     companyId,
//     irmId,
//     firstNameEnglish,
//     lastNameEnglish,
//     firstNameSinhala,
//     lastNameSinhala,
//     firstNameTamil,
//     lastNameTamil,
//     jobRole,
//     empId,
//     empType,
//     phoneCode01,
//     phoneNumber01,
//     phoneCode02,
//     phoneNumber02,
//     nic,
//     email,
//     houseNumber,
//     streetName,
//     city,
//     district,
//     province,
//     country,
//     languages,
//     accHolderName,
//     accNumber,
//     bankName,
//     branchName
// ) => {
//     return new Promise((resolve, reject) => {
//         collectionofficer.beginTransaction((err) => {
//             if (err) {
//                 return reject(err);
//             }

//             const updateOfficerSQL = `
//                 UPDATE collectionofficer
//                 SET centerId = ?, companyId = ?, irmId = ?, firstNameEnglish = ?, lastNameEnglish = ?, firstNameSinhala = ?, lastNameSinhala = ?,
//                     firstNameTamil = ?, lastNameTamil = ?, jobRole = ?, empId = ?, empType = ?, phoneCode01 = ?, phoneNumber01 = ?, phoneCode02 = ?, phoneNumber02 = ?,
//                     nic = ?, email = ?, houseNumber = ?, streetName = ?, city = ?, district = ?, province = ?, country = ?, languages = ?,
//                     accHolderName = ?, accNumber = ?, bankName = ?, branchName = ?, status = 'Not Approved'
//                 WHERE id = ?
//             `;

//             const updateOfficerParams = [
//                 centerId,
//                 companyId,
//                 irmId,
//                 firstNameEnglish,
//                 lastNameEnglish,
//                 firstNameSinhala,
//                 lastNameSinhala,
//                 firstNameTamil,
//                 lastNameTamil,
//                 jobRole,
//                 empId,
//                 empType,
//                 phoneCode01,
//                 phoneNumber01,
//                 phoneCode02,
//                 phoneNumber02,
//                 nic,
//                 email,
//                 houseNumber,
//                 streetName,
//                 city,
//                 district,
//                 province,
//                 country,
//                 languages,
//                 accHolderName,
//                 accNumber,
//                 bankName,
//                 branchName,
//                 id,
//             ];

//             collectionofficer.query(updateOfficerSQL, updateOfficerParams, (err, results) => {
//                 if (err) {
//                     return collectionofficer.rollback(() => {
//                         reject(err);
//                     });
//                 }

//                 collectionofficer.commit((commitErr) => {
//                     if (commitErr) {
//                         return db.rollback(() => {
//                             reject(commitErr);
//                         });
//                     }

//                     resolve({ message: 'Officer details updated successfully.', results });
//                 });
//             });
//         });
//     });
// };

exports.updateOfficerDetails = (
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
) => {
  return new Promise((resolve, reject) => {
    let sql = `
             UPDATE collectionofficer
                SET centerId = ?, companyId = ?, irmId = ?, firstNameEnglish = ?, lastNameEnglish = ?, firstNameSinhala = ?, lastNameSinhala = ?,
                    firstNameTamil = ?, lastNameTamil = ?, jobRole = ?, empId = ?, empType = ?, phoneCode01 = ?, phoneNumber01 = ?, phoneCode02 = ?, phoneNumber02 = ?,
                    nic = ?, email = ?, houseNumber = ?, streetName = ?, city = ?, district = ?, province = ?, country = ?, languages = ?,
                    accHolderName = ?, accNumber = ?, bankName = ?, branchName = ?, image = ?, status = 'Not Approved'
          `;
    let values = [
      centerId,
      companyId,
      irmId || null,
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
      profileImageUrl,
    ];

    sql += ` WHERE id = ?`;
    values.push(id);

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getOfficerByIdMonthly = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT 
                co.*
            FROM 
                collectionofficer co
            WHERE 
                co.id = ?`;

    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

// DAO function to fetch the daily report
exports.getDailyReport = (collectionOfficerId, fromDate, toDate) => {
  return new Promise((resolve, reject) => {
    const query = `
        SELECT 
          DATE(rfp.createdAt) AS date,
          COUNT(DISTINCT rfp.id) AS totalPayments,
          SUM(IFNULL(fpc.gradeAquan, 0) + IFNULL(fpc.gradeBquan, 0) + IFNULL(fpc.gradeCquan, 0)) AS totalWeight
        FROM 
          registeredfarmerpayments rfp
        LEFT JOIN 
          farmerpaymentscrops fpc ON rfp.id = fpc.registerFarmerId
        WHERE 
          rfp.collectionOfficerId = ? 
          AND rfp.createdAt BETWEEN ? AND ?
        GROUP BY 
          DATE(rfp.createdAt)
        ORDER BY 
          date ASC;
      `;

    // Parameters: collectionOfficerId, fromDate, toDate
    const params = [collectionOfficerId, fromDate, toDate];

    collectionofficer.query(query, params, (err, results) => {
      if (err) {
        return reject(err);
      }

      // Format results as needed
      const reportData = results.map((row) => ({
        date: row.date,
        totalPayments: row.totalPayments,
        totalWeight: row.totalWeight ? parseFloat(row.totalWeight) : 0,
      }));

      resolve(reportData);
    });
  });
};

exports.getOfficerByIdDAO = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
          SELECT 
              COF.*,
              COM.companyNameEnglish,
              CEN.centerName
          FROM 
              collectionofficer COF
          JOIN 
              company COM ON COF.companyId = COM.id
          LEFT JOIN 
              collectioncenter CEN ON COF.centerId = CEN.id
          WHERE 
              COF.id = ?`;

    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      if (results.length === 0) {
        return resolve(null); // No officer found
      }

      const officer = results[0];

      const empIdWithoutPrefix = officer.empId
        ? officer.empId.substring(3)
        : null;

      resolve({
        collectionOfficer: {
          id: officer.id,
          firstNameEnglish: officer.firstNameEnglish,
          firstNameSinhala: officer.firstNameSinhala,
          firstNameTamil: officer.firstNameTamil,
          lastNameEnglish: officer.lastNameEnglish,
          lastNameSinhala: officer.lastNameSinhala,
          lastNameTamil: officer.lastNameTamil,
          phoneNumber01: officer.phoneNumber01,
          phoneNumber02: officer.phoneNumber02,
          phoneCode01: officer.phoneCode01,
          phoneCode02: officer.phoneCode02,
          image: officer.image,
          QRcode: officer.QRcode,
          status: officer.status,
          claimStatus: officer.claimStatus,
          nic: officer.nic,
          email: officer.email,
          passwordUpdated: officer.passwordUpdated,
          houseNumber: officer.houseNumber,
          streetName: officer.streetName,
          city: officer.city,
          district: officer.district,
          province: officer.province,
          country: officer.country,
          languages: officer.languages,
          empId: empIdWithoutPrefix,
          jobRole: officer.jobRole,
          employeeType: officer.empType,
          accHolderName: officer.accHolderName,
          accNumber: officer.accNumber,
          bankName: officer.bankName,
          branchName: officer.branchName,
          companyNameEnglish: officer.companyNameEnglish,
          centerName: officer.centerName,
        },
      });
    });
  });
};

exports.disclaimOfficerDetailsDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
          UPDATE collectionofficer
          SET centerId = NULL, irmId = NULL, claimStatus = 0
          WHERE id = ?
      `;
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.createCenterHeadPersonal = (officerData, profileImageUrl) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Prepare data for QR code generation
      const qrData = `
            {
                "empId": "${officerData.empId}",
            }
            `;

      const qrCodeBase64 = await QRCode.toDataURL(qrData);
      const qrCodeBuffer = Buffer.from(
        qrCodeBase64.replace(/^data:image\/png;base64,/, ""),
        "base64"
      );
      const qrcodeURL = await uploadFileToS3(
        qrCodeBuffer,
        `${officerData.empId}.png`,
        "collectionofficer/QRcode"
      );
      console.log(qrcodeURL);

      // If no image URL, set it to null
      const imageUrl = profileImageUrl || null; // Use null if profileImageUrl is not provided

      const sql = `
                INSERT INTO collectionofficer (
                    companyId ,irmId ,firstNameEnglish, firstNameSinhala, firstNameTamil, lastNameEnglish,
                    lastNameSinhala, lastNameTamil, jobRole, empId, empType, phoneCode01, phoneNumber01, phoneCode02, phoneNumber02,
                    nic, email, houseNumber, streetName, city, district, province, country,
                    languages, accHolderName, accNumber, bankName, branchName, image, QRcode, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
                         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                         ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?, 'Not Approved')
            `;

      // Database query with QR image data added
      collectionofficer.query(
        sql,
        [
          officerData.companyId,
          officerData.irmId,
          officerData.firstNameEnglish,
          officerData.firstNameSinhala,
          officerData.firstNameTamil,
          officerData.lastNameEnglish,
          officerData.lastNameSinhala,
          officerData.lastNameTamil,
          officerData.jobRole,
          officerData.empId,
          officerData.empType,
          officerData.phoneCode01,
          officerData.phoneNumber01,
          officerData.phoneCode02,
          officerData.phoneNumber02,
          officerData.nic,
          officerData.email,
          officerData.houseNumber,
          officerData.streetName,
          officerData.city,
          officerData.district,
          officerData.province,
          officerData.country,
          officerData.languages,
          officerData.accHolderName,
          officerData.accNumber,
          officerData.bankName,
          officerData.branchName,
          imageUrl, // Use the potentially null image URL
          qrcodeURL,
        ],
        (err, results) => {
          if (err) {
            console.log(err);
            return reject(err); // Reject promise if an error occurs
          }
          resolve(results); // Resolve the promise with the query results
        }
      );
    } catch (error) {
      reject(error); // Reject if any error occurs during QR code generation
    }
  });
};

exports.updateCenterHeadDetails = (
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
) => {
  return new Promise((resolve, reject) => {
    let sql = `
             UPDATE collectionofficer
                SET companyId = ?, irmId = ?, firstNameEnglish = ?, lastNameEnglish = ?, firstNameSinhala = ?, lastNameSinhala = ?,
                    firstNameTamil = ?, lastNameTamil = ?, jobRole = ?, empId = ?, empType = ?, phoneCode01 = ?, phoneNumber01 = ?, phoneCode02 = ?, phoneNumber02 = ?,
                    nic = ?, email = ?, houseNumber = ?, streetName = ?, city = ?, district = ?, province = ?, country = ?, languages = ?,
                    accHolderName = ?, accNumber = ?, bankName = ?, branchName = ?, image = ?, status = 'Not Approved'
          `;
    let values = [
      companyId,
      irmId || null,
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
      profileImageUrl,
    ];

    sql += ` WHERE id = ?`;
    values.push(id);

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getAllCenterNamesDao = (district) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT CC.id, CC.regCode, CC.centerName
            FROM collectioncenter CC, companycenter COMC, company COM
            WHERE CC.id = COMC.centerId AND COMC.companyId = COM.id AND COM.isCollection = 1
            ORDER BY CC.centerName ASC;
        `;
    collectionofficer.query(sql, [district], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.getAllCenterManagerDao = () => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT id, centerName
            FROM collectioncenter
        `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.getAllCenterManagerDao = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, firstNameEnglish, lastNameEnglish
      FROM collectionofficer
      WHERE jobRole = 'Collection Center Manager';
    `;

    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.claimOfficerDetailsDao = (id, centerId, irmId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE collectionofficer
      SET centerId = ?, irmId = ?, claimStatus = 1
      WHERE id = ?
    `;
    collectionofficer.query(sql, [centerId, irmId, id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getPurchaseReport = (
  page,
  limit,
  centerId,
  startDate,
  endDate,
  search
) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    const params = [];
    const countParams = [];
    const totalParams = [];

    let countSql = `
      SELECT 
        COUNT(DISTINCT rfp.id) AS total
      FROM 
        registeredfarmerpayments rfp
      LEFT JOIN 
        farmerpaymentscrops fpc ON rfp.id = fpc.registerFarmerId
      JOIN 
        collectionofficer co ON rfp.collectionOfficerId = co.id
      JOIN 
        plant_care.users us ON rfp.userId = us.id
      JOIN 
        collectioncenter cc ON co.centerId = cc.id
      JOIN 
        company c ON co.companyId = c.id
      WHERE 
        c.id = 1
    `;

    let whereClause = "WHERE c.id = 1";

    if (centerId) {
      whereClause += " AND co.centerId = ?";
      params.push(centerId);
      countParams.push(centerId);
      totalParams.push(centerId);
    }

    if (startDate && endDate) {
      whereClause += " AND DATE(rfp.createdAt) BETWEEN ? AND ?";
      params.push(startDate, endDate);
      countParams.push(startDate, endDate);
      totalParams.push(startDate, endDate);
    } else if (startDate) {
      whereClause += " AND DATE(rfp.createdAt) >= ?";
      params.push(startDate);
      countParams.push(startDate);
      totalParams.push(startDate);
    } else if (endDate) {
      whereClause += " AND DATE(rfp.createdAt) <= ?";
      params.push(endDate);
      countParams.push(endDate);
      totalParams.push(endDate);
    }

    if (search) {
      whereClause += `
        AND (
          cc.regCode LIKE ? OR 
          cc.centerName LIKE ? OR 
          us.NICnumber LIKE ? OR 
          invNo LIKE ?
        )
      `;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      countParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
      totalParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    countSql = `
      SELECT 
        COUNT(DISTINCT rfp.id) AS total
      FROM 
        registeredfarmerpayments rfp
      LEFT JOIN 
        farmerpaymentscrops fpc ON rfp.id = fpc.registerFarmerId
      JOIN 
        collectionofficer co ON rfp.collectionOfficerId = co.id
      JOIN 
        plant_care.users us ON rfp.userId = us.id
      JOIN 
        collectioncenter cc ON co.centerId = cc.id
      JOIN 
        company c ON co.companyId = c.id
      ${whereClause}
    `;

    let grandTotalSql = `
      SELECT 
        ROUND(SUM(subquery.amount), 2) AS grandTotal
      FROM (
        SELECT 
          SUM(IFNULL(fpc.gradeAprice * fpc.gradeAquan, 0) + IFNULL(fpc.gradeBprice * fpc.gradeBquan, 0) + IFNULL(fpc.gradeCprice * fpc.gradeCquan, 0)) AS amount
        FROM 
          registeredfarmerpayments rfp
        LEFT JOIN 
          farmerpaymentscrops fpc ON rfp.id = fpc.registerFarmerId
        JOIN 
          collectionofficer co ON rfp.collectionOfficerId = co.id
        JOIN 
          plant_care.users us ON rfp.userId = us.id
        JOIN 
          collectioncenter cc ON co.centerId = cc.id
        JOIN 
          company c ON co.companyId = c.id
        ${whereClause}
        GROUP BY rfp.id
      ) AS subquery
    `;

    let dataSql = `
      SELECT 
        rfp.id AS id,
        invNo AS grnNumber,
        cc.regCode AS regCode,
        cc.centerName AS centerName,
        ROUND(SUM(IFNULL(fpc.gradeAprice * fpc.gradeAquan, 0) + IFNULL(fpc.gradeBprice * fpc.gradeBquan, 0) + IFNULL(fpc.gradeCprice * fpc.gradeCquan, 0)), 2) AS amount,
        us.firstName AS firstName,
        us.lastName AS lastName,
        us.NICnumber AS nic,
        us.id AS userId,
        co.QRcode AS collQr,
        rfp.createdAt AS createdAt
      FROM 
        registeredfarmerpayments rfp
      LEFT JOIN 
        farmerpaymentscrops fpc ON rfp.id = fpc.registerFarmerId
      JOIN 
        collectionofficer co ON rfp.collectionOfficerId = co.id
      JOIN 
        plant_care.users us ON rfp.userId = us.id
      JOIN 
        collectioncenter cc ON co.centerId = cc.id
      JOIN 
        company c ON co.companyId = c.id
      ${whereClause}
      GROUP BY rfp.id
      LIMIT ${limit} OFFSET ${offset}
    `;

    console.log("Executing Count Query...");
    collectionofficer.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      console.log("Executing Grand Total Query...");
      collectionofficer.query(
        grandTotalSql,
        totalParams,
        (grandTotalErr, grandTotalResults) => {
          if (grandTotalErr) {
            console.error("Error in grand total query:", grandTotalErr);
            return reject(grandTotalErr);
          }

          const grandTotal = grandTotalResults[0].grandTotal || 0;

          console.log("Executing Data Query...");
          collectionofficer.query(dataSql, params, (dataErr, dataResults) => {
            if (dataErr) {
              console.error("Error in data query:", dataErr);
              return reject(dataErr);
            }

            resolve({ items: dataResults, total, grandTotal });
          });
        }
      );
    });
  });
};

exports.downloadPurchaseReport = (centerId, startDate, endDate, search) => {
  return new Promise((resolve, reject) => {
    const params = [];
    const countParams = [];
    const totalParams = [];

    let whereClause = "WHERE c.id = 1";

    if (centerId) {
      whereClause += " AND co.centerId = ?";
      params.push(centerId);
      countParams.push(centerId);
      totalParams.push(centerId);
    }

    if (startDate && endDate) {
      whereClause += " AND DATE(rfp.createdAt) BETWEEN ? AND ?";
      params.push(startDate, endDate);
      countParams.push(startDate, endDate);
      totalParams.push(startDate, endDate);
    } else if (startDate) {
      whereClause += " AND DATE(rfp.createdAt) >= ?";
      params.push(startDate);
      countParams.push(startDate);
      totalParams.push(startDate);
    } else if (endDate) {
      whereClause += " AND DATE(rfp.createdAt) <= ?";
      params.push(endDate);
      countParams.push(endDate);
      totalParams.push(endDate);
    }

    if (search) {
      whereClause += `
        AND (
          cc.regCode LIKE ? OR 
          cc.centerName LIKE ? OR 
          us.NICnumber LIKE ? OR 
          invNo LIKE ?
        )
      `;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      countParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
      totalParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    let dataSql = `
      SELECT 
        invNo AS grnNumber,
        cc.regCode AS regCode,
        cc.centerName AS centerName,
        ROUND(SUM(IFNULL(fpc.gradeAprice * fpc.gradeAquan, 0) + IFNULL(fpc.gradeBprice * fpc.gradeBquan, 0) + IFNULL(fpc.gradeCprice * fpc.gradeCquan, 0)), 2) AS amount,
        us.firstName AS firstName,
        us.lastName AS lastName,
        us.NICnumber AS nic,
        us.phoneNumber AS phoneNumber,
        us.phoneNumber AS phoneNumber,
        ub.accHolderName AS accHolderName,
        ub.accNumber AS accNumber,
        ub.bankName AS bankName,
        ub.branchName AS branchName,
        co.empId AS empId,
        TIME(rfp.createdAt) AS createdAt,
        DATE(rfp.createdAt) AS createdDate
      FROM 
        registeredfarmerpayments rfp
      LEFT JOIN 
        farmerpaymentscrops fpc ON rfp.id = fpc.registerFarmerId
      JOIN 
        collectionofficer co ON rfp.collectionOfficerId = co.id
      JOIN 
        plant_care.users us ON rfp.userId = us.id
      JOIN 
        collectioncenter cc ON co.centerId = cc.id
      JOIN 
        company c ON co.companyId = c.id
      LEFT JOIN 
        plant_care.userbankdetails ub ON us.id = ub.userId
      ${whereClause}
      GROUP BY 
      rfp.id,
      invNo,
      cc.regCode,
      cc.centerName,
      us.firstName,
      us.lastName,
      us.NICnumber,
      us.phoneNumber,
      ub.accHolderName,
      ub.accNumber,
      ub.bankName,
      ub.branchName,
      co.empId,
      rfp.createdAt
    `;

    console.log("Executing Count Query...");

    collectionofficer.query(dataSql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getAllCentersForPurchaseReport = () => {
  return new Promise((resolve, reject) => {
    const sql = `
        SELECT clc.id, 
        clc.centerName As centerName,
        clc.regCode As regCode
        FROM companycenter cc
        JOIN collectioncenter clc ON cc.centerId = clc.id
        WHERE cc.companyId = 1
        GROUP BY cc.centerId
        `;

    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getCollectionReport = (
  page,
  limit,
  centerId,
  startDate,
  endDate,
  search
) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let whereClause = `WHERE c.id = 1`;
    const params = [];
    const countParams = [];

    if (centerId) {
      whereClause += ` AND co.centerId = ?`;
      params.push(centerId);
      countParams.push(centerId);
    }

    if (startDate && endDate) {
      whereClause += " AND DATE(rfp.createdAt) BETWEEN ? AND ?";
      params.push(startDate, endDate);
      countParams.push(startDate, endDate);
    } else if (startDate) {
      whereClause += " AND DATE(rfp.createdAt) >= ?";
      params.push(startDate);
      countParams.push(startDate);
    } else if (endDate) {
      whereClause += " AND DATE(rfp.createdAt) <= ?";
      params.push(endDate);
      countParams.push(endDate);
    }

    if (search) {
      whereClause += `
        AND (
          cc.regCode LIKE ? OR 
          cc.centerName LIKE ? OR 
          cg.cropNameEnglish LIKE ? OR
          cv.varietyNameEnglish LIKE ?
        )
      `;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      countParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    const countSql = `
      SELECT 
        COUNT(DISTINCT fpc.id) AS total
      FROM 
        farmerpaymentscrops fpc
      JOIN registeredfarmerpayments rfp ON fpc.registerFarmerId = rfp.id
      JOIN collectionofficer co ON rfp.collectionOfficerId = co.id
      JOIN plant_care.users us ON rfp.userId = us.id
      JOIN collectioncenter cc ON co.centerId = cc.id
      JOIN company c ON co.companyId = c.id
      JOIN plant_care.cropvariety cv ON fpc.cropId = cv.id
      JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      ${whereClause}
    `;

    const dataSql = `
      SELECT 
        fpc.id AS id,
        cc.regCode AS regCode,
        cc.centerName AS centerName,
        cg.cropNameEnglish AS cropGroupName,
        cv.varietyNameEnglish AS varietyName,
        fpc.gradeAquan AS gradeAquan,
        fpc.gradeBquan AS gradeBquan,
        fpc.gradeCquan AS gradeCquan,
        SUM(IFNULL(fpc.gradeAquan, 0) + IFNULL(fpc.gradeBquan, 0) + IFNULL(fpc.gradeCquan, 0)) AS amount,
        fpc.createdAt AS createdAt
      FROM 
        farmerpaymentscrops fpc
      JOIN registeredfarmerpayments rfp ON fpc.registerFarmerId = rfp.id
      JOIN collectionofficer co ON rfp.collectionOfficerId = co.id
      JOIN plant_care.users us ON rfp.userId = us.id
      JOIN collectioncenter cc ON co.centerId = cc.id
      JOIN company c ON co.companyId = c.id
      JOIN plant_care.cropvariety cv ON fpc.cropId = cv.id
      JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      ${whereClause}
      GROUP BY fpc.id
      LIMIT ? OFFSET ?
    `;

    // Add limit and offset to the end of params
    params.push(parseInt(limit), parseInt(offset));

    console.log("Executing Count Query...");
    collectionofficer.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0]?.total || 0;

      console.log("Executing Data Query...");
      collectionofficer.query(dataSql, params, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }

        resolve({
          items: dataResults,
          total,
        });
      });
    });
  });
};

exports.downloadCollectionReport = (centerId, startDate, endDate, search) => {
  return new Promise((resolve, reject) => {
    const params = [];
    const countParams = [];
    const totalParams = [];

    let whereClause = "WHERE c.id = 1";

    if (centerId) {
      whereClause += " AND co.centerId = ?";
      params.push(centerId);
      countParams.push(centerId);
      totalParams.push(centerId);
    }

    if (startDate && endDate) {
      whereClause += " AND DATE(rfp.createdAt) BETWEEN ? AND ?";
      params.push(startDate, endDate);
      countParams.push(startDate, endDate);
      totalParams.push(startDate, endDate);
    } else if (startDate) {
      whereClause += " AND DATE(rfp.createdAt) >= ?";
      params.push(startDate);
      countParams.push(startDate);
      totalParams.push(startDate);
    } else if (endDate) {
      whereClause += " AND DATE(rfp.createdAt) <= ?";
      params.push(endDate);
      countParams.push(endDate);
      totalParams.push(endDate);
    }

    if (search) {
      whereClause += `
        AND (
          cc.regCode LIKE ? OR 
          cc.centerName LIKE ? OR 
          cg.cropNameEnglish LIKE ? OR
          cv.varietyNameEnglish LIKE ?
        )
      `;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      countParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
      totalParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    let dataSql = `
      SELECT 
        fpc.id AS id,
        cc.regCode AS regCode,
        cc.centerName AS centerName,
        cg.cropNameEnglish AS cropGroupName,
        cv.varietyNameEnglish AS varietyName,
        fpc.gradeAquan AS gradeAquan,
        fpc.gradeBquan AS gradeBquan,
        fpc.gradeCquan AS gradeCquan,
        SUM(IFNULL(fpc.gradeAquan, 0) + IFNULL(fpc.gradeBquan, 0) + IFNULL(fpc.gradeCquan, 0)) AS amount,
        fpc.createdAt AS createdAt
      FROM 
        farmerpaymentscrops fpc
      JOIN registeredfarmerpayments rfp ON fpc.registerFarmerId = rfp.id
      JOIN collectionofficer co ON rfp.collectionOfficerId = co.id
      JOIN plant_care.users us ON rfp.userId = us.id
      JOIN collectioncenter cc ON co.centerId = cc.id
      JOIN company c ON co.companyId = c.id
      JOIN plant_care.cropvariety cv ON fpc.cropId = cv.id
      JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      ${whereClause}
      GROUP BY fpc.id
    `;

    console.log("Executing Count Query...");

    collectionofficer.query(dataSql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getCCIDforCreateEmpIdDao = (employee) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT empId 
      FROM collectionofficer
      WHERE jobRole = ?
      ORDER BY 
        CAST(SUBSTRING(empId FROM 4) AS UNSIGNED) DESC
      LIMIT 1
    `;
    const values = [employee];

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length === 0) {
        if (employee === "Collection Center Head") {
          return resolve("CCH00001");
        } else if (employee === "Collection Center Manager") {
          return resolve("CCM00001");
        } else if (employee === "Collection Officer") {
          return resolve("COO00001");
        }
      }

      const highestId = results[0].empId;

      // Extract the numeric part
      const prefix = highestId.substring(0, 3); // Get "CCM"
      const numberStr = highestId.substring(3); // Get "00007"
      const number = parseInt(numberStr, 10); // Convert to number 7

      // Increment and format back to 5 digits
      const nextNumber = number + 1;
      const nextId = `${prefix}${nextNumber.toString().padStart(5, "0")}`; // "CCM00008"

      resolve(nextId);
    });
  });
};

exports.getFarmerInvoiceDetailsDao = (invNo) => {
  return new Promise((resolve, reject) => {
    let sql = `
        SELECT RFP.id, U.firstName, U.lastName, U.phoneNumber, U.NICnumber, U.houseNo, U.streetName, U.city, U.district, UB.accNumber, UB.accHolderName, UB.bankName, UB.branchName, RFP.createdAt, CO.QRcode AS officerQr, U.farmerQr, RFP.invNo 
        FROM farmerpaymentscrops FPC, registeredfarmerpayments RFP, plant_care.users U, collectionofficer CO, plant_care.userbankdetails UB 
        WHERE FPC.registerFarmerId = RFP.id AND RFP.userId = U.id AND U.id = UB.userId AND RFP.collectionOfficerId = CO.id AND RFP.invNo = ?
            LIMIT 1
            `;


    collectionofficer.query(sql, [invNo], (err, results) => {
      if (err) {

        return reject(err);
      }
      resolve(results);
    });
  });
};


exports.getFarmerCropsInvoiceDetailsDao = (invNo) => {
  return new Promise((resolve, reject) => {
    const sql = `
        SELECT RFP.id, CG.cropNameEnglish, CV.varietyNameEnglish, FPC.gradeAprice, FPC.gradeBprice, FPC.gradeCprice, FPC.gradeAquan, FPC.gradeBquan, FPC.gradeCquan
        FROM registeredfarmerpayments RFP, farmerpaymentscrops FPC, plant_care.cropvariety CV, plant_care.cropgroup CG
        WHERE FPC.registerFarmerId = RFP.id AND FPC.cropId = CV.id AND CV.cropGroupId = CG.id AND RFP.invNo = ?
            `;


    collectionofficer.query(sql, [invNo], (err, results) => {
      if (err) {

        return reject(err);
      }
      resolve(results);
    });
  });
};


exports.getCollectionCenterForReportDao = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT cen.centerName
      FROM company c
      JOIN companycenter cc ON c.id = cc.companyId
      JOIN collectioncenter cen ON cc.centerId = cen.id
      WHERE c.isCollection = 1
      GROUP BY cen.centerName
      ORDER BY cen.centerName
    `;


    collectionofficer.query(sql, (err, results) => {
      if (err) {

        return reject(err);
      }
      resolve(results);
    });
  });
};
