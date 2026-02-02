const {
  plantcare,
  collectionofficer,
  marketPlace,
  investment,
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
    const { name, regCode, contact01, email, excludeId } = checkData;

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
          WHEN email = ? THEN 'email'
        END as conflictType
      FROM distributedcenter 
      WHERE (centerName = ? OR regCode = ? OR contact01 = ? OR email = ?)
    `;

    const values = [
      name,
      regCode,
      contact01,
      email,
      name,
      regCode,
      contact01,
      email,
    ];

    // Add exclusion for update operations
    if (excludeId) {
      sql += ` AND id != ?`;
      values.push(excludeId);
    }

    sql += ` LIMIT 1`;

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        console.error("Error checking existing distribution centre:", err);
        return reject(err);
      }

      if (results.length > 0) {
        const conflict = results[0];
        let message = "";

        switch (conflict.conflictType) {
          case "name":
            message = "name";
            break;
          case "regCode":
            message = "regCode";
            break;
          case "email":
            message = "email";
            break;
          case "contact":
            message = "contact";
            break;
          default:
            message = "default";
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
        console.error("Error inserting distribution centre:", err);
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
        " AND (dc.regCode LIKE ? OR c.companyNameEnglish LIKE ? OR dc.city LIKE ?)"; // Added city to search
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
          AND co.jobRole = 'Distribution Centre Manager'
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
    let countSql = `SELECT COUNT(*) AS total FROM collectionofficer co WHERE co.companyId = ? AND co.jobRole = 'Distribution Centre Head'`;
    let dataSql = `
    SELECT 
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
        CONCAT(coff_mod.firstNameEnglish, ' ', coff_mod.lastNameEnglish) AS officeModify,
        au.userName AS adminModify,
        co.createdAt 
    FROM collectionofficer co
    LEFT JOIN collectionofficer coff_mod ON co.officerModiyBy = coff_mod.id
    LEFT JOIN agro_world_admin.adminusers au ON co.adminModifyBy = au.id
    WHERE co.companyId = ? AND co.jobRole = 'Distribution Centre Head'`;
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
                    distributedCenterId, companyId, irmId, firstNameEnglish, lastNameEnglish,
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
        co.id, 
        co.companyId, 
        cc.centerName,  -- ✅ fetched from collectioncenter
        co.irmId, 
        co.firstNameEnglish, 
        co.lastNameEnglish, 
        co.jobRole, 
        co.empId, 
        co.empType,
        co.phoneCode01, 
        co.phoneNumber01, 
        co.phoneCode02, 
        co.phoneNumber02, 
        co.nic, 
        co.email,
        co.houseNumber, 
        co.streetName, 
        co.city, 
        co.district, 
        co.province, 
        co.country, 
        co.languages,
        co.accHolderName, 
        co.accNumber, 
        co.bankName, 
        co.branchName, 
        co.image, 
        co.status,
        co.claimStatus, 
        co.onlineStatus
      FROM 
        collectionofficer co
      LEFT JOIN 
        collectioncenter cc 
      ON co.companyId = cc.id
      WHERE co.id = ?
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

exports.UpdateDistributionHeadDao = (id, updateData, adminId) => {
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
        branchName = ?, image = ?, status = ?, claimStatus = ?, onlineStatus = ?, adminModifyBy = ?, officerModiyBy = NULL, password = NULL, passwordUpdated = 0
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
      "Not Approved",
      updateData.claimStatus,
      updateData.onlineStatus,
      adminId,
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
    console.log("Starting update for distribution centre ID:", id);
    console.log("Update data received:", updateData);

    // Extract company information from updateData if available
    const companyNameEnglish = updateData.companyNameEnglish;
    const companyId = updateData.companyId;

    // Update distribution centre SQL
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
      updateData.name,
      updateData.contact1Code,
      updateData.contact1,
      updateData.contact2Code,
      updateData.contact2,
      updateData.city,
      updateData.district,
      updateData.province,
      updateData.country,
      updateData.longitude,
      updateData.latitude,
      updateData.email,
      updateData.regCode,
      id,
    ];

    console.log("Executing center update with:", updateCenterSql, centerParams);

    // Executere update
    collectionofficer.query(
      updateCenterSql,
      centerParams,
      (err, centerResults) => {
        if (err) {
          console.error("Error updating distribution centre:", err);
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
              console.log("Updates completed successfully");

              // Return updated distribution centre regardless of company update result
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
  // Generate the prefix based on province and district with "P" after province initial
  const prefix =
    province.charAt(0).toUpperCase() +
    "P" +
    district.charAt(0).toUpperCase() +
    city.charAt(0).toUpperCase();

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
        if (employee === "Distribution Centre Head") {
          return resolve("DCH00001");
        } else if (employee === "Distribution Centre Manager") {
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
            LEFT JOIN distributedcenter dc ON coff.distributedCenterId = dc.id
            WHERE coff.jobRole IN ('Distribution Centre Manager', 'Distribution Officer') AND cm.id = 2
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
                dc.centerName,
                dc.regCode,
                CONCAT(coff_mod.firstNameEnglish, ' ', coff_mod.lastNameEnglish) AS officeModify,
                au.userName AS adminModify
            FROM collectionofficer coff
            JOIN company cm ON coff.companyId = cm.id
            LEFT JOIN distributedcenter dc ON coff.distributedCenterId = dc.id
            LEFT JOIN collectionofficer coff_mod ON coff.officerModiyBy = coff_mod.id
            LEFT JOIN agro_world_admin.adminusers au ON coff.adminModifyBy = au.id
            WHERE coff.jobRole IN ('Distribution Centre Manager', 'Distribution Officer') AND cm.id = 2
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
      countSql += " AND coff.distributedCenterId = ?";
      dataSql += " AND coff.distributedCenterId = ?";
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
          WHEN coff.jobRole = 'Distribution Centre Manager' THEN 1 
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

exports.getAllDistributionCenterManagerDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        id, 
        firstNameEnglish, 
        lastNameEnglish, 
        empId, 
        CONCAT(empId, ' - ', firstNameEnglish, ' ', lastNameEnglish) AS labelName
      FROM collectionofficer
      WHERE jobRole = 'Distribution Centre Manager' AND companyId = 2 AND distributedCenterId = ?;
    `;

    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
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
        if (employee === "Distribution Centre Head") {
          return resolve("DCH00001");
        } else if (employee === "Distribution Centre Manager") {
          return resolve("DCM00001");
        } else if (employee === "Distribution Officer") {
          return resolve("DIO00001");
        } else if (employee === "Driver") {
          return resolve("DVR00001");
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
                "empId": "${lastId}",
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
      if (officerData.jobRole === "Distribution Centre Manager") {
        officerData.irmId = null;
      }

      const sql = `
                INSERT INTO collectionofficer (
                    distributedCenterId, companyId ,irmId ,firstNameEnglish, firstNameSinhala, firstNameTamil, lastNameEnglish,
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

exports.vehicleRegisterDao = (
  id,
  driverData,
  licFrontImg,
  licBackImg,
  insFrontImg,
  insBackImg,
  vehFrontImg,
  vehBackImg,
  vehSideImgA,
  vehSideImgB
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO vehicleregistration (
        coId, licNo, insNo, insExpDate, vType, vCapacity, vRegNo, 
        licFrontImg, licBackImg, insFrontImg, insBackImg, 
        vehFrontImg, vehBackImg, vehSideImgA, vehSideImgB
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    collectionofficer.query(
      sql,
      [
        id,
        driverData.licNo,
        driverData.insNo,
        driverData.insExpDate,
        driverData.vType,
        driverData.vCapacity,
        driverData.vRegNo,
        licFrontImg,
        licBackImg,
        insFrontImg,
        insBackImg,
        vehFrontImg,
        vehBackImg,
        vehSideImgA,
        vehSideImgB,
      ],
      (err, results) => {
        if (err) {
          console.error("Vehicle registration error:", err);
          return reject(err);
        }
        resolve(results);
      }
    );
  });
};

exports.DeleteOfficerDao = (officerId) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM collectionofficer WHERE id = ?`;

    collectionofficer.query(sql, [officerId], (err, results) => {
      if (err) {
        console.error("Delete officer error:", err);
        return reject(err);
      }
      resolve(results);
    });
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
      "SELECT id, empId, firstNameEnglish, lastNameEnglish FROM collectionofficer WHERE jobRole = 'Distribution Centre Manager' AND companyId = ? AND distributedCenterId = ? AND status = 'Approved'";
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
      ORDER BY dc.regCode ASC
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

exports.getDistributedCenterTargetDao = async (
  id,
  status,
  date,
  searchText
) => {
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
    if (status && status.trim() !== "") {
      if (status === "Pending") {
        sql += `
          AND (
            (pic.packageStatus = 'Pending' AND (aic.additionalItemsStatus = 'Unknown' OR aic.additionalItemsStatus IS NULL)) OR
            (pic.packageStatus = 'Unknown' AND aic.additionalItemsStatus = 'Pending') OR
            (pic.packageStatus IS NULL AND aic.additionalItemsStatus = 'Pending') OR
            (pic.packageStatus = 'Pending' AND aic.additionalItemsStatus = 'Pending')
          )
        `;
      } else if (status === "Opened") {
        sql += `
          AND (
            pic.packageStatus = 'Opened' OR
            aic.additionalItemsStatus = 'Opened'
          )
        `;
      } else if (status === "Completed") {
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
      if (typeof date === "string") {
        dateValue = date.trim();
      } else if (date instanceof Date) {
        // Convert Date object to YYYY-MM-DD format
        dateValue = date.toISOString().split("T")[0];
      }

      if (dateValue && dateValue !== "") {
        sql += ` AND DATE(o.sheduleDate) = DATE(?)`;
        sqlParams.push(dateValue);
      }
    }

    // Add search text filter
    if (searchText && searchText.trim() !== "") {
      sql += ` AND po.invNo LIKE ?`;
      sqlParams.push(`%${searchText.trim()}%`);
    }

    if (!date && !status && !searchText) {
      sql += `
     AND ((o.sheduleDate BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY))  
       OR (o.sheduleDate < CURDATE() AND dt.complete != dt.target))
      `;
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
    console.log("SQL Query:", sql);
    console.log("SQL Parameters:", sqlParams);
    console.log("Filter Parameters:", { id, status, date, searchText });

    collectionofficer.query(sql, sqlParams, (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        reject(err);
      } else {
        console.log(`Query returned ${results.length} results`);
        resolve(results);
      }
    });
  });
};

exports.getEachDistributedCenterOfficersDao = (
  data,
  status,
  role,
  searchText
) => {
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
      WHERE companyId = ? AND distributedCenterId = ? AND jobRole IN ('Distribution Centre Manager', 'Distribution Officer')
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

exports.getDistributionOutForDlvrOrderDao = (
  id,
  searchText,
  filterDate,
  status
) => {
  return new Promise((resolve, reject) => {
    console.log('filterDate', filterDate)
    const sqlParams = [id];
    let sql = `
        SELECT 
            po.id,
            po.invNo,
            cof.firstNameEnglish,
            cof.lastNameEnglish,
            o.sheduleDate,
            o.sheduleTime,
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

    // Add status filter (only 'On Time' or 'Late')
    if (status) {
      if (status === "On Time") {
        sql += ` AND po.outDlvrDate IS NOT NULL AND po.outDlvrDate <= o.sheduleDate `;
      } else if (status === "Late") {
        sql += ` AND po.outDlvrDate IS NOT NULL AND po.outDlvrDate > o.sheduleDate `;
      }
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
  profileImageUrl,
  adminId
) => {
  return new Promise((resolve, reject) => {
    let sql = `
             UPDATE collectionofficer
                SET distributedCenterId = ?, companyId = ?, irmId = ?, firstNameEnglish = ?, lastNameEnglish = ?, firstNameSinhala = ?, lastNameSinhala = ?,
                    firstNameTamil = ?, lastNameTamil = ?, jobRole = ?, empId = ?, empType = ?, phoneCode01 = ?, phoneNumber01 = ?, phoneCode02 = ?, phoneNumber02 = ?,
                    nic = ?, email = ?, houseNumber = ?, streetName = ?, city = ?, district = ?, province = ?, country = ?, languages = ?,
                    accHolderName = ?, accNumber = ?, bankName = ?, branchName = ?, image = ?,  adminModifyBy = ?, status = 'Not Approved', officerModiyBy = NULL
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
      adminId,
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

exports.editCheckPhoneNumberExist = async (phoneNumber, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT COUNT(*) as count FROM collectionofficer 
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

exports.getOfficerById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM collectionofficer WHERE id = ?`;
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results[0] || null);
    });
  });
};

exports.getDriverDataByOfficerId = (officerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        vr.*,
        SUBSTRING_INDEX(vr.licFrontImg, '/', -1) as licFrontName,
        SUBSTRING_INDEX(vr.licBackImg, '/', -1) as licBackName,
        SUBSTRING_INDEX(vr.insFrontImg, '/', -1) as insFrontName,
        SUBSTRING_INDEX(vr.insBackImg, '/', -1) as insBackName,
        SUBSTRING_INDEX(vr.vehFrontImg, '/', -1) as vFrontName,
        SUBSTRING_INDEX(vr.vehBackImg, '/', -1) as vBackName,
        SUBSTRING_INDEX(vr.vehSideImgA, '/', -1) as vSideAName,
        SUBSTRING_INDEX(vr.vehSideImgB, '/', -1) as vSideBName
      FROM vehicleregistration vr 
      WHERE vr.coId = ?
    `;

    collectionofficer.query(sql, [officerId], (err, results) => {
      if (err) {
        console.error("Error fetching driver data:", err);
        return reject(err);
      }
      resolve(results[0] || null);
    });
  });
};

exports.updateVehicleRegisterDao = (
  id,
  driverData,
  licFrontImg,
  licBackImg,
  insFrontImg,
  insBackImg,
  vehFrontImg,
  vehBackImg,
  vehSideImgA,
  vehSideImgB
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE vehicleregistration 
      SET licNo = ?, insNo = ?, insExpDate = ?, vType = ?, vCapacity = ?, 
          vRegNo = ?, licFrontImg = ?, licBackImg = ?, insFrontImg = ?, 
          insBackImg = ?, vehFrontImg = ?, vehBackImg = ?, 
          vehSideImgA = ?, vehSideImgB = ?
      WHERE coId = ?
    `;

    collectionofficer.query(
      sql,
      [
        driverData.licNo,
        driverData.insNo,
        driverData.insExpDate,
        driverData.vType,
        driverData.vCapacity,
        driverData.vRegNo,
        licFrontImg,
        licBackImg,
        insFrontImg,
        insBackImg,
        vehFrontImg,
        vehBackImg,
        vehSideImgA,
        vehSideImgB,
        id,
      ],
      (err, results) => {
        if (err) {
          console.error("Vehicle registration update error:", err);
          return reject(err);
        }
        resolve(results);
      }
    );
  });
};

exports.deleteDriverData = (officerId) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM vehicleregistration WHERE coId = ?`;
    collectionofficer.query(sql, [officerId], (err, results) => {
      if (err) return reject(err);
      resolve(results);
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

exports.getOfficerDailyDistributionTargetDao = async (id, date) => {
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
      LEFT JOIN distributedtargetitems dti ON dti.targetId = dt.id
      WHERE dt.companycenterId = ? AND DATE(dt.createdAt) = DATE(?)
      GROUP BY 
        dt.id,
        dt.target,
        dt.complete,
        cof.empId,
        cof.firstNameEnglish,
        cof.lastNameEnglish
    `;
    const params = [id, date];
    collectionofficer.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// exports.getSelectTargetItems = (targetId, searchText = "", status = "") => {
//   return new Promise((resolve, reject) => {
//     let sql = `
//       WITH package_item_statuses AS (
//         SELECT 
//           op.orderId,
//           op.id AS packageId,
//           COUNT(*) AS totalItems,
//           SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) AS packedItems,
//           CASE
//             WHEN COUNT(*) = 0 THEN 'Unknown'
//             WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) = 0 THEN 'Pending'
//             WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) < COUNT(*) THEN 'Opened'
//             WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) = COUNT(*) THEN 'Completed'
//             ELSE 'Unknown'
//           END AS packageItemStatus
//         FROM market_place.orderpackageitems opi
//         JOIN market_place.orderpackage op ON opi.orderPackageId = op.id
//         GROUP BY op.orderId, op.id
//       ),
//       package_item_counts AS (
//         SELECT
//           orderId,
//           CASE
//             WHEN SUM(CASE WHEN packageItemStatus = 'Pending' THEN 1 ELSE 0 END) > 0 THEN 'Pending'
//             WHEN SUM(CASE WHEN packageItemStatus = 'Opened' THEN 1 ELSE 0 END) > 0 THEN 'Opened'
//             WHEN SUM(CASE WHEN packageItemStatus = 'Completed' THEN 1 ELSE 0 END) = COUNT(*) THEN 'Completed'
//             ELSE 'Unknown'
//           END AS packageStatus,
//           SUM(totalItems) AS totalItems,
//           SUM(packedItems) AS packedItems
//         FROM package_item_statuses
//         GROUP BY orderId
//       ),
//       additional_items_counts AS (
//         SELECT 
//           orderId,
//           COUNT(*) AS totalAdditionalItems,
//           SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) AS packedAdditionalItems,
//           CASE
//             WHEN COUNT(*) = 0 THEN 'Unknown'
//             WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) = 0 THEN 'Pending'
//             WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) > 0 
//               AND SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) < COUNT(*) THEN 'Opened'
//             WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) = COUNT(*) THEN 'Completed'
//             ELSE 'Unknown'
//           END AS additionalItemsStatus
//         FROM market_place.orderadditionalitems
//         GROUP BY orderId
//       )
//       SELECT
//         dti.id,
//         dti.orderId as processOrderId,
//         dti.isComplete,
//         dti.completeTime,
//         po.id as orderId,
//         po.invNo,
//         o.sheduleDate,
//         o.sheduleTime,
//         dt.userId as officerId,
//         e.empId,
//         e.firstNameEnglish,
//         e.lastNameEnglish,
//         COALESCE(pic.packageStatus, 'Unknown') AS packageStatus,
//         COALESCE(aic.additionalItemsStatus, 'Unknown') AS additionalItemsStatus,
//         CASE 
//           WHEN dti.isComplete = 0 THEN 'Not Complete'
//           WHEN dti.completeTime IS NULL THEN 'Not Complete'
//           WHEN dti.completeTime < o.sheduleDate THEN 'On Time'
//           WHEN dti.completeTime >= o.sheduleDate THEN 'Late'
//           ELSE 'Not Complete'
//         END AS completeTimeStatus
//       FROM distributedtargetitems dti
//       LEFT JOIN market_place.processorders po ON dti.orderId = po.id
//       LEFT JOIN package_item_counts pic ON pic.orderId = po.id
//       LEFT JOIN additional_items_counts aic ON aic.orderId = po.id
//       LEFT JOIN market_place.orders o ON po.orderId = o.id
//       LEFT JOIN distributedtarget dt ON dti.targetId = dt.id
//       LEFT JOIN collectionofficer e ON dt.userId = e.id
//       WHERE dti.targetId = ?
//     `;

//     const params = [targetId];

//     // Add search filter
//     if (searchText) {
//       sql += ` AND po.invNo LIKE ?`;
//       params.push(`%${searchText}%`);
//     }

//     collectionofficer.query(sql, params, (err, results) => {
//       if (err) {
//         return reject(err);
//       }
//       resolve(results);
//     });
//   });
// };




exports.getSelectTargetItems = (targetId, search, packageStatus, completingStatus ) => {
  return new Promise((resolve, reject) => {

    const params = [targetId];

    let whereClause = ` 
    WHERE 
  dti.targetId = ?
  AND po.status IN ('Processing', 'Out For Delivery') 
  AND po.isTargetAssigned = 1 
  AND (
      (o.isPackage = 1 AND op.packingStatus != 'Todo') 
      OR o.isPackage = 0
  )
     `;

    if (search) {
      whereClause += ` AND (po.invNo LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern);
      
    }
    
    // 🔹 Add this block for completionStatus filter
    if (completingStatus) {
      if (completingStatus === 'On Time') {
        whereClause += `
          AND dti.completeTime IS NOT NULL
          AND dti.completeTime <= 
            CASE 
              WHEN o.sheduleTime = 'Within 8-12 PM' THEN TIMESTAMP(o.sheduleDate, '12:00:00')
              WHEN o.sheduleTime = 'Within 12-4 PM' THEN TIMESTAMP(o.sheduleDate, '16:00:00')
              WHEN o.sheduleTime = 'Within 4-8 PM' THEN TIMESTAMP(o.sheduleDate, '20:00:00')
              ELSE TIMESTAMP(o.sheduleDate, '23:59:59')
            END
        `;
      } else if (completingStatus === 'Late') {
        whereClause += `
          AND dti.completeTime IS NOT NULL
          AND dti.completeTime >
            CASE 
              WHEN o.sheduleTime = 'Within 8-12 PM' THEN TIMESTAMP(o.sheduleDate, '12:00:00')
              WHEN o.sheduleTime = 'Within 12-4 PM' THEN TIMESTAMP(o.sheduleDate, '16:00:00')
              WHEN o.sheduleTime = 'Within 4-8 PM' THEN TIMESTAMP(o.sheduleDate, '20:00:00')
              ELSE TIMESTAMP(o.sheduleDate, '23:59:59')
            END
        `;
      } else if (completingStatus === 'Not Completed') {
        whereClause += `
          AND dti.completeTime IS NULL
        `;
      }
      params.push(completingStatus);
    }

    if (packageStatus) {
      if (packageStatus === 'Completed') {
        whereClause += `
          AND (
            (
              COALESCE(pic.totalItems, 0) > 0 AND COALESCE(aic.totalAdditionalItems, 0) > 0
              AND pic.packageStatus = 'Completed'
              AND aic.additionalItemsStatus = 'Completed'
            )
            OR (
              COALESCE(pic.totalItems, 0) > 0 AND COALESCE(aic.totalAdditionalItems, 0) = 0
              AND pic.packageStatus = 'Completed'
            )
            OR (
              COALESCE(pic.totalItems, 0) = 0 AND COALESCE(aic.totalAdditionalItems, 0) > 0
              AND aic.additionalItemsStatus = 'Completed'
            )
          )
        `;
      } else {
        
        whereClause += `
          AND (
            COALESCE(pic.packageStatus, 'Unknown') = ?
            OR COALESCE(aic.additionalItemsStatus, 'Unknown') = ?
          )
        `;
        params.push(packageStatus, packageStatus);
      }
    }

    // ✅ Final SQL (new version)
    const dataSql = `
      WITH package_item_statuses AS (
          SELECT 
              op.orderId,
              op.id AS packageId,
              COUNT(*) AS totalItems,
              SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) AS packedItems,
              CASE
                  WHEN COUNT(*) = 0 THEN 'Unknown'
                  WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) = 0 THEN 'Pending'
                  WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) < COUNT(*) THEN 'Opened'
                  WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) = COUNT(*) THEN 'Completed'
                  ELSE 'Unknown'
              END AS packageItemStatus
          FROM market_place.orderpackageitems opi
          JOIN market_place.orderpackage op ON opi.orderPackageId = op.id
          GROUP BY op.orderId, op.id
      ),
      package_item_counts AS (
          SELECT
              orderId,
              CASE
                  WHEN SUM(CASE WHEN packageItemStatus = 'Pending' THEN 1 ELSE 0 END) > 0 THEN 'Pending'
                  WHEN SUM(CASE WHEN packageItemStatus = 'Opened' THEN 1 ELSE 0 END) > 0 THEN 'Opened'
                  WHEN SUM(CASE WHEN packageItemStatus = 'Completed' THEN 1 ELSE 0 END) = COUNT(*) THEN 'Completed'
                  ELSE 'Unknown'
              END AS packageStatus,
              SUM(totalItems) AS totalItems,
              SUM(packedItems) AS packedItems
          FROM package_item_statuses
          GROUP BY orderId
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
  o.id,
  po.id AS processOrderId,
  po.invNo,
  o.sheduleDate,
  o.sheduleTime,
  dti.id AS distributedTargetItemId, 
  dt.id AS distributedTargetId, 
  dti.isComplete,
  dt.userId,
  coff.empId, 
  coff.firstNameEnglish, 
  coff.lastNameEnglish,
  po.outDlvrDate,

  CASE 
      WHEN MAX(op.isLock) = 1 THEN 1
      ELSE 0
  END AS lockStatus,

  dti.isComplete,
  dti.completeTime,
  COUNT(DISTINCT op.id) AS packageCount,
  SUM(DISTINCT mpi.productPrice) AS packagePrice,
  COALESCE(pic.totalItems, 0) AS totPackageItems,
  COALESCE(pic.packedItems, 0) AS packPackageItems,
  COALESCE(aic.totalAdditionalItems, 0) AS totalAdditionalItems,
  COALESCE(aic.packedAdditionalItems, 0) AS packedAdditionalItems,
  COALESCE(pic.packageStatus, 'Unknown') AS packageStatus,
  COALESCE(aic.additionalItemsStatus, 'Unknown') AS additionalItemsStatus

FROM collection_officer.distributedtarget dt  
JOIN collection_officer.distributedtargetitems dti ON dti.targetId = dt.id
JOIN collection_officer.collectionofficer coff ON dt.userId = coff.id
JOIN market_place.processorders po ON dti.orderId = po.id
LEFT JOIN market_place.orders o ON po.orderId = o.id
LEFT JOIN market_place.orderpackage op ON op.orderId = po.id 
LEFT JOIN market_place.orderhouse oh ON oh.orderId = o.id
LEFT JOIN market_place.orderapartment oa ON oa.orderId = o.id
LEFT JOIN marketplacepackages mpi ON op.packageId = mpi.id
LEFT JOIN package_item_counts pic ON pic.orderId = po.id
LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
${whereClause}
GROUP BY
  o.id,
  po.id,
  po.invNo,
  o.sheduleDate,
  o.sheduleTime,
  dti.id,
  dt.id,
  dti.isComplete,
  dt.userId,
  coff.empId,
  coff.firstNameEnglish,
  coff.lastNameEnglish,
  po.outDlvrDate,
  pic.totalItems,
  pic.packedItems,
  pic.packageStatus,
  aic.totalAdditionalItems,
  aic.packedAdditionalItems,
  aic.additionalItemsStatus;

      `;

      marketPlace.query(dataSql, params, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }
        resolve({
          items: dataResults
        });
      });
    });
};

exports.getDistributedCompanyCenter = (companyId, centerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT dcc.id AS companyCenterId
      FROM collection_officer.distributedcompanycenter dcc 
      JOIN collection_officer.distributedcenter dc ON dcc.centerId = dc.id
      JOIN collection_officer.company c ON dcc.companyId = c.id
      WHERE c.id = ? AND dc.id = ?
      `;

    collectionofficer.query(sql, [companyId, centerId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getDeliveryChargeCity = (companyCenterId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT dc.city 
      FROM collection_officer.centerowncity coc
      LEFT JOIN collection_officer.deliverycharge dc 
        ON coc.cityId = dc.id
      WHERE coc.companyCenterId = ?
    `;

    collectionofficer.query(sql, [companyCenterId], (err, results) => {
      if (err) {
        return reject(err);
      }

      // Map result rows into an array of city values
      const cities = results.map((row) => row.city);
      resolve(cities);
    });
  });
};

exports.dcmGetSelectedOfficerTargetsDao = (
  officerId,
  deliveryLocationData,
  search,
  packageStatus,
  centerId
) => {
  console.log("officerId", officerId);
  return new Promise((resolve, reject) => {
    const params = [officerId];

    if (deliveryLocationData && deliveryLocationData.length > 0) {
      params.push(deliveryLocationData, deliveryLocationData);
    }

    params.push(centerId);

    let whereClause = ` 
    WHERE 
    coff.id = ? 
    AND po.status IN ('Processing', 'Out For Delivery') 
    AND po.isTargetAssigned = 1 
    AND (
      (o.isPackage = 1 AND op.packingStatus != 'Todo') 
      OR o.isPackage = 0
    )
    AND (
      ${
        deliveryLocationData && deliveryLocationData.length > 0
          ? "(oh.city IN (?) OR oa.city IN (?)) OR"
          : ""
      }
      o.centerId = ?
    )
     `;

    if (search) {
      whereClause += ` AND (po.invNo LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern);
    }

    if (packageStatus) {
      if (packageStatus === "Pending") {
        whereClause += ` 
        AND (
          (pic.packedItems = 0 AND pic.totalItems > 0) 
          OR 
          (COALESCE(aic.packedAdditionalItems, 0) = 0 AND COALESCE(aic.totalAdditionalItems, 0) > 0)
        )
      `;
      } else if (packageStatus === "Completed") {
        whereClause += ` 
        AND (
          (pic.totalItems > 0 AND pic.packedItems = pic.totalItems) 
          OR 
          (COALESCE(aic.totalAdditionalItems, 0) > 0 AND COALESCE(aic.packedAdditionalItems, 0) = COALESCE(aic.totalAdditionalItems, 0))
        )
      `;
      } else if (packageStatus === "Opened") {
        whereClause += ` 
        AND (
          (pic.packedItems > 0 AND pic.totalItems > pic.packedItems) 
          OR 
          (COALESCE(aic.packedAdditionalItems, 0) > 0 AND COALESCE(aic.totalAdditionalItems, 0) > COALESCE(aic.packedAdditionalItems, 0))
        )
      `;
      }
    }

    const dataSql = `
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
      FROM orderpackageitems opi
      JOIN orderpackage op ON opi.orderPackageId = op.id
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
      FROM orderadditionalitems
      GROUP BY orderId
  )
        
  SELECT 
  o.id,
  po.id AS processOrderId,
  po.invNo,
  o.sheduleDate,
  o.sheduleTime,
  dti.id AS distributedTargetItemId, 
  dt.id AS distributedTargetId, 
  dti.isComplete,
  dt.userId,
  coff.empId, 
  coff.firstNameEnglish, 
  coff.lastNameEnglish,
  po.outDlvrDate,
  COUNT(DISTINCT op.id) AS packageCount,
  SUM(DISTINCT mpi.productPrice) AS packagePrice,
  COALESCE(pic.totalItems, 0) AS totPackageItems,
  COALESCE(pic.packedItems, 0) AS packPackageItems,
  COALESCE(aic.totalAdditionalItems, 0) AS totalAdditionalItems,
  COALESCE(aic.packedAdditionalItems, 0) AS packedAdditionalItems,
  COALESCE(pic.packageStatus, 'Unknown') AS packageStatus,
  COALESCE(aic.additionalItemsStatus, 'Unknown') AS additionalItemsStatus
FROM collection_officer.distributedtarget dt  
JOIN collection_officer.distributedtargetitems dti ON dti.targetId = dt.id
JOIN collection_officer.collectionofficer coff ON dt.userId = coff.id
JOIN market_place.processorders po ON dti.orderId = po.id
LEFT JOIN orders o ON po.orderId = o.id
LEFT JOIN orderpackage op ON op.orderId = po.id 
LEFT JOIN market_place.orderhouse oh ON oh.orderId = o.id
LEFT JOIN market_place.orderapartment oa ON oa.orderId = o.id
LEFT JOIN marketplacepackages mpi ON op.packageId = mpi.id
LEFT JOIN package_item_counts pic ON pic.orderId = po.id
LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
      ${whereClause}
      GROUP BY
  o.id,
  po.id,
  po.invNo,
  o.sheduleDate,
  dti.id,
  dt.id,
  dti.isComplete,
  dt.userId,
  coff.empId,
  coff.firstNameEnglish,
  coff.lastNameEnglish,
  po.outDlvrDate,
  pic.totalItems,
  pic.packedItems,
  pic.packageStatus,
  aic.totalAdditionalItems,
  aic.packedAdditionalItems,
  aic.additionalItemsStatus;

      `;

    console.log("Executing Data Query...");
    marketPlace.query(dataSql, params, (dataErr, dataResults) => {
      if (dataErr) {
        console.error("Error in data query:", dataErr);
        return reject(dataErr);
      }
      console.log("dataResults", dataResults);
      resolve({
        items: dataResults,
      });
    });
  });
};

exports.getCompanyAndCenter = (officerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT co.distributedCenterId, co.companyId FROM collection_officer.collectionofficer co WHERE co.id = 111`;

    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0]);
    });
  });
};

exports.checkEmailExistDC = async (email, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT COUNT(*) as count FROM distributedcenter WHERE email = ?`;
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

exports.checkCompanyNameExistDC = async (name, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT COUNT(*) as count FROM distributedcenter WHERE centerName = ?`;
    const params = [name];
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

exports.checkRegCodeExistDC = async (regCode, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT COUNT(*) as count FROM distributedcenter WHERE regCode = ?`;
    const params = [regCode];
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
exports.checkPhoneNumberExistDC = async (phoneNumber, excludeId = null) => {
  console.log("officer", excludeId);
  return new Promise((resolve, reject) => {
    let sql = `SELECT COUNT(*) as count 
               FROM distributedcenter 
               WHERE (contact01 = ? OR contact02 = ?)`;
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

exports.claimDistributedOfficersDao = (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE collectionofficer
      SET distributedCenterId = ?, irmId = ?, claimStatus = 1
      WHERE id = ?
    `;
    collectionofficer.query(
      sql,
      [data.centerId, data.irmId, data.id],
      (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results);
      }
    );
  });
};

exports.updateDistributedCompaanyCenterDao = async (companyId, centerId) => {
  return new Promise((resolve, reject) => {
    let sql = `
      UPDATE distributedcompanycenter 
      SET companyId = ? 
      WHERE centerId = ?
    `;
    const params = [companyId, centerId];

    collectionofficer.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

exports.getOfficerById = (id) => {
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

exports.GetAllDistributionCenterList = (companyId) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT dc.id, dc.regCode, dc.centerName FROM collection_officer.distributedcenter dc LEFT JOIN distributedcompanycenter dcc ON dc.id = dcc.centerId WHERE dcc.companyId = ?";
    collectionofficer.query(sql, [companyId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getAllReasons = async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM returnreason ORDER BY indexNo ASC";
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// Get reason by ID
exports.getReasonById = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM returnreason WHERE id = ?";
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};

// Create new reason
exports.createReason = async (reasonData) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO returnreason 
      (indexNo, rsnEnglish, rsnSinhala, rsnTamil) 
      VALUES (?, ?, ?, ?)`;

    const values = [
      reasonData.indexNo,
      reasonData.rsnEnglish,
      reasonData.rsnSinhala,
      reasonData.rsnTamil,
    ];

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve({ id: results.insertId, ...reasonData });
      }
    });
  });
};

// Delete reason (only if id > 1)
exports.deleteReason = async (id) => {
  return new Promise((resolve, reject) => {
    // Check if id is 1
    if (id === 1 || id === "1") {
      reject(new Error("Cannot delete the default reason (ID: 1)"));
      return;
    }

    const sql = "DELETE FROM returnreason WHERE id = ?";
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        if (results.affectedRows === 0) {
          reject(new Error("Reason not found"));
        } else {
          resolve(results.affectedRows);
        }
      }
    });
  });
};

// Update all indexes after reordering
exports.updateIndexes = async (reasons) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE returnreason SET indexNo = ? WHERE id = ?";

    let completed = 0;
    const total = reasons.length;

    if (total === 0) {
      resolve(true);
      return;
    }

    reasons.forEach((reason) => {
      collectionofficer.query(sql, [reason.indexNo, reason.id], (err) => {
        if (err) {
          reject(err);
        } else {
          completed++;
          if (completed === total) {
            resolve(true);
          }
        }
      });
    });
  });
};

exports.getNextIndex = async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT MAX(indexNo) as maxIndex FROM returnreason";
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        const nextIndex = (results[0].maxIndex || 0) + 1;
        resolve(nextIndex);
      }
    });
  });
};

exports.getAllHoldReasons = async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM holdreason ORDER BY indexNo ASC";
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// Get hold reason by ID
exports.getHoldReasonById = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM holdreason WHERE id = ?";
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};

// Create new hold reason
exports.createHoldReason = async (reasonData) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO holdreason 
      (indexNo, rsnEnglish, rsnSinhala, rsnTamil) 
      VALUES (?, ?, ?, ?)`;

    const values = [
      reasonData.indexNo,
      reasonData.rsnEnglish,
      reasonData.rsnSinhala,
      reasonData.rsnTamil,
    ];

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve({ id: results.insertId, ...reasonData });
      }
    });
  });
};

// Delete hold reason (only if id > 1)
exports.deleteHoldReason = async (id) => {
  return new Promise((resolve, reject) => {
    // Check if id is 1
    if (id === 1 || id === "1") {
      reject(new Error("Cannot delete the default reason (ID: 1)"));
      return;
    }

    const sql = "DELETE FROM holdreason WHERE id = ?";
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        if (results.affectedRows === 0) {
          reject(new Error("Reason not found"));
        } else {
          resolve(results.affectedRows);
        }
      }
    });
  });
};

// Update all indexes after reordering
exports.updateHoldReasonIndexes = async (reasons) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE holdreason SET indexNo = ? WHERE id = ?";

    let completed = 0;
    const total = reasons.length;

    if (total === 0) {
      resolve(true);
      return;
    }

    reasons.forEach((reason) => {
      collectionofficer.query(sql, [reason.indexNo, reason.id], (err) => {
        if (err) {
          reject(err);
        } else {
          completed++;
          if (completed === total) {
            resolve(true);
          }
        }
      });
    });
  });
};

// Get next available index for hold reasons
exports.getNextHoldReasonIndex = async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT MAX(indexNo) as maxIndex FROM holdreason";
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        const nextIndex = (results[0].maxIndex || 0) + 1;
        resolve(nextIndex);
      }
    });
  });
};

exports.getAllTodaysDeliveries = (searchParams = {}) => {
  return new Promise((resolve, reject) => {
    // Base SQL query
    let sql = `
      SELECT 
        po.id,
        po.invNo,
        COALESCE(dc.regCode, dc2.regCode) AS regCode,
        COALESCE(dc.centerName, dc2.centerName) AS centerName,
        o.sheduleTime,
        o.sheduleDate,
        po.createdAt,
        po.status,
        TIME(po.outDlvrDate) as outDlvrTime,
        dro.createdAt AS collectTime,
        drv.empId AS driverEmpId,
        CONCAT(drv.phoneCode01, drv.phoneNumber01) AS driverPhone,
        dro.startTime AS driverStartTime,
        drr.createdAt AS returnTime,
        po.deliveredTime AS deliveryTime,
        dho.createdAt AS holdTime
      FROM 
        market_place.processorders po
      INNER JOIN 
        market_place.orders o ON po.orderId = o.id
      LEFT JOIN 
        collection_officer.distributedcenter dc ON o.centerId = dc.id
      LEFT JOIN
        collection_officer.driverorders dro ON po.id = dro.orderId
      LEFT JOIN
        collection_officer.collectionofficer drv ON dro.driverId = drv.id
      LEFT JOIN
        collection_officer.driverholdorders dho ON dro.id = dho.drvOrderId
        AND dho.id = (
            SELECT MAX(id) 
            FROM collection_officer.driverholdorders 
            WHERE drvOrderId = dro.id
        )
      LEFT JOIN 
        collection_officer.driverreturnorders drr ON dro.id = drr.drvOrderId
      LEFT JOIN 
        collection_officer.collectionofficer cof2 ON po.outBy = cof2.id
      LEFT JOIN
        collection_officer.distributedcenter dc2 ON cof2.distributedCenterId = dc2.id
      WHERE 
        DATE(o.sheduleDate) = CURDATE()
      `;
    // DATE(o.sheduleDate) = CURDATE()
    // Add search conditions if search parameters are provided
    const conditions = [];
    const values = [];

    if (searchParams.activeTab) {
      console.log(searchParams.activeTab);
      if (searchParams.activeTab === "out-for-delivery") {
        conditions.push(`po.status = ?`);
        values.push("Out For Delivery");
      } else if (searchParams.activeTab === "collected") {
        conditions.push(`po.status = ?`);
        values.push("Collected");
      } else if (searchParams.activeTab === "on-the-way") {
        conditions.push(`po.status = ?`);
        values.push("On the way");
      } else if (searchParams.activeTab === "hold") {
        conditions.push(`po.status = ?`);
        values.push("Hold");
      } else if (searchParams.activeTab === "return") {
        conditions.push(`po.status = ?`);
        values.push("Return");
      } else if (searchParams.activeTab === "delivered") {
        conditions.push(`po.status = ?`);
        values.push("Delivered");
      } else if (searchParams.activeTab === "all") {
        conditions.push(
          ` po.status IN ('Out For Delivery', 'Collected', 'On the way', 'Hold', 'Return', 'Delivered') `
        );
      }
    }

    if (searchParams.regCode) {
      console.log("searchParams.regCode", searchParams.regCode);

      conditions.push(`(dc.id = ? OR dc2.id = ?)`);
      values.push(searchParams.regCode, searchParams.regCode);
    }

    if (searchParams.invNo) {
      conditions.push(`po.invNo LIKE ?`);
      values.push(`%${searchParams.invNo}%`);
    }

    // Append search conditions to the WHERE clause
    if (conditions.length > 0) {
      sql += ` AND (${conditions.join(" AND ")})`;
    }

    // Add ORDER BY clause
    sql += ` ORDER BY po.createdAt DESC`;

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getTargetedCustomerOrdersDao = (
  page,
  limit,
  status,
  sheduleDate,
  centerId,
  searchText
) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    const statusCTE = `
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
    `;

    let countSql =
      statusCTE +
      `
        SELECT COUNT(*) AS total
        FROM distributedtarget dt
        LEFT JOIN distributedtargetitems dti ON dti.targetId = dt.id
        LEFT JOIN distributedcompanycenter dcc ON dt.companycenterId = dcc.id
        LEFT JOIN distributedcenter dc ON dcc.centerId = dc.id
        LEFT JOIN market_place.processorders po ON dti.orderId = po.id
        LEFT JOIN market_place.orders o ON po.orderId = o.id
        LEFT JOIN market_place.marketplaceusers mu ON o.userId = mu.id
        LEFT JOIN collectionofficer cof ON po.packBy = cof.id
        LEFT JOIN package_item_counts pic ON pic.orderId = po.id
        LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
        WHERE 1=1
      `;

    let dataSql =
      statusCTE +
      `
        SELECT 
          po.invNo,
          CONCAT(mu.phoneCode, '-', mu.phoneNumber) phoneNum,
          dc.regCode,
          dc.centerName,
          o.sheduleDate,
          COALESCE(pic.packageStatus, 'Unknown') AS packageStatus,
          COALESCE(aic.additionalItemsStatus, 'Unknown') AS additionalItemsStatus,
          cof.empId,
          dt.createdAt
        FROM distributedtarget dt
        LEFT JOIN distributedtargetitems dti ON dti.targetId = dt.id
        LEFT JOIN distributedcompanycenter dcc ON dt.companycenterId = dcc.id
        LEFT JOIN distributedcenter dc ON dcc.centerId = dc.id
        LEFT JOIN market_place.processorders po ON dti.orderId = po.id
        LEFT JOIN market_place.orders o ON po.orderId = o.id
        LEFT JOIN market_place.marketplaceusers mu ON o.userId = mu.id
        LEFT JOIN collectionofficer cof ON po.packBy = cof.id
        LEFT JOIN package_item_counts pic ON pic.orderId = po.id
        LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
        WHERE 1=1
    `;

    const countParams = [];
    const dataParams = [];

    if (sheduleDate) {
      const cond = ` AND DATE(o.sheduleDate) = DATE(?) `;
      countSql += cond;
      dataSql += cond;
      countParams.push(sheduleDate);
      dataParams.push(sheduleDate);
    }

    if (centerId) {
      const cond = ` AND dcc.centerId = ? `;
      countSql += cond;
      dataSql += cond;
      countParams.push(centerId);
      dataParams.push(centerId);
    }

    if (searchText) {
      const digitsOnly = searchText.replace(/\D/g, "");
      const searchPattern = `%${searchText}%`;
      const phonePattern = `%${digitsOnly}%`;

      const cond = `
        AND (
          po.invNo LIKE ? 
          OR REPLACE(REPLACE(CONCAT(mu.phoneCode, mu.phoneNumber), '+', ''), '-', '') LIKE ?
        )
      `;
      countSql += cond;
      dataSql += cond;
      countParams.push(searchPattern, phonePattern);
      dataParams.push(searchPattern, phonePattern);
    }

    if (status && status.trim() !== "") {
      let statusCondition = "";
      if (status === "Pending") {
        statusCondition = `
          AND (
            (pic.packageStatus = 'Pending' AND (aic.additionalItemsStatus = 'Unknown' OR aic.additionalItemsStatus IS NULL)) OR
            (pic.packageStatus = 'Unknown' AND aic.additionalItemsStatus = 'Pending') OR
            (pic.packageStatus IS NULL AND aic.additionalItemsStatus = 'Pending') OR
            (pic.packageStatus = 'Pending' AND aic.additionalItemsStatus = 'Pending')
          )
        `;
      } else if (status === "Opened") {
        statusCondition = `
          AND (pic.packageStatus = 'Opened' OR aic.additionalItemsStatus = 'Opened')
        `;
      } else if (status === "Completed") {
        statusCondition = `
          AND (
            (pic.packageStatus = 'Completed' AND (aic.additionalItemsStatus = 'Unknown' OR aic.additionalItemsStatus IS NULL)) OR
            (pic.packageStatus = 'Unknown' AND aic.additionalItemsStatus = 'Completed') OR
            (pic.packageStatus IS NULL AND aic.additionalItemsStatus = 'Completed') OR
            (pic.packageStatus = 'Completed' AND aic.additionalItemsStatus = 'Completed')
          )
        `;
      }
      countSql += statusCondition;
      dataSql += statusCondition;
    }

    dataSql += ` ORDER BY po.createdAt DESC LIMIT ? OFFSET ?`;
    dataParams.push(parseInt(limit), parseInt(offset));

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

exports.getReturnRecievedDataDao = (
  receivedTime,
  centerId,
  deliveryLocationData,
  searchText
) => {
  return new Promise((resolve, reject) => {
    let dataSql = `
      SELECT do.id, 
        coff.id AS driverId, 
        coff.empId, 
        po.id AS processOrderId, 
        po.invNO, 
        o.id AS orderId, 
        o.total, 
        o.centerId, 
        mp.phoneCode,
        mp.phoneNumber,
        o.sheduleDate, 
        oh.city AS houseCity,
        oa.city AS apartmentCity, 
        rr.rsnEnglish AS reason,
        dro.note AS other, 
        dro.createdAt AS returnAt, 
        do.receivedTime, 
        do.handOverOfficer
      FROM collection_officer.driverorders do
      LEFT JOIN collection_officer.collectionofficer coff ON do.driverId = coff.id
      LEFT JOIN market_place.processorders po ON do.orderId = po.id
      LEFT JOIN market_place.orders o ON po.orderId = o.id
      LEFT JOIN market_place.marketplaceusers mp ON mp.id = o.userId
      LEFT JOIN market_place.orderhouse oh ON oh.orderId = o.id
      LEFT JOIN market_place.orderapartment oa ON oa.orderId = o.id
      LEFT JOIN collection_officer.driverreturnorders dro ON dro.drvOrderId = do.id
      LEFT JOIN collection_officer.returnreason rr ON dro.returnReasonId = rr.id
      LEFT JOIN collection_officer.distributedcenter dc1 ON dc1.id = o.centerId
      WHERE do.drvStatus = 'Return Received'
    `;
    const dataParams = [];

    if (deliveryLocationData && deliveryLocationData.length > 0) {
      dataParams.push(deliveryLocationData, deliveryLocationData);
    }

    if (centerId) {
      dataParams.push(centerId);
    }

    if (centerId) {
      dataSql += ` AND (`;

      if (deliveryLocationData && deliveryLocationData.length > 0) {
        dataSql += `(oh.city IN (?) OR oa.city IN (?)) OR `;
        dataParams.push(deliveryLocationData, deliveryLocationData);
      }

      dataSql += ` o.centerId = ? )`;
      dataParams.push(centerId);
    }

    if (receivedTime) {
      const cond = ` AND DATE(do.receivedTime) = DATE(?) `;
      dataSql += cond;
      dataParams.push(receivedTime);
    }

    if (searchText) {
      const searchPattern = `%${searchText}%`;
      dataSql += `
        AND (
          po.invNO LIKE ? OR
          CONCAT(mp.phoneCode, ' ', mp.phoneNumber) LIKE ? OR
          CONCAT(mp.phoneCode, mp.phoneNumber) LIKE ? OR
          dc1.centerName LIKE ? OR
          oh.city LIKE ? OR
          oa.city LIKE ?
        )
      `;

      dataParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    dataSql += ` ORDER BY po.createdAt DESC`;

    collectionofficer.query(dataSql, dataParams, (dataErr, dataResults) => {
      if (dataErr) {
        reject(dataErr);
      } else {
        resolve({
          total: dataResults.length,
          items: dataResults,
        });
      }
    });
  });
};

exports.getDeliveryChargeCity = (companyCenterId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT dc.city 
      FROM collection_officer.centerowncity coc
      LEFT JOIN collection_officer.deliverycharge dc 
        ON coc.cityId = dc.id
      WHERE coc.companyCenterId = ?
    `;

    collectionofficer.query(sql, [companyCenterId], (err, results) => {
      if (err) {
        return reject(err);
      }

      // Map result rows into an array of city values
      const cities = results.map((row) => row.city);
      resolve(cities);
    });
  });
};

exports.getAllCityCenterMapping = (companyId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        dc.city,
        dcc.centerId,
        dist.centerName,
        dist.regCode
      FROM collection_officer.distributedcompanycenter dcc
      JOIN collection_officer.centerowncity coc ON dcc.id = coc.companyCenterId
      JOIN collection_officer.deliverycharge dc ON coc.cityId = dc.id
      LEFT JOIN collection_officer.distributedcenter dist ON dcc.centerId = dist.id
      WHERE dcc.companyId = ?
    `;

    collectionofficer.query(sql, [companyId], (err, results) => {
      if (err) {
        return reject(err);
      }

      // Create a map: city -> centerId
      const cityToCenterMap = {};
      results.forEach((row) => {
        cityToCenterMap[row.city.toLowerCase()] = {
          centerId: row.centerId,
          centerName: row.centerName,
          regCode: row.regCode,
        };
      });

      resolve(cityToCenterMap);
    });
  });
};

exports.getCenterName = (centerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT centerName, regCode 
      FROM collection_officer.distributedcenter 
      WHERE id = ?
    `;

    collectionofficer.query(sql, [centerId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0] || null);
    });
  });
};

exports.getDistributedVehiclesDao = (
  page,
  limit,
  centerName,
  vehicleType,
  searchText
) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let countSql = `
      SELECT COUNT(DISTINCT co.id) AS total
      FROM collectionofficer co
      LEFT JOIN vehicleregistration vr ON co.id = vr.coId
      INNER JOIN distributedcenter dc ON co.distributedCenterId = dc.id
      WHERE co.jobRole = 'Driver'
    `;

    let dataSql = `
      SELECT 
        vr.insNo,
        vr.vType,
        vr.vCapacity,
        dc.regCode,
        dc.centerName,
        co.empId,
        co.createdAt
      FROM collectionofficer co
      LEFT JOIN vehicleregistration vr ON co.id = vr.coId
      INNER JOIN distributedcenter dc ON co.distributedCenterId = dc.id
      WHERE co.jobRole = 'Driver'
    `;

    const countParams = [];
    const dataParams = [];

    if (centerName) {
      const cond = ` AND dc.centerName = ? `;
      countSql += cond;
      dataSql += cond;
      countParams.push(centerName);
      dataParams.push(centerName);
    }

    if (vehicleType) {
      const cond = ` AND vr.vType = ? `;
      countSql += cond;
      dataSql += cond;
      countParams.push(vehicleType);
      dataParams.push(vehicleType);
    }

    if (searchText) {
      const pattern = `%${searchText}%`;
      const cond = `
        AND (
          COALESCE(vr.insNo, '') LIKE ?
          OR COALESCE(co.empId, '') LIKE ?
        )
      `;

      countSql += cond;
      dataSql += cond;
      countParams.push(pattern, pattern);
      dataParams.push(pattern, pattern);
    }

    dataSql += ` ORDER BY co.createdAt DESC LIMIT ? OFFSET ? `;
    dataParams.push(parseInt(limit), parseInt(offset));

    collectionofficer.query(countSql, countParams, (countErr, countRes) => {
      if (countErr) {
        reject(countErr);
      } else {
        collectionofficer.query(dataSql, dataParams, (dataErr, dataRes) => {
          if (dataErr) {
            reject(dataErr);
          } else {
            resolve({
              total: countRes[0].total,
              items: dataRes,
            });
          }
        });
      }
    });
  });
};

exports.getTodayDiliveryTrackingCenterDetailsDao = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        po.id,
        po.invNo,   
      	po.outDlvrDate,
      	dc.centerName,
      	dc.regCode
      FROM processorders po
      LEFT JOIN collection_officer.collectionofficer cof1 ON po.outBy = cof1.id
      LEFT JOIN collection_officer.distributedcenter dc ON cof1.distributedCenterId = dc.id
      WHERE po.id = ?
    `;

    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};

exports.getTodayDiliveryTrackingDriverDetailsDao = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
          dor.id AS orderId,
          drv.empId,
          CONCAT(drv.firstNameEnglish, ' ', drv.lastNameEnglish) AS driverName,
          CONCAT(drv.phoneCode01, drv.phoneNumber01) AS driverPhone,
          dor.createdAt AS collectTime,
          dor.startTime,
          (
              SELECT JSON_ARRAYAGG(
                  JSON_OBJECT(
                  	 'holdId',dho.id,
                      'holdTime', dho.createdAt,
                      'holdReason', hr.rsnEnglish,
                      'restartedTime', dho.restartedTime
                  )
              )
              FROM driverholdorders dho
              LEFT JOIN holdreason hr ON dho.holdReasonId = hr.id
              WHERE dho.drvOrderId = dor.id
          ) AS holdDetails,
          rr.rsnEnglish AS returnReson,
          dro.note AS returnNote,
          dro.createdAt AS returnTime,
          dor.receivedTime AS returnRecivedTime,
          po.deliveredTime AS completeTime,
          dor.handOverTime AS moneyHandoverTime
      FROM driverorders dor
      LEFT JOIN collectionofficer drv ON dor.driverId = drv.id
      LEFT JOIN driverreturnorders dro ON dor.id = dro.drvOrderId
      LEFT JOIN returnreason rr ON dro.returnReasonId = rr.id
      LEFT JOIN market_place.processorders po ON dor.orderId = po.id
      WHERE dor.orderId = ?
    `;

    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};

exports.getDistributedDriversAndVehiclesDao = (
  distributedCompanyCenterId,
  page,
  limit,
  status,
  vehicleType,
  searchText
) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let whereConditions = ` WHERE dcc.id = ? AND co.empId LIKE 'DRV%' `;
    let params = [distributedCompanyCenterId];

    if (status) {
      whereConditions += ` AND co.status = ? `;
      params.push(status);
    }

    if (vehicleType) {
      whereConditions += ` AND vr.vType = ? `;
      params.push(vehicleType);
    }

    if (searchText) {
      whereConditions += `
        AND (
          co.empId LIKE ?
          OR co.phoneNumber01 LIKE ?
          OR co.nic LIKE ?
        )
      `;
      params.push(`%${searchText}%`, `%${searchText}%`, `%${searchText}%`);
    }

    const countSql = `
      SELECT COUNT(*) AS total
      FROM distributedcompanycenter dcc
      INNER JOIN distributedcenter dc ON dcc.centerId = dc.id
      INNER JOIN collectionofficer co ON co.distributedCenterId = dc.id
      LEFT JOIN vehicleregistration vr ON co.id = vr.coId
      ${whereConditions}
    `;

    const dataSql = `
      SELECT 
        co.id AS officerId,
        co.empId,
        co.firstNameEnglish AS firstName,
        co.lastNameEnglish AS lastName,
        vr.vType AS vehicleType,
        vr.vCapacity AS capacity,
        co.phoneNumber01 AS phone,
        co.phoneNumber02,
        co.nic,
        co.status,
        dc.id AS distributedCenterId,
        dc.centerName,
        dc.regCode
      FROM distributedcompanycenter dcc
      INNER JOIN distributedcenter dc ON dcc.centerId = dc.id
      INNER JOIN collectionofficer co ON co.distributedCenterId = dc.id
      LEFT JOIN vehicleregistration vr ON co.id = vr.coId
      ${whereConditions}
      ORDER BY co.empId
      LIMIT ? OFFSET ?
    `;

    collectionofficer.query(countSql, params, (err, countResult) => {
      if (err) return reject(err);

      const total = countResult[0].total;

      collectionofficer.query(
        dataSql,
        [...params, limit, offset],
        (err, results) => {
          if (err) return reject(err);

          resolve({
            total,
            items: results,
          });
        }
      );
    });
  });
};

exports.getDistributedCenterPikupOderDao = (searchParams = {}) => {
  return new Promise((resolve, reject) => {
    // Base SQL query
    let sql = `
    SELECT
    po.id AS processOrderId,
    po.invNo,
    o.fullTotal,
    po.status,
    mu.title AS customerTitle,
    mu.firstName,
    mu.lastName,
    mu.phoneCode AS customerPhoneCode,
    mu.phoneNumber AS customerPhoneNumber,
    o.phonecode1 AS receiverPhoneCode1,
    o.phone1 AS receiverPhone1,
    o.phonecode2 AS receiverPhoneCode2,
    o.phone2 AS receiverPhone2,
    o.sheduleDate,
    o.sheduleTime,
    o.title,
    o.fullName,
    o.orderApp,
    o.createdAt AS orderCreatedAt,
    po.isPaid,
    paymentMethod
FROM collection_officer.distributedtarget dt
LEFT JOIN collection_officer.distributedtargetitems dti ON dt.id = dti.targetId
LEFT JOIN market_place.processorders po ON dti.orderId = po.id
LEFT JOIN market_place.orders o ON po.orderId = o.id
LEFT JOIN market_place.marketplaceusers mu ON o.userId = mu.id
WHERE 1=1
    `;

    const conditions = [];
    const values = [];

    // Required parameter: companycenterId
    if (searchParams.companycenterId) {
      conditions.push(`dt.companycenterId = ?`);
      values.push(searchParams.companycenterId);
    } else {
      return reject(new Error("companycenterId is required"));
    }

    // Filter by status based on activeTab
    if (searchParams.activeTab) {
      if (searchParams.activeTab === 'Ready to Pickup') {
        conditions.push(`po.status = ?`);
        values.push('Ready to Pickup');
      } else if (searchParams.activeTab === 'Picked Up') {
        conditions.push(`po.status = ?`);
        values.push('Picked up');
      } else if (searchParams.activeTab === 'All') {
        // For "All" tab, show both statuses
        conditions.push(`po.status IN ('Ready to Pickup', 'Picked up')`);
      }
    } else {
      // Default to both statuses
      conditions.push(`po.status IN ('Ready to Pickup', 'Picked up')`);
    }

    // Date filter - FIXED: Use proper date handling
    if (searchParams.date) {
      let dateValue;

      if (typeof searchParams.date === "string") {
        dateValue = searchParams.date.trim();
      } else if (searchParams.date instanceof Date) {
        dateValue = searchParams.date.toISOString().split("T")[0];
      }

      if (dateValue && dateValue !== "") {
        // Handle both date-only and datetime strings
        conditions.push(`DATE(o.sheduleDate) = DATE(?)`);
        values.push(dateValue);
      }
    }

    // Time filter - FIXED: Match time slot values
    if (searchParams.time && searchParams.time.trim() !== "") {
      const timeValue = searchParams.time.trim();
      // Try to match common time formats
      const timeMap = {
        "8AM-12PM": "8AM-12PM",
        "12PM-4PM": "12PM-4PM",
        "4PM-8PM": "4PM-8PM",
        "8AM - 12PM": "8AM-12PM",
        "12PM - 4PM": "12PM-4PM",
        "4PM - 8PM": "4PM-8PM",
      };

      const normalizedTime = timeMap[timeValue] || timeValue;
      conditions.push(`o.sheduleTime = ?`);
      values.push(normalizedTime);
    }

    // Search text filter - FIXED: Better phone number concatenation
    if (searchParams.searchText && searchParams.searchText.trim() !== "") {
      const searchPattern = `%${searchParams.searchText.trim()}%`;
      conditions.push(`(
        po.invNo LIKE ? OR 
        mu.phoneNumber LIKE ? OR
        o.phone1 LIKE ? OR
        CONCAT(mu.phoneCode, mu.phoneNumber) LIKE ? OR
        CONCAT(o.phonecode1, o.phone1) LIKE ?
      )`);
      values.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    // Append all conditions to the WHERE clause
    if (conditions.length > 0) {
      sql += ` AND (${conditions.join(" AND ")})`;
    }

    // Add ORDER BY clause
    sql += `
    ORDER BY 
        o.sheduleDate ASC,
        o.sheduleTime ASC,
        po.invNo DESC
    `;

    // Debug logging
    console.log("SQL Query:", sql);
    console.log("SQL Parameters:", values);
    console.log("Search Params Received:", searchParams);

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        reject(err);
      } else {
        console.log(`Query returned ${results.length} results`);
        resolve(results);
      }
    });
  });
};

exports.getPikupOderRecordsDetailsDao = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        po.id,
        po.outDlvrDate AS outTime,
        outOf.empId AS outOfficer,
        po.deliveredTime
      FROM processorders po
      LEFT JOIN collection_officer.collectionofficer outOf ON po.outBy = outOf.id
      WHERE po.id = ?
    `;

    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};


exports.getCenterHomeDeliveryOrdersDao = (activeTab, status, searchText, date, deliveryLocationData, centerId, timeSlot) => {
  console.log('date', date)
  return new Promise((resolve, reject) => {

    const dataParams = [];

    if (deliveryLocationData && deliveryLocationData.length > 0) {
      dataParams.push(deliveryLocationData, deliveryLocationData);
    }

    dataParams.push(centerId);

    let sortSql = `ORDER BY o.sheduleDate DESC`;
    let wheresql = ` WHERE 
    po.isTargetAssigned = 1 
    AND (
      ${deliveryLocationData && deliveryLocationData.length > 0
        ? "(oh.city IN (?) OR oa.city IN (?)) OR"
        : ""}
      o.centerId = ?
    )`

      if (status) {
        wheresql += " AND po.status LIKE ? ";
      dataParams.push(status);
    }

    if (date) {
      console.log('date', date)

      switch (activeTab) {
    
        case 'all':
          wheresql += " AND DATE(o.sheduleDate) = ? ";
          break;
    
        case 'out-for-delivery':
          console.log('out', 'date', date)
          wheresql += " AND DATE(po.outDlvrDate) = ? ";
          break;
        
        case 'Picked Up':
          wheresql += " AND DATE(po.deliveredTime) = ? ";
          break;
      
        case 'Ready to Pickup':
          wheresql += " AND DATE(po.outDlvrDate) = ? ";
          break;
        
        case 'Return Received':
          wheresql += " AND DATE(dor.receivedTime) = ? ";
          break;

        case 'on-the-way':
          wheresql += "AND DATE(dor.startTime) = ? ";
          break;
    
        case 'return':
          wheresql += "AND DATE(dro.createdAt) = ? ";
          break;
        
        case 'delivered':
          wheresql += " AND DATE(po.deliveredTime) = ? ";
          break;

        case 'hold':
          wheresql += " AND DATE(dho.createdAt) = ? ";
          break;

        case 'Return Received':
          wheresql += " AND DATE(dor.receivedTime) = ? ";
          break;

        case 'Collected':
          wheresql += " AND DATE(dor.createdAt) = ? ";
          break;

        default:
          // optional fallback
          break;
      }
      dataParams.push(date);
    }

    if (timeSlot) {
      wheresql += ` AND o.sheduleTime LIKE ?`;
    dataParams.push(`%${timeSlot}%`);
  }

      if (searchText) {
      const searchCondition = `
          AND (
              po.invNo LIKE ?
              OR po.status LIKE ?
              OR CONCAT(mpu.phoneCode,' ',mpu.phoneNumber) LIKE ?
              OR CONCAT(o.phoneCode1,' ',o.phone1) LIKE ?
          )
      `;

      wheresql += searchCondition;
      const searchValue = `%${searchText}%`;
      dataParams.push(searchValue, searchValue, searchValue, searchValue);
  }

    if (activeTab) {
      switch (activeTab) {
    
        case 'all':
          wheresql += "AND po.status IN ('Out For Delivery', 'Collected', 'On the way', 'Return', 'Hold', 'Delivered', 'Return Received')";
          sortSql = " ORDER BY o.sheduleDate DESC";
          break;
    
        case 'out-for-delivery':
          wheresql += " AND po.status = 'Out For Delivery' ";
          sortSql = " ORDER BY po.outDlvrDate DESC"
          break;

        case 'delivered':
          wheresql += " AND po.status = 'Delivered' ";
          sortSql = " ORDER BY po.deliveredTime DESC"
          break;
      
    
        case 'on-the-way':
          wheresql += " AND po.status = 'On the way' ";
          sortSql = " ORDER BY dor.startTime DESC"
          break;
    
        case 'return':
          wheresql += " AND po.status = 'Return' ";
          sortSql = " ORDER BY dro.createdAt DESC"
          break;

        case 'hold':
          wheresql += " AND po.status = 'Hold' ";
          sortSql = " ORDER BY dho.createdAt DESC"
          break;

        case 'Return Received':
          wheresql += " AND po.status = 'Return Received' ";
          sortSql = " ORDER BY dor.receivedTime DESC"
          break;

        case 'Collected':
          wheresql += " AND po.status = 'Collected' ";
          sortSql = " ORDER BY dor.createdAt DESC"
          break;
    
        default:
          // optional fallback
          break;
      }
    }

    // Base SQL query
    let sql = `
    SELECT
    po.id,
    po.invNo,
    dc.regCode,
    o.sheduleTime,
    o.sheduleDate,
    o.phoneCode1,
    o.phone1,
    o.fullTotal AS total,
    po.createdAt,
    po.status,
    mpu.title,
    CONCAT(mpu.firstName,' ',mpu.lastName) AS customerName,
    CONCAT(mpu.phoneCode,' ',mpu.phoneNumber) AS customerPhone,
    o.fullName,
    o.title AS recieverTitle,
    o.phone2,
    o.phoneCode2,
    o.orderApp,
    po.isPaid,
    po.paymentMethod,
    po.outDlvrDate AS outDlvrTime,

    dor.createdAt AS collectedTime,
    dor.startTime,

    dro.createdAt AS returnTime,
    dor.receivedTime AS returnRecivedTime,
    dor.handOverTime AS moneyHandoverTime,

    po.deliveredTime AS completeTime,
    dho.createdAt AS holdTime

FROM market_place.processorders po

LEFT JOIN collection_officer.driverorders dor 
       ON po.id = dor.orderId

LEFT JOIN collection_officer.driverholdorders dho 
       ON dho.id = (
           SELECT dho2.id
           FROM collection_officer.driverholdorders dho2
           WHERE dho2.drvOrderId = dor.id
           ORDER BY dho2.createdAt DESC
           LIMIT 1
       )

LEFT JOIN collection_officer.driverreturnorders dro 
       ON dro.id = (
           SELECT dro2.id
           FROM collection_officer.driverreturnorders dro2
           WHERE dro2.drvOrderId = dor.id
           ORDER BY dro2.createdAt DESC
           LIMIT 1
       )

LEFT JOIN market_place.orders o ON po.orderId = o.id
LEFT JOIN market_place.orderhouse oh ON oh.orderId = o.id
LEFT JOIN market_place.orderapartment oa ON oa.orderId = o.id
LEFT JOIN collection_officer.distributedcenter dc ON o.centerId = dc.id
LEFT JOIN market_place.marketplaceusers mpu ON o.userId = mpu.id

      ${wheresql}
      ${sortSql}
      `;

    marketPlace.query(sql, dataParams, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};


// exports.getCenterHomeDeliveryOrdersDao = (searchParams = {}) => {
//   return new Promise((resolve, reject) => {
//     // Base SQL query
//     let sql = `
//       SELECT 
//         po.id,
//         po.invNo,
//         COALESCE(dc.regCode, dc2.regCode) AS regCode,
//         COALESCE(dc.centerName, dc2.centerName) AS centerName,
//         o.sheduleTime,
//         o.sheduleDate,
//         po.createdAt,
//         po.status,
//         TIME(po.outDlvrDate) as outDlvrTime,
//         dro.createdAt AS collectTime,
//         drv.empId AS driverEmpId,
//         CONCAT(drv.phoneCode01, drv.phoneNumber01) AS driverPhone,
//         dro.startTime AS driverStartTime,
//         drr.createdAt AS returnTime,
//         po.deliveredTime AS deliveryTime,
//         dho.createdAt AS holdTime
//       FROM 
//         market_place.processorders po
//       INNER JOIN 
//         market_place.orders o ON po.orderId = o.id
//       LEFT JOIN 
//         collection_officer.distributedcenter dc ON o.centerId = dc.id
//       LEFT JOIN
//         collection_officer.driverorders dro ON po.id = dro.orderId
//       LEFT JOIN
//         collection_officer.collectionofficer drv ON dro.driverId = drv.id
//       LEFT JOIN
//         collection_officer.driverholdorders dho ON dro.id = dho.drvOrderId
//         AND dho.id = (
//             SELECT MAX(id) 
//             FROM collection_officer.driverholdorders 
//             WHERE drvOrderId = dro.id
//         )
//       LEFT JOIN 
//         collection_officer.driverreturnorders drr ON dro.id = drr.drvOrderId
//       LEFT JOIN 
//         collection_officer.collectionofficer cof2 ON po.outBy = cof2.id
//       LEFT JOIN
//         collection_officer.distributedcenter dc2 ON cof2.distributedCenterId = dc2.id
//       WHERE 
//         DATE(o.sheduleDate) = CURDATE()
//       `;
//     // DATE(o.sheduleDate) = CURDATE()
//     // Add search conditions if search parameters are provided
//     const conditions = [];
//     const values = [];

//     if (searchParams.activeTab) {
//       console.log(searchParams.activeTab);
//       if (searchParams.activeTab === "out-for-delivery") {
//         conditions.push(`po.status = ?`);
//         values.push("Out For Delivery");
//       } else if (searchParams.activeTab === "collected") {
//         conditions.push(`po.status = ?`);
//         values.push("Collected");
//       } else if (searchParams.activeTab === "on-the-way") {
//         conditions.push(`po.status = ?`);
//         values.push("On the way");
//       } else if (searchParams.activeTab === "hold") {
//         conditions.push(`po.status = ?`);
//         values.push("Hold");
//       } else if (searchParams.activeTab === "return") {
//         conditions.push(`po.status = ?`);
//         values.push("Return");
//       } else if (searchParams.activeTab === "delivered") {
//         conditions.push(`po.status = ?`);
//         values.push("Delivered");
//       } else if (searchParams.activeTab === "all") {
//         conditions.push(
//           ` po.status IN ('Out For Delivery', 'Collected', 'On the way', 'Hold', 'Return', 'Delivered') `
//         );
//       }
//     }

//     if (searchParams.regCode) {
//       console.log("searchParams.regCode", searchParams.regCode);

//       conditions.push(`(dc.id = ? OR dc2.id = ?)`);
//       values.push(searchParams.regCode, searchParams.regCode);
//     }

//     if (searchParams.invNo) {
//       conditions.push(`po.invNo LIKE ?`);
//       values.push(`%${searchParams.invNo}%`);
//     }

//     // Append search conditions to the WHERE clause
//     if (conditions.length > 0) {
//       sql += ` AND (${conditions.join(" AND ")})`;
//     }

//     // Add ORDER BY clause
//     sql += ` ORDER BY po.createdAt DESC`;

//     marketPlace.query(sql, values, (err, results) => {
//       if (err) {
//         return reject(err);
//       }
//       resolve(results);
//     });
//   });
// };


exports.getPolygonCenterDashbordDetailsDao = (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
          COALESCE(SUM(dro.handOverPrice), 0) + COALESCE(SUM(pio.handOverPrice), 0) AS total_price,
          COUNT(po.id) AS total_orders
      FROM market_place.processorders po
      LEFT JOIN driverorders dro ON po.id = dro.orderId
      LEFT JOIN collectionofficer cof_dro ON dro.handOverOfficer = cof_dro.id 
          AND cof_dro.companyId = ? 
          AND cof_dro.distributedCenterId = ?
      LEFT JOIN pickuporders pio ON po.id = pio.orderId
      LEFT JOIN collectionofficer cof_pio_issued ON pio.orderIssuedOfficer = cof_pio_issued.id 
          AND cof_pio_issued.companyId = ?
          AND cof_pio_issued.distributedCenterId = ?
      LEFT JOIN collectionofficer cof_pio_handover ON pio.handOverOfficer = cof_pio_handover.id 
          AND cof_pio_handover.companyId = ?
          AND cof_pio_handover.distributedCenterId = ?
      WHERE DATE(dro.handOverTime) = CURDATE() OR DATE(pio.handOverTime) = CURDATE()
    `;

    collectionofficer.query(sql, [
      data.companyId, data.centerId, 
      data.companyId, data.centerId, 
      data.companyId, data.centerId
    ], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0]);
    });
  });
};

exports.getPickupCashRevenueDao = (data) => {
  return new Promise((resolve, reject) => {
    const {
      companyId,
      centerId,
      search,
      filterDate
    } = data;

    let sql = `
      SELECT
          pio.id,
          po.invNo,
          pio.handOverPrice,
          pio.handOverTime,
          cof_issued.empId AS issuedOfficerEmpId,
          cof_handover.empId AS handOverOfficerEmpId
      FROM collection_officer.pickuporders pio 
      LEFT JOIN market_place.processorders po ON po.id = pio.orderId
      LEFT JOIN collection_officer.collectionofficer cof_issued ON pio.orderIssuedOfficer = cof_issued.id
          AND cof_issued.companyId = ?
          AND cof_issued.distributedCenterId = ?
      LEFT JOIN collection_officer.collectionofficer cof_handover ON pio.handOverOfficer = cof_handover.id
          AND cof_handover.companyId = ?
          AND cof_handover.distributedCenterId = ?
      WHERE pio.id IS NOT NULL
    `;

    const params = [companyId, centerId, companyId, centerId];
    
    if (filterDate) {
      sql += ` AND DATE(pio.handOverTime) = ?`;
      params.push(filterDate);
    } else {
      sql += ` AND DATE(pio.handOverTime) = CURDATE()`;
    }

    if (search) {
      sql += ` AND po.invNo LIKE ?`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY pio.handOverTime DESC`;

    collectionofficer.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getDriverCashRevenueDao = (data) => {
  return new Promise((resolve, reject) => {
    const {
      companyId,
      centerId,
      search,
      filterDate
    } = data;

    let sql = `
      SELECT
          do.id,
          po.invNo,
          do.handOverPrice,
          do.handOverTime,
          cof_dro.empId AS driverEmpId,
          cof_handover.empId AS handOverOfficerEmpId
      FROM collection_officer.driverorders do 
      LEFT JOIN market_place.processorders po ON po.id = do.orderId
      LEFT JOIN collection_officer.collectionofficer cof_dro ON do.driverId = cof_dro.id
          AND cof_dro.companyId = ?
          AND cof_dro.distributedCenterId = ?
      LEFT JOIN collection_officer.collectionofficer cof_handover ON do.handOverOfficer = cof_handover.id
          AND cof_handover.companyId = ?
          AND cof_handover.distributedCenterId = ?
      WHERE do.id IS NOT NULL
    `;

    const params = [companyId, centerId, companyId, centerId];
    
    if (filterDate) {
      sql += ` AND DATE(do.handOverTime) = ?`;
      params.push(filterDate);
    } else {
      sql += ` AND DATE(do.handOverTime) = CURDATE()`;
    }

    if (search) {
      sql += ` AND po.invNo LIKE ?`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY do.handOverTime DESC`;

    collectionofficer.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};


exports.getHomeDiliveryTrackingCenterDetailsDao = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        po.id,
        po.invNo,   
      	po.outDlvrDate,
        po.deliveredTime,
        po.status,
      	dc.centerName,
      	dc.regCode,
        o.centerId,
        cof1.empId
      FROM processorders po
      LEFT JOIN collection_officer.collectionofficer cof1 ON po.outBy = cof1.id
      LEFT JOIN collection_officer.distributedcenter dc ON cof1.distributedCenterId = dc.id
      LEFT JOIN market_place.orders o ON po.orderId = o.id
      WHERE po.id = ?
    `;

    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};


exports.getHomeDiliveryTrackingDriverDetailsDao = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
          dor.id AS orderId,
          drv.empId,
          CONCAT(drv.firstNameEnglish, ' ', drv.lastNameEnglish) AS driverName,
          CONCAT('0', drv.phoneNumber01) AS driverPhone,
          dor.createdAt AS collectTime,
          dor.startTime,
          (
              SELECT JSON_ARRAYAGG(
                  JSON_OBJECT(
                  	 'holdId',dho.id,
                      'holdTime', dho.createdAt,
                      'holdReason', hr.rsnEnglish,
                      'restartedTime', dho.restartedTime
                  )
              )
              FROM driverholdorders dho
              LEFT JOIN holdreason hr ON dho.holdReasonId = hr.id
              WHERE dho.drvOrderId = dor.id
          ) AS holdDetails,
          rr.rsnEnglish AS returnReson,
          dro.note AS returnNote,
          dro.createdAt AS returnTime,
          dor.receivedTime AS returnRecivedTime,
          dor.handOverTime AS moneyHandoverTime,
          po.deliveredTime AS completeTime
      FROM driverorders dor
      LEFT JOIN collectionofficer drv ON dor.driverId = drv.id
      LEFT JOIN driverreturnorders dro ON dor.id = dro.drvOrderId
      LEFT JOIN returnreason rr ON dro.returnReasonId = rr.id
      LEFT JOIN market_place.processorders po ON dor.orderId = po.id
      WHERE dor.orderId = ?
    `;

    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};


exports.getRecivedPickUpCashDashbordDao = async (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
          COUNT(CASE WHEN po.deliveredTime IS NULL THEN 1 END) AS total_today,
          COUNT(CASE WHEN DATE(o.sheduleDate) = CURDATE() AND po.deliveredTime IS NULL THEN 1 END) AS scheduled_today,
          COUNT(CASE WHEN DATE(o.sheduleDate) != CURDATE() THEN 1 END) AS not_scheduled_today,
          COUNT(DISTINCT CASE WHEN DATE(por.handOverTime) = CURDATE() THEN por.orderId END) AS all_pickup,
          COUNT(DISTINCT CASE WHEN DATE(o.sheduleDate) = CURDATE() AND DATE(por.handOverTime) = CURDATE() THEN por.orderId END) AS today_pickup,
          COALESCE(SUM(DISTINCT CASE WHEN DATE(por.handOverTime) = CURDATE() THEN por.handOverPrice END), 0) AS order_price
      FROM market_place.processorders po
      INNER JOIN market_place.orders o ON po.orderId = o.id AND o.delivaryMethod = 'Pickup' AND po.paymentMethod = 'Cash'
      LEFT JOIN collection_officer.pickuporders por ON po.id = por.orderId
      LEFT JOIN collection_officer.collectionofficer cof1 ON po.outBy = cof1.id
      WHERE cof1.companyId = ? AND cof1.distributedCenterId = ?
    `;
    // DATE(po.outDlvrDate) = CURDATE()
    //COALESCE(SUM(DISTINCT por.handOverPrice), 0) AS order_price,

    marketPlace.query(sql, [data.companyId, data.centerId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};

exports.getRecivedDelivaryCashDashbordDao = async (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
          COUNT(CASE WHEN po.deliveredTime IS NULL THEN 1 END) AS total_today,
          COUNT(CASE WHEN DATE(o.sheduleDate) = CURDATE() AND po.deliveredTime IS NULL THEN 1 END) AS scheduled_today,
          COUNT(DISTINCT CASE WHEN DATE(dro.handOverTime) = CURDATE() THEN dro.orderId END) AS all_delivary,
          COUNT(DISTINCT CASE WHEN DATE(o.sheduleDate) = CURDATE() AND DATE(dro.handOverTime) = CURDATE() THEN dro.orderId END) AS today_delivary,
          COALESCE(SUM(DISTINCT CASE WHEN DATE(dro.handOverTime) = CURDATE() THEN dro.handOverPrice END), 0) AS order_price
      FROM market_place.processorders po
      INNER JOIN market_place.orders o ON po.orderId = o.id AND o.delivaryMethod = 'Delivery'
      LEFT JOIN collection_officer.driverorders dro ON po.id = dro.orderId AND dro.handOverTime IS NOT NULL
      LEFT JOIN collection_officer.collectionofficer cof1 ON po.outBy = cof1.id
      WHERE cof1.companyId = ? AND cof1.distributedCenterId = ?
    `;
    // DATE(po.outDlvrDate) = CURDATE()

    marketPlace.query(sql, [data.companyId, data.centerId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};