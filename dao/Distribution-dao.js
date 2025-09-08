const {
  plantcare,
  collectionofficer,
  marketPlace,
  dash,
} = require("../startup/database");
const { error } = require("console");
const Joi = require("joi");
const path = require("path");
const QRCode = require("qrcode");
const uploadFileToS3 = require("../middlewares/s3upload");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

exports.checkExistingDistributionCenter = (checkData) => {
  return new Promise((resolve, reject) => {
    const { name, regCode, contact01, excludeId } = checkData;

    let sql = `
      SELECT 
        id,
        centerName,
        regCode,
        contact01,
        CASE 
          WHEN centerName = ? THEN 'name'
          WHEN regCode = ? THEN 'regCode'
          WHEN contact01 = ? THEN 'contact'
        END as conflictType
      FROM distributedcenter 
      WHERE (centerName = ? OR regCode = ? OR contact01 = ?)
    `;

    const values = [name, regCode, contact01, name, regCode, contact01];

    // Add exclusion for update operations
    if (excludeId) {
      sql += ` AND id != ?`;
      values.push(excludeId);
    }

    sql += ` LIMIT 1`;

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        console.error("Error checking existing distribution center:", err);
        return reject(err);
      }

      if (results.length > 0) {
        const conflict = results[0];
        let message = "";

        switch (conflict.conflictType) {
          case "name":
            message = "A distribution center with this name already exists.";
            break;
          case "regCode":
            message =
              "A distribution center with this registration code already exists.";
            break;
          case "contact":
            message =
              "A distribution center with this contact number already exists.";
            break;
          default:
            message =
              "A distribution center with these details already exists.";
        }

        resolve({
          exists: true,
          message: message,
          conflictingRecord: conflict,
        });
      } else {
        resolve({
          exists: false,
          message: null,
        });
      }
    });
  });
};

exports.createDistributionCenter = (data) => {
  return new Promise((resolve, reject) => {
    const sql1 = `
      INSERT INTO distributedcenter 
      (centerName, contact01, code1, contact02, code2, latitude, longitude, email, country, province, district, city, regCode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values1 = [
      data.name,
      data.contact1,
      data.contact1Code,
      data.contact2,
      data.contact2Code,
      data.latitude,
      data.longitude,
      data.email,
      data.country,
      data.province,
      data.district,
      data.city,
      data.regCode,
    ];

    // First insert into distributedcenter
    collectionofficer.query(sql1, values1, (err, result1) => {
      if (err) {
        console.error("Error inserting distribution center:", err);
        return reject(err);
      }

      const centerId = result1.insertId; // Get the inserted center's ID
      const companyId = data.company; // Get the company ID from request data

      const sql2 = `
        INSERT INTO distributedcompanycenter (companyId, centerId)
        VALUES (?, ?)
      `;

      const values2 = [companyId, centerId];

      // Then insert into distributedcompanycenter
      collectionofficer.query(sql2, values2, (err, result2) => {
        if (err) {
          console.error("Error inserting into distributedcompanycenter:", err);
          return reject(err);
        }

        resolve({
          centerInsertResult: result1,
          companyMappingResult: result2,
        });
      });
    });
  });
};

exports.getAllDistributionCentre = (
  limit,
  offset,
  district,
  province,
  company,
  searchItem,
  centerType,
  city // Add city parameter
) => {
  return new Promise((resolve, reject) => {
    let countSql = `
      SELECT COUNT(*) as total FROM collection_officer.distributedcenter dc
      LEFT JOIN collection_officer.distributedcompanycenter dcc ON dc.id = dcc.centerId
      JOIN collection_officer.company c ON dcc.companyId = c.id
    `;
    let sql = `
        SELECT 
            dc.id,
            dcc.id AS companyCenerId,
            dc.centerName,
            dc.code1,
            dc.contact01,
            dc.code2,
            dc.contact02,
            dc.city,
            dc.district,
            dc.province,
            dc.country,
            dc.longitude,
            dc.latitude,
            dc.regCode,
            c.companyNameEnglish AS companyName
            FROM collection_officer.distributedcenter dc
            LEFT JOIN collection_officer.distributedcompanycenter dcc ON dc.id = dcc.centerId
            JOIN collection_officer.company c ON dcc.companyId = c.id
            
      `;

    let whereClause = " WHERE 1=1 ";
    const searchParams = [];

    if (centerType === "polygon") {
      whereClause += " AND dcc.companyId = 2 AND c.isDistributed = 1 ";
    } else {
      whereClause += " AND dcc.companyId != 2 AND c.isDistributed = 1 ";
    }

    if (searchItem) {
      const searchQuery = `%${searchItem}%`;
      whereClause +=
        " AND (dc.centerName LIKE ? OR c.companyNameEnglish LIKE ? OR dc.city LIKE ?)"; // Added city to search
      searchParams.push(searchQuery, searchQuery, searchQuery);
    }

    if (district) {
      whereClause += " AND dc.district = ?";
      searchParams.push(district);
    }

    if (province) {
      whereClause += " AND dc.province = ?";
      searchParams.push(province);
    }

    if (city) {
      // Add city filter
      whereClause += " AND dc.city = ?";
      searchParams.push(city);
    }

    if (company) {
      whereClause += " AND c.companyNameEnglish = ?";
      searchParams.push(company);
    }

    // Add where clause to both count and main SQL
    countSql += whereClause;
    sql += whereClause + " ORDER BY dcc.createdAt ASC LIMIT ? OFFSET ?";
    const dataParams = [...searchParams, limit, offset];

    collectionofficer.query(
      countSql,
      searchParams,
      (countErr, countResults) => {
        if (countErr) {
          return reject(countErr);
        }

        const total = countResults[0].total;

        collectionofficer.query(sql, dataParams, (dataErr, dataResults) => {
          if (dataErr) {
            return reject(dataErr);
          }
          console.log(sql, "SQL Query executed successfully");

          resolve({
            total: total,
            items: dataResults,
          });
        });
      }
    );
  });
};

exports.getAllCompanyDAO = (searchTerm, centerId) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        c.id, c.id AS companyId,
        c.companyNameEnglish,
        c.email AS companyEmail,
        c.logo,
        c.status,
        c.favicon,
        c.foName,
        c.oicConCode1 AS code1,
        c.oicConNum1 AS contact01,
        c.oicConCode2 AS code2,
        c.oicConNum2 AS contact02,
        (
          SELECT COUNT(*) 
          FROM collection_officer.distributedcompanycenter dcc2 
          WHERE dcc2.companyId = c.id
        ) AS ownedCentersCount,
        (
          SELECT COUNT(*) 
          FROM collection_officer.collectionofficer co
          WHERE co.companyId = c.id 
          AND co.companyId = c.id 
          AND co.jobRole = 'Distribution Center Manager'
        ) AS managerCount,
        (
          SELECT COUNT(*) 
          FROM collection_officer.collectionofficer co
          WHERE co.companyId = c.id 
          AND co.companyId = c.id 
          AND co.jobRole = 'Distribution Officer'
        ) AS officerCount
      FROM 
        collection_officer.company c
      WHERE 
        c.isDistributed = 1
    `;

    const params = [];

    if (searchTerm && searchTerm.trim()) {
      sql += " AND (c.companyNameEnglish LIKE ? OR c.email LIKE ?)";
      const trimmed = `%${searchTerm.trim()}%`;
      params.push(trimmed, trimmed);
    }

    if (centerId) {
      sql += " AND dcc.centerId = ?";
      params.push(centerId);
    }

    collectionofficer.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.deleteCompanyById = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM company WHERE id = ?";
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows); // Return the number of affected rows
      }
    });
  });
};

exports.getAllDistributionCentreHead = (
  companyId,
  limit,
  offset,
  searchText
) => {
  return new Promise((resolve, reject) => {
    let countSql = `SELECT COUNT(*) AS total FROM collectionofficer co WHERE co.companyId = ? AND co.jobRole = 'Distribution Center Head'`;
    let dataSql = `SELECT 
        co.id,
        co.empId,
        co.firstNameEnglish,
        co.lastNameEnglish,
        co.email,
        co.status,
        co.phoneCode01,
        co.phoneNumber01,
        co.phoneCode02,
        co.phoneNumber02,
        co.createdAt FROM collectionofficer co WHERE co.companyId = ? AND co.jobRole = 'Distribution Center Head'`;
    const countParams = [companyId];
    const dataParams = [companyId];

    if (searchText) {
      const searchCondition = ` AND (co.firstNameEnglish LIKE ? OR co.lastNameEnglish LIKE ? OR co.email LIKE ?)`;
      countSql += searchCondition;
      dataSql += searchCondition;
      const searchValue = `%${searchText}%`;
      countParams.push(searchValue, searchValue, searchValue);
      dataParams.push(searchValue, searchValue, searchValue);
    }

    limit = parseInt(limit, 10) || 10;
    offset = parseInt(offset, 10) || 0;

    dataSql += ` ORDER BY co.createdAt DESC LIMIT ? OFFSET ?`;
    dataParams.push(limit, offset); // Add limit and offset to parameters

    collectionofficer.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        reject(countErr);
      } else {
        collectionofficer.query(dataSql, dataParams, (dataErr, dataResults) => {
          if (dataErr) {
            reject(dataErr);
          } else {
            resolve({
              total: countResults[0].total,
              items: dataResults,
            });
          }
        });
      }
    });
  });
};

exports.getCompanyDAO = () => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
      c.id,
      c.companyNameEnglish
      FROM 
        company c
      WHERE c.status = 1 AND c.isDistributed = true
      ORDER BY c.companyNameEnglish ASC
    `;

    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      console.log("Company names retrieved successfully");
      console.log(results);
      resolve(results);
    });
  });
};

exports.getCompanyDetails = () => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        c.companyNameEnglish, c.id
      FROM 
        company c
      WHERE c.status = 1 AND c.isDistributed = true
      ORDER BY c.companyNameEnglish ASC 
    `;

    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      console.log("Company names retrieved successfully");
      console.log(results);
      resolve(results);
    });
  });
};

exports.createDistributionHeadPersonal = (
  officerData,
  profileImageUrl,
  newEmpId
) => {
  return new Promise(async (resolve, reject) => {
    try {
      const imageUrl = profileImageUrl || null;

      const sql = `
                INSERT INTO collectionofficer (
                    centerId, companyId, irmId, firstNameEnglish, lastNameEnglish,
                    jobRole, empId, empType, phoneCode01, phoneNumber01, phoneCode02, phoneNumber02,
                    nic, email, houseNumber, streetName, city, district, province, country,
                    languages, accHolderName, accNumber, bankName, branchName, image, QRcode, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Approved')
            `;

      collectionofficer.query(
        sql,
        [
          officerData.centerId,
          officerData.companyId,
          officerData.irmId,
          officerData.firstNameEnglish,
          officerData.lastNameEnglish,
          officerData.jobRole,
          // officerData.empId,
          newEmpId,
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
          imageUrl,
          null, // QRcode field set to null
        ],
        (err, results) => {
          if (err) {
            console.log(err);
            return reject(err);
          }
          resolve(results);
        }
      );
    } catch (error) {
      reject(error);
    }
  });
};

exports.checkNICExist = (nic) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT COUNT(*) AS count 
            FROM collectionofficer 
            WHERE nic = ?
        `;

    collectionofficer.query(sql, [nic], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].count > 0);
    });
  });
};

exports.checkEmailExist = (email) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT COUNT(*) AS count 
            FROM collectionofficer 
            WHERE email = ?
        `;

    collectionofficer.query(sql, [email], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].count > 0); // Return true if either NIC or email exists
    });
  });
};

exports.checkPhoneExist = (phoneNumber) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS count 
      FROM collectionofficer 
      WHERE phoneNumber01 = ? OR phoneNumber02 = ?
    `;

    collectionofficer.query(sql, [phoneNumber, phoneNumber], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].count > 0); // Return true if the phone number exists in either column
    });
  });
};

exports.checkNICExistExceptId = (nic, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS count 
      FROM collectionofficer 
      WHERE nic = ? AND id != ?
    `;
    collectionofficer.query(sql, [nic, id], (err, results) => {
      if (err) return reject(err);
      resolve(results[0].count > 0);
    });
  });
};

exports.checkEmailExistExceptId = (email, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS count 
      FROM collectionofficer 
      WHERE email = ? AND id != ?
    `;
    collectionofficer.query(sql, [email, id], (err, results) => {
      if (err) return reject(err);
      resolve(results[0].count > 0);
    });
  });
};

exports.checkPhoneExistExceptId = (phone, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS count 
      FROM collectionofficer 
      WHERE (phoneNumber01 = ? OR phoneNumber02 = ?) AND id != ?
    `;
    collectionofficer.query(sql, [phone, phone, id], (err, results) => {
      if (err) return reject(err);
      resolve(results[0].count > 0);
    });
  });
};

exports.GetAllCompanyList = () => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT id, companyNameEnglish FROM company WHERE company.isDistributed = 1 ORDER BY companyNameEnglish ASC";
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.GetDistributedCenterByCompanyIdDAO = (companyId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT dc.* 
      FROM distributedcenter dc
      JOIN distributedcompanycenter dcc ON dc.id = dcc.centerId
      WHERE dcc.companyId = ?
    `;
    collectionofficer.query(sql, [companyId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.DeleteDistributionHeadDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
            DELETE FROM collectionofficer
            WHERE id = ?
        `;
    collectionofficer.query(sql, [parseInt(id)], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.GetDistributionHeadDetailsByIdDao = (id) => {
  console.log("id", id);

  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        id, companyId, irmId, firstNameEnglish, lastNameEnglish, jobRole, empId, empType,
        phoneCode01, phoneNumber01, phoneCode02, phoneNumber02, nic, email,
        houseNumber, streetName, city, district, province, country, languages,
        accHolderName, accNumber, bankName, branchName, image, status,
        claimStatus, onlineStatus
      FROM 
        collectionofficer
      WHERE id = ?
    `;

    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      console.log("Distribution Head details retrieved successfully");
      console.log("Details:", results[0]);
      resolve(results[0]);
    });
  });
};

exports.UpdateDistributionHeadDao = (id, updateData) => {
  console.log("id", id);
  console.log("updateData", updateData);

  return new Promise((resolve, reject) => {
    let sql = `
      UPDATE collectionofficer
      SET 
        companyId = ?, irmId = ?, firstNameEnglish = ?, lastNameEnglish = ?, 
        jobRole = ?, empId = ?, empType = ?, phoneCode01 = ?, phoneNumber01 = ?, 
        phoneCode02 = ?, phoneNumber02 = ?, nic = ?, email = ?, houseNumber = ?, 
        streetName = ?, city = ?, district = ?, province = ?, country = ?, 
        languages = ?, accHolderName = ?, accNumber = ?, bankName = ?, 
        branchName = ?, image = ?, status = ?, claimStatus = ?, onlineStatus = ?
      WHERE id = ?
    `;

    const values = [
      updateData.companyId,
      updateData.irmId,
      updateData.firstNameEnglish,
      updateData.lastNameEnglish,
      updateData.jobRole,
      updateData.empId,
      updateData.empType,
      updateData.phoneCode01,
      updateData.phoneNumber01,
      updateData.phoneCode02,
      updateData.phoneNumber02,
      updateData.nic,
      updateData.email,
      updateData.houseNumber,
      updateData.streetName,
      updateData.city,
      updateData.district,
      updateData.province,
      updateData.country,
      updateData.languages,
      updateData.accHolderName,
      updateData.accNumber,
      updateData.bankName,
      updateData.branchName,
      updateData.image,
      updateData.status,
      updateData.claimStatus,
      updateData.onlineStatus,
      id,
    ];

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }
      console.log("Collection Officer details updated successfully");
      console.log("Affected rows:", results.affectedRows);
      resolve(results);
    });
  });
};

exports.getDistributionCentreById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        dc.id,
        dc.centerName,
        dc.regCode,
        dc.code1,
        dc.contact01,
        dc.code2,
        dc.contact02,
        dc.city,
        dc.district,
        dc.province,
        dc.country,
        dc.longitude,
        dc.latitude,
        dc.email,
        dc.createdAt,
        c.companyNameEnglish
      FROM distributedcenter dc
      LEFT JOIN distributedcompanycenter dcc ON dc.id = dcc.centerId
      LEFT JOIN company c ON dcc.companyId = c.id
      WHERE dc.id = ?
    `;

    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length === 0) {
        return resolve(null);
      }

      resolve(results[0]);
    });
  });
};

exports.deleteDistributedCenterDao = (id) => {
  return new Promise((resolve, reject) => {
    let sql = `
      DELETE FROM distributedcenter
      WHERE id = ?
    `;
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      console.log("Collection Officer details updated successfully");
      console.log("Affected rows:", results.affectedRows);
      resolve(results);
    });
  });
};

exports.updateDistributionCentreById = (id, updateData) => {
  return new Promise((resolve, reject) => {
    console.log("Starting update for distribution center ID:", id);
    console.log("Update data received:", updateData);

    // Extract fields from updateData
    const {
      centerName,
      code1,
      contact01,
      code2,
      contact02,
      city,
      district,
      province,
      country,
      longitude,
      latitude,
      email,
      companyNameEnglish,
      companyId,
      regCode,
    } = updateData;

    // Update distribution center SQL
    const updateCenterSql = `
      UPDATE distributedcenter 
      SET 
        centerName = ?,
        code1 = ?,
        contact01 = ?,
        code2 = ?,
        contact02 = ?,
        city = ?,
        district = ?,
        province = ?,
        country = ?,
        longitude = ?,
        latitude = ?,
        email = ?,
        regCode = ?
      WHERE id = ?
    `;

    const centerParams = [
      centerName,
      code1,
      contact01,
      code2,
      contact02,
      city,
      district,
      province,
      country,
      longitude,
      latitude,
      email,
      regCode,
      id,
    ];

    console.log("Executing center update with:", updateCenterSql, centerParams);

    // Execute distribution center update
    collectionofficer.query(
      updateCenterSql,
      centerParams,
      (err, centerResults) => {
        if (err) {
          console.error("Error updating distribution center:", err);
          return reject(err);
        }

        console.log("Center update results:", centerResults);

        if (centerResults.affectedRows === 0) {
          console.log("No rows affected in center update");
          return resolve(null);
        }

        // Update company if information is provided
        if (companyNameEnglish && companyId) {
          const updateCompanySql = `
          UPDATE company
          SET companyNameEnglish = ?
          WHERE id = ?
        `;

          console.log("Executing company update with:", updateCompanySql, [
            companyNameEnglish,
            companyId,
          ]);

          collectionofficer.query(
            updateCompanySql,
            [companyNameEnglish, companyId],
            (err, companyResults) => {
              if (err) {
                console.error("Error updating company:", err);
                return reject(err);
              }

              console.log("Company update results:", companyResults);

              if (companyResults.affectedRows === 0) {
                console.log("No rows affected in company update");
                return resolve(null);
              }

              console.log("Updates completed successfully");
              exports
                .getDistributionCentreById(id)
                .then((updatedCenter) => resolve(updatedCenter))
                .catch((error) => reject(error));
            }
          );
        } else {
          console.log("No company update needed");
          exports
            .getDistributionCentreById(id)
            .then((updatedCenter) => resolve(updatedCenter))
            .catch((error) => reject(error));
        }
      }
    );
  });
};

exports.DeleteDistributionCenter = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
            DELETE FROM distributedcenter
            WHERE id = ?
        `;
    collectionofficer.query(sql, [parseInt(id)], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.generateRegCode = (province, district, city, callback) => {
  // Generate the prefix based on province and district
  const prefix =
    province.slice(0, 2).toUpperCase() +
    district.slice(0, 1).toUpperCase() +
    city.slice(0, 1).toUpperCase();

  // SQL query to get the latest regCode
  const query = `SELECT regCode FROM distributedcenter WHERE regCode LIKE ? ORDER BY regCode DESC LIMIT 1`;

  // Execute the query
  collectionofficer.execute(query, [`${prefix}-%`], (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      return callback(err);
    }

    let newRegCode = `${prefix}-01`; // Default to 01 if no regCode found

    if (results.length > 0) {
      // Get the last regCode and extract the number
      const lastRegCode = results[0].regCode;
      const lastNumber = parseInt(lastRegCode.split("-")[1]);
      const newNumber = lastNumber + 1;
      newRegCode = `${prefix}-${String(newNumber).padStart(2, "0")}`;
    }

    // Return the new regCode
    callback(null, newRegCode);
  });
};

exports.GetDistributionCenterByName = (name) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT centerName FROM distributedcenter
            WHERE centerName = ?
        `;
    collectionofficer.query(sql, [name], (err, results) => {
      if (err) {
        return reject(err);
      }
      // Return all matching records (since multiple centers might have same name)
      resolve(results);
    });
  });
};

exports.getDistributedIdforCreateEmpIdDao = (employee) => {
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
        if (employee === "Distribution Center Head") {
          return resolve("DCH00001");
        } else if (employee === "Distribution Center Manager") {
          return resolve("DCM00001");
        } else if (employee === "Distribution Officer") {
          return resolve("CIO00001");
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

exports.getAllDistributionOfficers = (
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
            LEFT JOIN distributedcenter dc ON coff.centerId = dc.id
            WHERE coff.jobRole IN ('Distribution Center Manager', 'Distribution Officer') AND cm.id = 2
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
                dc.centerName
            FROM collectionofficer coff
            JOIN company cm ON coff.companyId = cm.id
            LEFT JOIN distributedcenter dc ON coff.centerId = dc.id
            WHERE coff.jobRole IN ('Distribution Center Manager', 'Distribution Officer') AND cm.id = 2
        `;

    const countParams = [];
    const dataParams = [];

    if (companyid) {
      countSql += " AND cm.id = ?";
      dataSql += " AND cm.id = ?";
      countParams.push(companyid);
      dataParams.push(companyid);
    }

    if (centerStatus) {
      // Convert centerStatus to corresponding numeric value
      let claimStatusValue;
      if (centerStatus === "Claimed") {
        claimStatusValue = 1;
      } else if (centerStatus === "Disclaimed") {
        claimStatusValue = 0;
      }

      console.log("this is claimstatus value", claimStatusValue);

      // Apply filter only if it's a valid value
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

    // Apply search filters for NIC or related fields
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
                    OR dc.centerName LIKE ?
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

    // Modified ORDER BY clause: DCM first, then Distribution Officers, then by EMP ID
    dataSql += ` 
      ORDER BY 
        CASE 
          WHEN coff.jobRole = 'Distribution Center Manager' THEN 1 
          WHEN coff.jobRole = 'Distribution Officer' THEN 2 
          ELSE 3 
        END,
        coff.empId ASC
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

exports.getAllDistributionCenterNamesDao = (district) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT DC.id, DC.regCode, DC.centerName
            FROM distributedcenter DC, distributedcompanycenter DCOMC, company COM
            WHERE DC.id = DCOMC.centerId AND DCOMC.companyId = COM.id AND COM.isDistributed = 1;
        `;
    collectionofficer.query(sql, [district], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.getAllDistributionCenterManagerDao = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, firstNameEnglish, lastNameEnglish
      FROM collectionofficer
      WHERE jobRole = 'Distribution Center Manager';
    `;

    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve the promise with the query results
    });
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

exports.DeleteDistributionOfficerDao = (id) => {
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

exports.getDistributionOfficerEmailDao = (id) => {
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

exports.UpdateDistributionOfficerStatusAndPasswordDao = (params) => {
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
    doc.on("end", () => {});

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

exports.getAllCompanyNamesDao = (district) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT id, companyNameEnglish
            FROM company
            WHERE isDistributed = 1;
        `;
    collectionofficer.query(sql, [district], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.checkPhoneNumberExist = async (phoneNumber, excludeId = null) => {
  console.log("officer", excludeId);
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

exports.getDCIDforCreateEmpIdDao = (employee) => {
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
        if (employee === "Distribution Center Head") {
          return resolve("DCH00001");
        } else if (employee === "Distribution Center Manager") {
          return resolve("DCM00001");
        } else if (employee === "Distribution Officer") {
          return resolve("DIO00001");
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

exports.createDistributionOfficerPersonal = (
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
      if (
        officerData.jobRole === "Distribution Center Manager" ||
        officerData.jobRole === "Distribution Officer"
      ) {
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

exports.GetDistributionCentersByCompanyIdDAO = (companyId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT dc.* 
      FROM distributedcenter dc
      JOIN distributedcompanycenter dcc ON dc.id = dcc.centerId
      WHERE dcc.companyId = ?
      ORDER BY dc.centerName ASC
    `;
    collectionofficer.query(sql, [companyId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.GetAllDistributionManagerList = (companyId, centerId) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT id, firstNameEnglish, lastNameEnglish FROM collectionofficer WHERE companyId = ? AND centerId = ?";
    collectionofficer.query(sql, [companyId, centerId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getForCreateId = (role) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT empId FROM collectionofficer WHERE empId LIKE ? ORDER BY empId DESC LIMIT 1";
    collectionofficer.query(sql, [`${role}%`], (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length > 0) {
        const numericPart = parseInt(results[0].empId.substring(3), 10);

        const incrementedValue = numericPart + 1;

        results[0].empId = incrementedValue.toString().padStart(5, "0");
      }

      resolve(results);
    });
  });
};

exports.getAssigningForDistributedCentersDao = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        dcc.id,
        dc.regCode,
        coc.cityId AS ownCityId
      FROM distributedcompanycenter dcc
      JOIN company c ON dcc.companyId = c.id
      JOIN distributedcenter dc ON dcc.centerId = dc.id
      LEFT JOIN centerowncity coc ON dcc.id = coc.companyCenterId
      WHERE c.isDistributed = 1
      `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        console.log(err);
        return reject(err);
      }

      resolve(results);
    });
  });
};

exports.getAssigningForCityDao = (provine, district) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        id,
        city
      FROM deliverycharge
      WHERE province = ? AND district = ?
      `;
    collectionofficer.query(sql, [provine, district], (err, results) => {
      if (err) {
        return reject(err);
      }

      resolve(results);
    });
  });
};

exports.assignCityToDistributedCenterDao = (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO centerowncity (companyCenterId, cityId)
      VALUES (?, ?)
      `;
    collectionofficer.query(
      sql,
      [data.centerId, data.cityId],
      (err, results) => {
        if (err) {
          console.log(err);
          return reject(err);
        }

        resolve(results);
      }
    );
  });
};

exports.removeAssignCityToDistributedCenterDao = (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
      DELETE FROM centerowncity 
      WHERE companyCenterId = ? AND cityId = ?
      `;
    collectionofficer.query(
      sql,
      [data.centerId, data.cityId],
      (err, results) => {
        if (err) {
          console.log(err);
          return reject(err);
        }

        resolve(results);
      }
    );
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


exports.getDistributedCenterTargetDao = async (id, status, date, searchText) => {
  return new Promise((resolve, reject) => {
    const sqlParams = [id];
    let sql = `
     WITH package_item_counts AS (
        SELECT 
            op.orderId,
            COUNT(*) AS totalItems,
            SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) AS packedItems,
            CASE
                WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) = 0 AND COUNT(*) > 0 THEN 'Pending'
                WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) > 0 
                     AND SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) < COUNT(*) THEN 'Opened'
                WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) = COUNT(*) AND COUNT(*) > 0 THEN 'Completed'
                ELSE 'Unknown'
            END AS packageStatus
        FROM market_place.orderpackageitems opi
        JOIN market_place.orderpackage op ON opi.orderPackageId = op.id
        GROUP BY op.orderId
    ),
    additional_items_counts AS (
        SELECT 
            orderId,
            COUNT(*) AS totalAdditionalItems,
            SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) AS packedAdditionalItems,
            CASE
                WHEN COUNT(*) = 0 THEN 'Unknown'
                WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) = 0 THEN 'Pending'
                WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) > 0 
                     AND SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) < COUNT(*) THEN 'Opened'
                WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) = COUNT(*) THEN 'Completed'
                ELSE 'Unknown'
            END AS additionalItemsStatus
        FROM market_place.orderadditionalitems
        GROUP BY orderId
    )

    SELECT 
        po.invNo, 
        co.firstNameEnglish, 
        co.lastNameEnglish, 
        o.sheduleDate, 
        dti.isComplete,
        COALESCE(pic.packageStatus, 'Unknown') AS packageStatus,
        COALESCE(aic.additionalItemsStatus, 'Unknown') AS additionalItemsStatus
    FROM distributedtarget dt
    JOIN distributedtargetitems dti ON dt.id = dti.targetId
    JOIN collectionofficer co ON dt.userId = co.id
    JOIN market_place.processorders po ON dti.orderId = po.id
    JOIN market_place.orders o ON po.orderId = o.id
    LEFT JOIN package_item_counts pic ON pic.orderId = po.id
    LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
    WHERE dt.companycenterId = ?
    `;

    // === Add Status Filter ===
    if (status && status.trim() !== '') {
      if (status === 'Pending') {
        sql += `
          AND (
            (pic.packageStatus = 'Pending' AND (aic.additionalItemsStatus = 'Unknown' OR aic.additionalItemsStatus IS NULL)) OR
            (pic.packageStatus = 'Unknown' AND aic.additionalItemsStatus = 'Pending') OR
            (pic.packageStatus IS NULL AND aic.additionalItemsStatus = 'Pending') OR
            (pic.packageStatus = 'Pending' AND aic.additionalItemsStatus = 'Pending')
          )
        `;
      } else if (status === 'Opened') {
        sql += `
          AND (
            pic.packageStatus = 'Opened' OR
            aic.additionalItemsStatus = 'Opened'
          )
        `;
      } else if (status === 'Completed') {
        sql += `
          AND (
            (pic.packageStatus = 'Completed' AND (aic.additionalItemsStatus = 'Unknown' OR aic.additionalItemsStatus IS NULL)) OR
            (pic.packageStatus = 'Unknown' AND aic.additionalItemsStatus = 'Completed') OR
            (pic.packageStatus IS NULL AND aic.additionalItemsStatus = 'Completed') OR
            (pic.packageStatus = 'Completed' AND aic.additionalItemsStatus = 'Completed')
          )
        `;
      }
    }

    // Add date filter - FIXED: Handle both string and Date objects
    if (date) {
      let dateValue;
      
      // Handle different date formats
      if (typeof date === 'string') {
        dateValue = date.trim();
      } else if (date instanceof Date) {
        // Convert Date object to YYYY-MM-DD format
        dateValue = date.toISOString().split('T')[0];
      }
      
      if (dateValue && dateValue !== '') {
        sql += ` AND DATE(o.sheduleDate) = DATE(?)`;
        sqlParams.push(dateValue);
      }
    }

    // Add search text filter
    if (searchText && searchText.trim() !== '') {
      sql += ` AND po.invNo LIKE ?`;
      sqlParams.push(`%${searchText.trim()}%`);
    }

    if (!date && !status && !searchText) {
      sql += `
     AND ((o.sheduleDate BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY))  
       OR (o.sheduleDate < CURDATE() AND dt.complete != dt.target))
      `
    }

    // Add ORDER BY for consistent results
    sql += `
    GROUP BY 
      po.invNo, 
      co.firstNameEnglish, 
      co.lastNameEnglish, 
      o.sheduleDate, 
      dti.isComplete,
      pic.packageStatus, 
      aic.additionalItemsStatus
    ORDER BY 
      o.sheduleDate ASC,
      po.invNo ASC
    `;

    // Add logging for debugging
    console.log('SQL Query:', sql);
    console.log('SQL Parameters:', sqlParams);
    console.log('Filter Parameters:', { id, status, date, searchText });

    collectionofficer.query(sql, sqlParams, (err, results) => {
      if (err) {
        console.error('Database query error:', err);
        reject(err);
      } else {
        console.log(`Query returned ${results.length} results`);
        resolve(results);
      }
    });
  });
};


exports.getEachDistributedCenterOfficersDao = (data, status, role, searchText) => {
  return new Promise((resolve, reject) => {
    const sqlParams = [data.companyId, data.centerId];
    let sql = `
      SELECT 
        id,
        firstNameEnglish,
        lastNameEnglish,
        jobRole,
        empId,
        status,
        phoneCode01,
        phoneNumber01,
        nic
      FROM collectionofficer 
      WHERE companyId = ? AND centerId = ? AND jobRole IN ('Distribution Center Manager', 'Distribution Officer')
      `;

    if (status) {
      sql += ` AND status = ? `;
      sqlParams.push(status);
    }

    if (searchText) {
      sql += ` AND (firstNameEnglish LIKE ? OR lastNameEnglish LIKE ? OR empId LIKE ? ) `;
      sqlParams.push(`%${searchText}%`, `%${searchText}%`, `%${searchText}%`);
    }

    if (role) {
      sql += ` AND jobRole = ? `;
      sqlParams.push(role);
    }

    collectionofficer.query(sql, sqlParams, (err, results) => {
      if (err) {
        console.log(err);
        return reject(err);
      }

      resolve(results);
    });
  });
};


exports.getCenterAndCompanyIdDao = (companyCenteerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT centerId, companyId
      FROM distributedcompanycenter 
      WHERE id = ?
      `;
    collectionofficer.query(sql, [companyCenteerId], (err, results) => {
      if (err) {
        console.log(err);
        return reject(err);
      }

      resolve(results[0] || null);
    });
  });
};


exports.getDistributionOutForDlvrOrderDao = (id, searchText, filterDate) => {
  return new Promise((resolve, reject) => {
    const sqlParams = [id];
    let sql = `
        SELECT 
        po.id,
            po.invNo,
            cof.firstNameEnglish,
            cof.lastNameEnglish,
            o.sheduleDate,
            po.outDlvrDate,
            CASE 
                WHEN po.outDlvrDate IS NULL THEN 'Pending'
                WHEN po.outDlvrDate <= o.sheduleDate THEN 'On Time'
                ELSE 'Late'
            END AS outDlvrStatus
        FROM distributedtarget dt
        JOIN distributedtargetitems dti ON dt.id = dti.targetId
        JOIN market_place.processorders po ON dti.orderId = po.id
        JOIN market_place.orders o ON po.orderId = o.id
        JOIN collectionofficer cof ON po.outBy = cof.id
        WHERE po.status = 'Out For Delivery' AND dt.companycenterId = ?    `;

    // Add search functionality for invNo
    if (searchText) {
      sql += ` AND po.invNo LIKE ? `;
      sqlParams.push(`%${searchText}%`);
    }

    // Add date filter for specific outDlvrDate
    if (filterDate) {
      sql += ` AND DATE(po.outDlvrDate) = ? `;
      sqlParams.push(filterDate);
    }

    collectionofficer.query(sql, sqlParams, (err, results) => {
      if (err) {
        console.log(err);
        return reject(err);
      }

      resolve(results);
    });
  });
};

exports.updateDistributionOfficerDetails = (
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

exports.editCheckNICExist = async (nic, excludeId = null) => {
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

exports.EditCheckEmailExist = async (email, excludeId = null) => {
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


exports.getOfficerDailyDistributionTargetDao = async (id) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
      	dt.id,
      	dt.target,
      	dt.complete,
      	cof.empId,
      	cof.firstNameEnglish,
      	cof.lastNameEnglish
      FROM distributedtarget dt
      JOIN collectionofficer cof ON dt.userId = cof.id
      WHERE dt.companycenterId = ?
    `;
    const params = [id];
    collectionofficer.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};
