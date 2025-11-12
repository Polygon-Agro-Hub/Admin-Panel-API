const { plantcare } = require("../startup/database");

// Create a new certificate company
exports.createCertificateCompany = (
  companyName,
  regNumber,
  taxId,
  phoneCode1,
  phoneNumber1,
  phoneCode2,
  phoneNumber2,
  address,
  userId,
  logo
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO certificatecompany
      (comName, regNumber, taxId, phoneCode1, phoneNumber1, phoneCode2, phoneNumber2, address, logo, modifyBy, modifyDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const values = [
      companyName,
      regNumber,
      taxId,
      phoneCode1,
      phoneNumber1,
      phoneCode2 || null,
      phoneNumber2 || null,
      address,
      logo || null,
      userId,
    ];

    plantcare.query(sql, values, (err, results) => {
      if (err) reject(err);
      else resolve(results.insertId);
    });
  });
};

// Check if a certificate company with the given registration number exists
exports.checkByRegNumber = (regNumber, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT id FROM certificatecompany WHERE regNumber = ?`;
    const params = [regNumber];

    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }

    plantcare.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// Get all certificate companies with optional search
exports.getAllCertificateCompanies = (search) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        cc.id,
        cc.comName AS companyName, 
        cc.regNumber,
        cc.phoneCode1,
        cc.phoneNumber1,
        cc.createdAt,
        cc.modifyDate,                      
        au.userName AS modifiedByUser,      
        COUNT(c.id) AS certificateCount
      FROM certificatecompany cc
      LEFT JOIN certificates c ON cc.id = c.srtcomapnyId
      LEFT JOIN agro_world_admin.adminusers au ON cc.modifyBy = au.id
    `;

    const values = [];
    if (search) {
      sql += ` WHERE cc.regNumber LIKE ? OR cc.comName LIKE ?`;
      values.push(`%${search}%`, `%${search}%`);
    }

    sql += " GROUP BY cc.id ORDER BY cc.createdAt DESC";

    plantcare.query(sql, values, (err, results) => {
      if (err) return reject(err);
      resolve({ total: results.length, companies: results });
    });
  });
};

// Get by ID
exports.getCertificateCompanyById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        cc.id,
        cc.comName AS companyName,
        cc.regNumber,
        cc.taxId,
        cc.phoneCode1,
        cc.phoneNumber1,
        cc.phoneCode2,
        cc.phoneNumber2,
        cc.address,
        cc.createdAt,
        cc.logo
      FROM certificatecompany cc
      WHERE cc.id = ?
    `;
    plantcare.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results[0]); // return single company
    });
  });
};

// Update
exports.updateCertificateCompany = (
  id,
  companyName,
  regNumber,
  taxId,
  phoneCode1,
  phoneNumber1,
  phoneCode2,
  phoneNumber2,
  address,
  modifyBy,
  logo
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE certificatecompany 
      SET comName=?, regNumber=?, taxId=?, phoneCode1=?, phoneNumber1=?, 
          phoneCode2=?, phoneNumber2=?, address=?, logo=?, 
          modifyBy=?, modifyDate=NOW()
      WHERE id=?
    `;
    const values = [
      companyName,
      regNumber,
      taxId,
      phoneCode1,
      phoneNumber1,
      phoneCode2 || null,
      phoneNumber2 || null,
      address,
      logo || null,
      modifyBy,
      id,
    ];

    plantcare.query(sql, values, (err, results) => {
      if (err) return reject(err);
      resolve(results.affectedRows > 0);
    });
  });
};

// Delete certificate company by ID
exports.deleteCertificateCompany = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM certificatecompany WHERE id = ?";
    plantcare.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results.affectedRows > 0);
    });
  });
};

// Get all certificate companies (id + companyName only)
exports.getAllCertificateCompaniesNamesOnly = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        id,
        comName AS companyName
      FROM certificatecompany
      ORDER BY comName ASC
    `;

    plantcare.query(sql, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// Create certificate and return inserted certificate ID
exports.createCertificate = ({
  srtcomapnyId,
  srtName,
  srtNameSinhala,
  srtNameTamil,
  srtNumber,
  applicable,
  accreditation,
  serviceAreas,
  price,
  timeLine,
  commission,
  tearms,
  scope,
  logo,
  noOfVisit,
  modifyBy,
}) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO certificates
      (srtcomapnyId, srtName, srtNameSinhala, srtNameTamil, srtNumber, applicable, accreditation, serviceAreas,
       price, timeLine, commission, tearms, scope, logo, noOfVisit, modifyBy, modifyDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      srtcomapnyId,
      srtName,
      srtNameSinhala || null,
      srtNameTamil || null,
      srtNumber,
      applicable,
      accreditation,
      serviceAreas,
      price || null,
      timeLine || null,
      commission || null,
      tearms,
      scope,
      logo,
      noOfVisit || null,
      modifyBy,
    ];

    plantcare.query(sql, values, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return reject(err);
      }
      console.log("Certificate inserted with ID:", result.insertId);
      resolve(result.insertId);
    });
  });
};

// Add crops to certificatecrops table
exports.addCertificateCrops = (certificateId, cropIds) => {
  return new Promise((resolve, reject) => {
    if (!cropIds || cropIds.length === 0) return resolve([]);

    // Ensure cropIds are numbers and valid
    const validCropIds = cropIds
      .map((cropId) => parseInt(cropId))
      .filter((cropId) => !isNaN(cropId) && cropId > 0);

    if (validCropIds.length === 0) {
      return resolve({ message: "No valid crop IDs provided" });
    }

    const sql = `
      INSERT INTO certificatecrops (certificateId, cropId)
      VALUES ?
    `;
    const values = validCropIds.map((cropId) => [certificateId, cropId]);

    plantcare.query(sql, [values], (err, result) => {
      if (err) {
        console.error("Error adding certificate crops:", err);
        return reject(err);
      }
      resolve(result);
    });
  });
};

// Get all certificates
exports.getAllCertificatesDao = (quaction, area, company, searchText) => {
  return new Promise((resolve, reject) => {
    const sqlParams = [];
    let sql = `
      SELECT
        c.id,
        c.srtName,
        c.srtNumber,
        c.commission,
        c.serviceAreas,
        ( SELECT COUNT(*) FROM questionnaire q WHERE q.certificateId = c.id ) AS qCount,
        au.userName AS modifiedByUser,
        c.modifyDate,
        com.comName AS companyName
      FROM certificates c
      LEFT JOIN certificatecompany com ON c.srtcomapnyId = com.id
      LEFT JOIN agro_world_admin.adminusers au ON c.modifyBy = au.id
      WHERE 1=1
    `;

    // Use the actual subquery in WHERE clause instead of alias
    if (quaction) {
      if (quaction === "Yes") {
        sql += ` AND (SELECT COUNT(*) FROM questionnaire q WHERE q.certificateId = c.id) > 0`;
      } else if (quaction === "No") {
        sql += ` AND (SELECT COUNT(*) FROM questionnaire q WHERE q.certificateId = c.id) = 0`;
      }
    }

    if (area) {
      sql += ` AND c.serviceAreas LIKE ?`;
      sqlParams.push(`%${area}%`);
    }

    if (company) {
      sql += ` AND c.srtcomapnyId = ?`;
      sqlParams.push(company);
    }

    if (searchText) {
      sql += ` AND (c.srtName LIKE ? OR c.srtNumber LIKE ?)`;
      sqlParams.push(`%${searchText}%`, `%${searchText}%`);
    }

    sql += ` ORDER BY c.createdAt DESC`;

    plantcare.query(sql, sqlParams, (err, results) => {
      if (err) {
        console.log(err);
        return reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// Get certificate by ID
exports.getCertificateById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM certificates WHERE id = ?`;
    plantcare.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results[0] || null);
    });
  });
};

// Get crops linked to certificate
exports.getCertificateCrops = (certificateId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT cropId FROM certificatecrops WHERE certificateId = ?`;
    plantcare.query(sql, [certificateId], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// Update certificate
exports.updateCertificate = ({
  id,
  srtcomapnyId,
  srtName,
  srtNameSinhala,
  srtNameTamil,
  srtNumber,
  applicable,
  accreditation,
  serviceAreas,
  price,
  timeLine,
  commission,
  tearms,
  scope,
  logo,
  noOfVisit,
  modifyBy,
}) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE certificates
      SET
        srtcomapnyId = ?,
        srtName = ?,
        srtNameSinhala = ?,
        srtNameTamil = ?,
        srtNumber = ?,
        applicable = ?,
        accreditation = ?,
        serviceAreas = ?,
        price = ?,
        timeLine = ?,
        commission = ?,
        tearms = COALESCE(?, tearms),
        scope = ?,
        logo = COALESCE(?, logo),
        noOfVisit = ?,
        modifyBy = ?,
        modifyDate = NOW()
      WHERE id = ?
    `;
    const values = [
      srtcomapnyId,
      srtName,
      srtNameSinhala || null,
      srtNameTamil || null,
      srtNumber,
      applicable,
      accreditation,
      serviceAreas,
      price || null,
      timeLine || null,
      commission || null,
      tearms,
      scope,
      logo,
      noOfVisit || null,
      modifyBy,
      id,
    ];

    plantcare.query(sql, values, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return reject(err);
      }
      console.log(
        "Certificate updated successfully, affected rows:",
        result.affectedRows
      );
      resolve(result);
    });
  });
};

// Delete certificate crops
exports.deleteCertificateCrops = (certificateId) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM certificatecrops WHERE certificateId = ?`;
    plantcare.query(sql, [certificateId], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// Delete certificate
exports.deleteCertificate = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM certificates WHERE id = ?`;
    plantcare.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// Bulk insert questionnaires
exports.bulkInsertQuestionnaires = (certificateId, questions) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO questionnaire
      (certificateId, type, qNo, qEnglish, qSinhala, qTamil, createdAt)
      VALUES ?
    `;

    const values = questions.map((q) => [
      certificateId,
      q.type.trim(),
      q.qNo,
      q.qEnglish.trim(),
      q.qSinhala?.trim() || null,
      q.qTamil?.trim() || null,
      new Date(),
    ]);

    plantcare.query(sql, [values], (err, result) => {
      if (err) return reject(err);
      resolve(result); // includes insertId & affectedRows
    });
  });
};

// Get questionnaires for a certificate
exports.getQuestionnaireList = (certificateId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, certificateId, type, qNo, qEnglish, qSinhala, qTamil, createdAt
      FROM questionnaire
      WHERE certificateId = ?
      ORDER BY qNo ASC
    `;

    plantcare.query(sql, [certificateId], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// Update questionnaire by ID
exports.updateQuestionnaire = (id, updatedFields) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE questionnaire
      SET type = ?, qNo = ?, qEnglish = ?, qSinhala = ?, qTamil = ?
      WHERE id = ?
    `;

    const values = [
      updatedFields.type,
      updatedFields.qNo,
      updatedFields.qEnglish,
      updatedFields.qSinhala,
      updatedFields.qTamil,
      id,
    ];

    plantcare.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// Delete questionnaire by ID
exports.deleteQuestionnaire = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM questionnaire WHERE id = ?`;

    plantcare.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// Check NICs existence
exports.checkNICsExist = async (nicList, connection) => {
  const [rows] = await connection.query(
    `SELECT id, NICnumber FROM users WHERE NICnumber IN (?)`,
    [nicList]
  );
  const existingNICs = rows.map((r) => r.NICnumber);
  const missingNICs = nicList.filter((nic) => !existingNICs.includes(nic));
  return { existingNICs, missingNICs };
};

// Create farm cluster
exports.createFarmCluster = async (
  clusterName,
  district,
  certificateId,
  modifyBy,
  connection
) => {
  const [result] = await connection.query(
    `INSERT INTO farmcluster (clsName, district, certificateId, modifyBy, modifyDate) 
     VALUES (?, ?, ?, ?, NOW())`,
    [clusterName, district, certificateId, modifyBy]
  );
  return result;
};

// Check if a cluster name already exists
exports.isClusterNameExists = async (clusterName, connection) => {
  const [rows] = await connection.query(
    `SELECT id FROM farmcluster WHERE clsName = ?`,
    [clusterName]
  );
  return rows.length > 0;
};

// // Get farmer IDs by NIC
// exports.getFarmerIdsByNICs = async (nicList, connection) => {
//   const [rows] = await connection.query(
//     `SELECT id, NICnumber FROM users WHERE NICnumber IN (?)`,
//     [nicList]
//   );
//   const map = {};
//   rows.forEach((r) => (map[r.NICnumber] = r.id));
//   return map;
// };

// // Bulk insert farmers into cluster
// exports.bulkInsertClusterFarmers = async (clusterId, farmerIds, connection) => {
//   if (farmerIds.length === 0) return { affectedRows: 0 };
//   const values = farmerIds.map((id) => [clusterId, id]);
//   const [result] = await connection.query(
//     `INSERT INTO farmclusterfarmers (clusterId, farmerId) VALUES ?`,
//     [values]
//   );
//   return result;
// };

// Get all farmer clusters with member count and last modified info
exports.getAllFarmerClusters = async (connection, search = "") => {
  let query = `
    SELECT 
      fc.id AS clusterId,
      fc.clsName AS clusterName,
      fc.district AS district,
      c.srtName AS certificateName,
      COUNT(fcf.farmId) AS memberCount,
      fc.clsStatus AS status,
      au.userName AS lastModifiedBy,
      DATE_FORMAT(fc.modifyDate, '%Y-%m-%d %H:%i:%s') AS lastModifiedOn,
      fc.modifyDate AS rawModifyDate
    FROM farmcluster fc
    LEFT JOIN farmclusterfarmers fcf ON fc.id = fcf.clusterId
    LEFT JOIN certificates c ON fc.certificateId = c.id
    LEFT JOIN agro_world_admin.adminusers au ON fc.modifyBy = au.id
  `;

  const params = [];

  if (search) {
    query += ` WHERE (
      fc.clsName LIKE ? 
      OR fc.district LIKE ? 
      OR c.srtName LIKE ? 
      OR fc.clsStatus LIKE ?
      OR au.userName LIKE ?
    ) `;
    const searchPattern = `%${search}%`;
    params.push(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern
    );
  }

  query += `
    GROUP BY 
      fc.id, 
      fc.clsName, 
      fc.district, 
      c.srtName, 
      fc.clsStatus, 
      au.userName, 
      fc.modifyDate
    ORDER BY fc.clsName ASC
  `;

  const [rows] = await connection.query(query, params);

  return rows.map((cluster, index) => ({
    no: index + 1,
    clusterId: cluster.clusterId,
    clusterName: cluster.clusterName,
    district: cluster.district,
    certificateName: cluster.certificateName || "No Certificate",
    memberCount: cluster.memberCount,
    viewMembers: cluster.memberCount,
    status: cluster.status,
    lastModifiedBy: cluster.lastModifiedBy || "N/A",
    lastModifiedOn: cluster.lastModifiedOn || "N/A",
  }));
};

// Delete a farm cluster and its associated farmers
exports.deleteFarmClusterWithFarmers = async (clusterId, connection) => {
  try {
    // Start transaction
    await connection.beginTransaction();

    // Delete all farmers in the cluster
    await connection.query(
      `DELETE FROM farmclusterfarmers WHERE clusterId = ?`,
      [clusterId]
    );

    // Delete the cluster itself
    const [result] = await connection.query(
      `DELETE FROM farmcluster WHERE id = ?`,
      [clusterId]
    );

    // Commit transaction
    await connection.commit();

    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  }
};

// Get all users for a given cluster ID with optional search
exports.getUsersByClusterId = async (clusterId, search = "", connection) => {
  // Get complete cluster details including certificate and district
  const [clusterRows] = await connection.query(
    `SELECT 
      fc.clsName AS clusterName, 
      fc.clsStatus AS clusterStatus,
      fc.district,
      fc.certificateId,
      c.srtName AS certificateName,
      c.srtNumber AS certificateNumber,
      au.userName AS lastModifiedBy,
      DATE_FORMAT(fc.modifyDate, '%Y-%m-%d %H:%i:%s') AS lastModifiedOn,
      DATE_FORMAT(fc.createdAt, '%Y-%m-%d %H:%i:%s') AS createdAt
    FROM farmcluster fc
    LEFT JOIN certificates c ON fc.certificateId = c.id
    LEFT JOIN agro_world_admin.adminusers au ON fc.modifyBy = au.id
    WHERE fc.id = ?`,
    [clusterId]
  );

  if (clusterRows.length === 0) {
    throw new Error("Cluster not found");
  }

  const clusterDetails = clusterRows[0];

  let query = `
    SELECT 
      u.id,
      u.firstName,
      u.lastName,
      u.NICnumber AS NIC,
      u.phoneNumber,
      f.id AS farmId,
      f.regCode AS farmRegCode,
      f.farmName,
      f.extentha,
      f.extentac,
      f.extentp,
      DATE_FORMAT(fcf.createdAt, '%Y-%m-%d %H:%i:%s') AS addedDate
    FROM farmclusterfarmers fcf
    INNER JOIN farms f ON fcf.farmId = f.id
    INNER JOIN users u ON f.userId = u.id
    WHERE fcf.clusterId = ?
  `;
  const params = [clusterId];

  if (search) {
    query += ` AND (
      u.NICnumber LIKE ? 
      OR u.phoneNumber LIKE ? 
      OR CONCAT(u.firstName, ' ', u.lastName) LIKE ?
      OR f.regCode LIKE ?
      OR f.farmName LIKE ?
      OR CAST(f.id AS CHAR) LIKE ?
    )`;
    const searchPattern = `%${search}%`;
    params.push(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern
    );
  }

  query += ` ORDER BY u.firstName ASC, u.lastName ASC`;

  const [rows] = await connection.query(query, params);

  const members = rows.map((user, index) => {
    // Format farm size with all units
    let farmSize = "";
    if (user.extentha || user.extentac || user.extentp) {
      const parts = [];
      if (user.extentha) parts.push(`${user.extentha} ha`);
      if (user.extentac) parts.push(`${user.extentac} ac`);
      if (user.extentp) parts.push(`${user.extentp} p`);
      farmSize = parts.join(", ");
    } else {
      farmSize = "N/A";
    }

    return {
      no: String(index + 1).padStart(2, "0"),
      id: user.id,
      farmerId: user.id,
      farmerName: `${user.firstName} ${user.lastName}`,
      farmId: user.farmId,
      farmRegCode: user.farmRegCode,
      farmName: user.farmName || "N/A",
      farmSize: farmSize,
      nic: user.NIC,
      phoneNumber: user.phoneNumber,
      addedDate: user.addedDate,
    };
  });

  return {
    clusterId,
    clusterName: clusterDetails.clusterName,
    clusterStatus: clusterDetails.clusterStatus || "Not Started",
    district: clusterDetails.district,
    certificateId: clusterDetails.certificateId,
    certificateName: clusterDetails.certificateName || "No Certificate",
    certificateNumber: clusterDetails.certificateNumber || "N/A",
    lastModifiedBy: clusterDetails.lastModifiedBy || "N/A",
    lastModifiedOn: clusterDetails.lastModifiedOn || "N/A",
    createdAt: clusterDetails.createdAt,
    members,
    totalMembers: members.length,
  };
};

// Delete specific user from a cluster
exports.deleteClusterUser = async (clusterId, farmerId, connection) => {
  // First get the farmId for this farmer
  const [farms] = await connection.query(
    `SELECT id FROM farms WHERE userId = ?`,
    [farmerId]
  );

  if (farms.length === 0) {
    return false;
  }

  const farmId = farms[0].id;

  const [result] = await connection.query(
    `DELETE FROM farmclusterfarmers WHERE clusterId = ? AND farmId = ?`,
    [clusterId, farmId]
  );
  return result.affectedRows > 0;
};

// Get farmer ID by NIC
exports.getFarmerIdByNIC = async (nic, connection) => {
  const [rows] = await connection.query(
    `SELECT id FROM users WHERE NICnumber = ?`,
    [nic]
  );
  return rows.length > 0 ? rows[0].id : null;
};

// Check if farmer already in cluster
exports.isFarmerInCluster = async (clusterId, farmerId, connection) => {
  const [rows] = await connection.query(
    `SELECT id FROM farmclusterfarmers WHERE clusterId = ? AND farmId = ?`,
    [clusterId, farmerId]
  );
  return rows.length > 0;
};

// Insert farmer into cluster
exports.insertFarmerIntoCluster = async (clusterId, farmerId, connection) => {
  await connection.query(
    `INSERT INTO farmclusterfarmers (clusterId, farmId, createdAt) VALUES (?, ?, NOW())`,
    [clusterId, farmerId]
  );
};

// Update farmer cluster (name, district, certificate)
exports.updateFarmerCluster = async (
  clusterId,
  updateData,
  userId,
  connection
) => {
  try {
    const { clusterName, district, certificateId } = updateData;

    // Get current cluster data
    const [currentCluster] = await connection.query(
      `SELECT clsName, district, certificateId FROM farmcluster WHERE id = ?`,
      [clusterId]
    );

    if (currentCluster.length === 0) {
      throw new Error("Cluster not found");
    }

    const currentData = currentCluster[0];
    const changes = {};
    const updateFields = [];
    const updateValues = [];

    // Build dynamic update query based on provided fields
    if (clusterName !== undefined && clusterName !== currentData.clsName) {
      updateFields.push("clsName = ?");
      updateValues.push(clusterName.trim());
      changes.clusterName = {
        old: currentData.clsName,
        new: clusterName.trim(),
      };
    }

    if (district !== undefined && district !== currentData.district) {
      updateFields.push("district = ?");
      updateValues.push(district);
      changes.district = {
        old: currentData.district,
        new: district,
      };
    }

    if (
      certificateId !== undefined &&
      certificateId !== currentData.certificateId
    ) {
      updateFields.push("certificateId = ?");
      updateValues.push(certificateId);
      changes.certificateId = {
        old: currentData.certificateId,
        new: certificateId,
      };
    }

    // If no fields to update
    if (updateFields.length === 0) {
      return {
        message: "No changes detected",
        changes: {},
      };
    }

    // Add modifyBy and modifyDate
    updateFields.push("modifyBy = ?");
    updateValues.push(userId);
    updateFields.push("modifyDate = NOW()");

    // Add clusterId for WHERE clause
    updateValues.push(clusterId);

    const updateQuery = `
      UPDATE farmcluster 
      SET ${updateFields.join(", ")} 
      WHERE id = ?
    `;

    const [result] = await connection.query(updateQuery, updateValues);

    if (result.affectedRows === 0) {
      throw new Error("Failed to update cluster");
    }

    // Get updated cluster data
    const [updatedCluster] = await connection.query(
      `
      SELECT 
        fc.id AS clusterId,
        fc.clsName AS clusterName,
        fc.district,
        fc.clsStatus AS status,
        c.srtName AS certificateName,
        c.id AS certificateId,
        c.srtNumber AS certificateNumber,
        COUNT(fcf.farmId) AS memberCount,
        au.userName AS lastModifiedBy,
        DATE_FORMAT(fc.modifyDate, '%Y-%m-%d %H:%i:%s') AS lastModifiedOn,
        DATE_FORMAT(fc.createdAt, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM farmcluster fc
      LEFT JOIN farmclusterfarmers fcf ON fc.id = fcf.clusterId
      LEFT JOIN certificates c ON fc.certificateId = c.id
      LEFT JOIN agro_world_admin.adminusers au ON fc.modifyBy = au.id
      WHERE fc.id = ?
      GROUP BY fc.id
    `,
      [clusterId]
    );

    return {
      message: "Cluster updated successfully",
      updatedCluster: updatedCluster[0],
      changes: changes,
    };
  } catch (error) {
    console.error("DAO Error updating farmer cluster:", error);
    throw error;
  }
};

// Check if cluster name exists excluding current cluster
exports.isClusterNameExistsExcludingCurrent = async (
  clusterName,
  excludeClusterId,
  connection
) => {
  const [rows] = await connection.query(
    `SELECT id FROM farmcluster WHERE clsName = ? AND id != ?`,
    [clusterName.trim(), excludeClusterId]
  );
  return rows.length > 0;
};

// Check if a certificate company with the given tax ID exists
exports.checkByTaxId = (taxId, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT id FROM certificatecompany WHERE taxId = ?`;
    const params = [taxId];

    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }

    plantcare.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// Get certificates with name and ID only where applicable = 'For Farmer Cluster'
exports.getFarmerClusterCertificates = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT c.id, c.srtName, c.srtNumber 
      FROM certificates c
      LEFT JOIN questionnaire q ON c.id = q.certificateId
      WHERE c.applicable = 'For Farmer Cluster' AND q.id IS NOT NULL
      GROUP BY c.id, c.srtName, c.srtNumber 
      ORDER BY srtName ASC
    `;

    plantcare.query(sql, (err, results) => {
      if (err) {
        console.error(
          "Database error fetching farmer cluster certificates:",
          err
        );
        return reject(err);
      }
      console.log("Farmer cluster certificates fetched:", results.length);
      resolve(results);
    });
  });
};

// Check if certificate exists
exports.checkCertificateExists = async (certificateId, connection) => {
  const [rows] = await connection.query(
    `SELECT id FROM certificates WHERE id = ?`,
    [certificateId]
  );
  return rows.length > 0;
};

// Validate farmers and their farms
exports.validateFarmersWithFarms = async (
  nicList,
  regCodeList,
  farmers,
  connection
) => {
  // Check NICs existence
  const [userRows] = await connection.query(
    `SELECT id, NICnumber FROM users WHERE NICnumber IN (?)`,
    [nicList]
  );

  const existingNICs = userRows.map((r) => r.NICnumber);
  const missingNICs = nicList.filter((nic) => !existingNICs.includes(nic));
  const validNICs = existingNICs;

  // Create user ID to NIC mapping
  const userMap = {};
  userRows.forEach((r) => (userMap[r.NICnumber] = r.id));

  // Check if farms exist for these users with provided regCodes
  const [farmRows] = await connection.query(
    `SELECT f.id, f.regCode, f.userId, u.NICnumber 
     FROM farms f 
     INNER JOIN users u ON f.userId = u.id 
     WHERE u.NICnumber IN (?) AND f.regCode IN (?)`,
    [nicList, regCodeList]
  );

  // Create validation result - PROCESS EACH FARMER-REGCODE PAIR INDIVIDUALLY
  const validFarmers = [];
  const mismatchedFarmers = [];

  // Process each farmer-regCode pair from the original farmers array
  farmers.forEach((farmer) => {
    const nic = farmer.farmerNIC.trim();
    const regCode = farmer.regCode.trim();

    // Check if NIC exists
    if (!existingNICs.includes(nic)) {
      mismatchedFarmers.push({
        farmerNIC: nic,
        regCode: regCode,
        reason: "NIC number not registered in system",
      });
      return;
    }

    // Check if this specific farmer has a farm with this specific regCode
    const userFarms = farmRows.filter(
      (farm) => farm.NICnumber === nic && farm.regCode === regCode
    );

    if (userFarms.length > 0) {
      validFarmers.push({
        farmerNIC: nic,
        regCode: regCode,
        userId: userMap[nic],
      });
    } else {
      mismatchedFarmers.push({
        farmerNIC: nic,
        regCode: regCode,
        reason: "Farmer doesn't have a farm with this registration code",
      });
    }
  });

  return {
    missingNICs,
    validNICs,
    validFarmers,
    mismatchedFarmers,
  };
};

// Get farm IDs for valid farmers
exports.getFarmIdsForValidFarmers = async (validFarmers, connection) => {
  if (validFarmers.length === 0) return [];

  // Create conditions for each specific farmer-regCode pair
  const placeholders = validFarmers
    .map(() => `(f.userId = ? AND f.regCode = ?)`)
    .join(" OR ");

  const params = validFarmers.flatMap((f) => [f.userId, f.regCode]);

  const [rows] = await connection.query(
    `SELECT f.id, f.userId, f.regCode FROM farms f WHERE ${placeholders}`,
    params
  );

  // Match farms to the exact validFarmers order to preserve duplicates
  const farmIds = [];

  validFarmers.forEach((validFarmer) => {
    const farm = rows.find(
      (row) =>
        row.userId === validFarmer.userId && row.regCode === validFarmer.regCode
    );
    if (farm) {
      farmIds.push(farm.id);
    }
  });

  return farmIds;
};

// Bulk insert farms into cluster
// exports.bulkInsertClusterFarms = async (clusterId, farmIds, connection) => {
//   if (farmIds.length === 0) return { affectedRows: 0 };

//   const values = farmIds.map((farmId) => [clusterId, farmId]);

//   const [result] = await connection.query(
//     `INSERT INTO farmclusterfarmers (clusterId, farmId) VALUES ?`,
//     [values]
//   );
//   return result;
// };

exports.bulkInsertClusterFarms = async (clusterId, farmIds, connection) => {
  if (farmIds.length === 0) return { affectedRows: 0, insertedIds: [] };

  const values = farmIds.map((farmId) => [clusterId, farmId]);

  // Perform bulk insert
  const [result] = await connection.query(
    `INSERT INTO farmclusterfarmers (clusterId, farmId) VALUES ?`,
    [values]
  );

  // Get all inserted farmclusterfarmers IDs
  const [insertedRows] = await connection.query(
    `SELECT id FROM farmclusterfarmers 
     WHERE clusterId = ? 
     ORDER BY id ASC 
     LIMIT ?`,
    [clusterId, farmIds.length]
  );

  const insertedIds = insertedRows.map((row) => row.id);

  return {
    affectedRows: result.affectedRows,
    insertId: result.insertId,
    insertedIds: insertedIds,
  };
};

// Check if registration codes exist in farms table
exports.checkRegCodesExist = async (regCodeList, connection) => {
  const [rows] = await connection.query(
    `SELECT regCode FROM farms WHERE regCode IN (?)`,
    [regCodeList]
  );
  const existingRegCodes = rows.map((r) => r.regCode);
  const missingRegCodes = regCodeList.filter(
    (regCode) => !existingRegCodes.includes(regCode)
  );
  return { existingRegCodes, missingRegCodes };
};

// Update farmer cluster status
exports.updateClusterStatus = async (
  connection,
  clusterId,
  status,
  modifyBy
) => {
  try {
    // Check if cluster exists
    const [clusterExists] = await connection.query(
      "SELECT id, clsName, clsStatus FROM farmcluster WHERE id = ?",
      [clusterId]
    );

    if (clusterExists.length === 0) {
      throw new Error("Cluster not found");
    }

    const oldStatus = clusterExists[0].clsStatus;
    const clusterName = clusterExists[0].clsName;

    // Update cluster status with modifyBy and modifyDate
    const updateQuery = `
      UPDATE farmcluster 
      SET clsStatus = ?, modifyBy = ?, modifyDate = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;

    const [result] = await connection.query(updateQuery, [
      status,
      modifyBy,
      clusterId,
    ]);

    if (result.affectedRows === 0) {
      throw new Error("Failed to update cluster status");
    }

    // Get updated cluster data with last modified info
    const [updatedCluster] = await connection.query(
      `
      SELECT 
        fc.id AS clusterId,
        fc.clsName AS clusterName,
        fc.district,
        fc.clsStatus AS status,
        c.srtName AS certificateName,
        c.id AS certificateId,
        COUNT(fcf.farmId) AS memberCount,
        au.userName AS lastModifiedBy,
        DATE_FORMAT(fc.modifyDate, '%Y-%m-%d %H:%i:%s') AS lastModifiedOn,
        DATE_FORMAT(fc.createdAt, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM farmcluster fc
      LEFT JOIN farmclusterfarmers fcf ON fc.id = fcf.clusterId
      LEFT JOIN certificates c ON fc.certificateId = c.id
      LEFT JOIN agro_world_admin.adminusers au ON fc.modifyBy = au.id
      WHERE fc.id = ?
      GROUP BY fc.id
    `,
      [clusterId]
    );

    return {
      message: `Cluster status updated from ${
        oldStatus || "Not Started"
      } to ${status} successfully`,
      data: updatedCluster[0],
      changes: {
        oldStatus: oldStatus || "Not Started",
        newStatus: status,
        clusterName: clusterName,
        modifiedBy: modifyBy,
        modifiedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("DAO Error updating cluster status:", error);
    throw error;
  }
};

// Check if cluster exists
exports.checkClusterExists = async (clusterId, connection) => {
  const [rows] = await connection.query(
    `SELECT id FROM farmcluster WHERE id = ?`,
    [clusterId]
  );
  return rows.length > 0;
};

// Get farmer information by NIC
exports.getFarmerInfoByNIC = async (nic, connection) => {
  const [rows] = await connection.query(
    `SELECT id, firstName FROM users WHERE NICnumber = ?`,
    [nic]
  );
  return rows.length > 0 ? rows[0] : null;
};

// Validate farmer's farm and get farm ID
exports.validateFarmerFarm = async (farmerId, farmRegCode, connection) => {
  const [rows] = await connection.query(
    `SELECT id, regCode FROM farms WHERE userId = ? AND regCode = ?`,
    [farmerId, farmRegCode]
  );

  return {
    farmExists: rows.length > 0,
    farmId: rows.length > 0 ? rows[0].id : null,
    regCode: rows.length > 0 ? rows[0].regCode : null,
  };
};

// Check if farm is already in cluster
exports.isFarmInCluster = async (clusterId, farmId, connection) => {
  const [rows] = await connection.query(
    `SELECT id FROM farmclusterfarmers WHERE clusterId = ? AND farmId = ?`,
    [clusterId, farmId]
  );
  return rows.length > 0;
};

// Insert farm into cluster
exports.insertFarmIntoCluster = async (clusterId, farmId, connection) => {
  const [result] = await connection.query(
    `INSERT INTO farmclusterfarmers (clusterId, farmId, createdAt) VALUES (?, ?, NOW())`,
    [clusterId, farmId]
  );
  return result;
};

// Check if farm exists (by regCode)
exports.checkFarmExists = async (farmRegCode, connection) => {
  const [rows] = await connection.query(
    `SELECT id FROM farms WHERE regCode = ?`,
    [farmRegCode]
  );
  return rows.length > 0;
};

// Get certificate details including price and timeline
exports.getCertificateDetails = async (certificateId, connection) => {
  const [rows] = await connection.query(
    `SELECT id, price, timeLine FROM certificates WHERE id = ?`,
    [certificateId]
  );
  return rows.length > 0 ? rows[0] : null;
};

// Create certification payment record
exports.createCertificationPayment = async (paymentData, connection) => {
  const { certificateId, clusterId, payType, price, timeLine, farmsCount } =
    paymentData;

  const amount = parseFloat(price) * farmsCount;

  const expireDate = new Date();
  expireDate.setMonth(expireDate.getMonth() + parseInt(timeLine));

  // Await since generateTransactionId is async
  const transactionId = await generateTransactionId();

  const [result] = await connection.query(
    `INSERT INTO certificationpayment 
     (certificateId, userId, clusterId, payType, transactionId, amount, expireDate) 
     VALUES (?, NULL, ?, ?, ?, ?, ?)`,
    [certificateId, clusterId, payType, transactionId, amount, expireDate]
  );

  return {
    insertId: result.insertId,
    transactionId,
    amount,
    expireDate,
  };
};

// Generate transaction ID function (local)
const generateTransactionId = async (prefix = "CTID") => {
  const latestId = await getLatestTransactionId(prefix);

  if (latestId) {
    const numericPart = parseInt(latestId.replace(prefix, ""), 10) + 1;
    return `${prefix}${numericPart.toString().padStart(7, "0")}`;
  } else {
    return `${prefix}0000001`;
  }
};

// Sequential version using database
const getLatestTransactionId = async (prefix) => {
  try {
    const connection = await plantcare.promise().getConnection();
    const [rows] = await connection.query(
      `SELECT transactionId FROM certificationpayment 
       WHERE transactionId LIKE ? 
       ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );
    connection.release();
    return rows.length > 0 ? rows[0].transactionId : null;
  } catch (error) {
    console.error("Error getting latest transaction ID:", error);
    return null;
  }
};

// Get cluster information with certificate price
exports.getClusterWithCertificate = async (clusterId, connection) => {
  const [rows] = await connection.query(
    `SELECT fc.id, fc.clsName, fc.certificateId, c.price as certificatePrice
     FROM farmcluster fc
     INNER JOIN certificates c ON fc.certificateId = c.id
     WHERE fc.id = ?`,
    [clusterId]
  );
  return rows.length > 0 ? rows[0] : null;
};

// Get existing payment record for cluster
exports.getClusterPaymentRecord = async (clusterId, connection) => {
  const [rows] = await connection.query(
    `SELECT id, amount, transactionId, certificateId, clusterId
     FROM certificationpayment 
     WHERE clusterId = ? AND payType = 'Cluster' 
     ORDER BY id DESC LIMIT 1`,
    [clusterId]
  );
  return rows.length > 0 ? rows[0] : null;
};

// Update certification payment amount
exports.updateCertificationPaymentAmount = async (
  clusterId,
  certificatePrice,
  connection
) => {
  // Get current farms count in cluster (after new farm was added)
  const [farmsCountRows] = await connection.query(
    `SELECT COUNT(*) as farmsCount FROM farmclusterfarmers WHERE clusterId = ?`,
    [clusterId]
  );

  const farmsCount = farmsCountRows[0].farmsCount;

  // Calculate new amount (certificate price × farms count)
  const newAmount = parseFloat(certificatePrice) * farmsCount;

  // Update the certification payment record
  const [updateResult] = await connection.query(
    `UPDATE certificationpayment 
     SET amount = ? 
     WHERE clusterId = ? AND payType = 'Cluster'`,
    [newAmount, clusterId]
  );

  return {
    updated: updateResult.affectedRows > 0,
    newAmount,
    farmsCount,
  };
};

// Get field audits with related data
exports.getFieldAudits = async (searchTerm, connection) => {
  let query = `
    SELECT 
      fa.id as auditNo,
      fa.status,
      fa.sheduleDate,
      u.firstName as farmerFirstName,
      u.lastName as farmerLastName,
      u.district as farmerDistrict,
      u.phoneNumber as farmerPhoneNumber,
      c.applicable as certificateApplicable,
      c.srtName as certificateName,
      fo.id as officerId,
      fo.firstName as officerFirstName,
      fo.lastName as officerLastName,
      fo.empId as officerEmpId,
      fo.JobRole as officerJobRole
    FROM feildaudits fa
    LEFT JOIN certificationpayment cp ON fa.paymentId = cp.id
    LEFT JOIN users u ON cp.userId = u.id
    LEFT JOIN certificates c ON cp.certificateId = c.id
    LEFT JOIN feildofficer fo ON fa.assignOfficerId = fo.id
  `;

  const params = [];
  const conditions = [];

  // Add certificate applicable condition
  conditions.push(
    `(c.applicable = 'For Farm' OR c.applicable = 'For Selected Crops')`
  );

  // Add search conditions if searchTerm is provided
  if (searchTerm && searchTerm.trim() !== "") {
    const searchPattern = `%${searchTerm.trim()}%`;
    const searchConditions = [
      "u.firstName LIKE ?",
      "u.lastName LIKE ?",
      'CONCAT(u.firstName, " ", u.lastName) LIKE ?',
      "u.phoneNumber LIKE ?",
      "u.district LIKE ?",
      "c.srtName LIKE ?",
      "c.applicable LIKE ?",
      "fo.firstName LIKE ?",
      "fo.lastName LIKE ?",
      "fa.status LIKE ?",
      "fo.empId LIKE ?",
      "fo.JobRole LIKE ?",
    ];

    conditions.push(`(${searchConditions.join(" OR ")})`);

    // Add the same parameter multiple times for each LIKE condition
    for (let i = 0; i < 12; i++) {
      params.push(searchPattern);
    }
  }

  // Combine all conditions with AND
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY fa.createdAt DESC`;

  const [rows] = await connection.query(query, params);
  return rows;
};

// Get crops for a field audit by paymentId
exports.getCropsByPaymentId = async (paymentId, connection) => {
  const [rows] = await connection.query(
    `SELECT 
      cg.id as cropId,
      cg.cropNameEnglish,
      cg.cropNameSinhala,
      cg.cropNameTamil,
      cg.category,
      cg.image,
      cg.bgColor
    FROM feildaudits fa
    INNER JOIN certificationpayment cp ON fa.paymentId = cp.id
    INNER JOIN certificates cert ON cp.certificateId = cert.id
    INNER JOIN certificatecrops cc ON cert.id = cc.certificateId
    INNER JOIN cropgroup cg ON cc.cropId = cg.id
    WHERE fa.paymentId = ?
    ORDER BY cg.cropNameEnglish`,
    [paymentId]
  );

  return rows;
};

// Get crops for a field audit by fieldaudits
exports.getCropsByFieldAuditId = async (fieldAuditId, connection) => {
  // First, get the certificate applicable type and certificateId
  const [certificateInfo] = await connection.query(
    `SELECT 
      cert.applicable,
      cert.id as certificateId,
      cert.srtName as certificateName
    FROM feildaudits fa
    INNER JOIN certificationpayment cp ON fa.paymentId = cp.id
    INNER JOIN certificates cert ON cp.certificateId = cert.id
    WHERE fa.id = ?`,
    [fieldAuditId]
  );

  if (certificateInfo.length === 0) {
    return { crops: [], certificateInfo: null };
  }

  const applicable = certificateInfo[0].applicable;
  const certificateId = certificateInfo[0].certificateId;
  const certificateName = certificateInfo[0].certificateName;

  let crops = [];

  if (applicable === "For Farm") {
    // If applicable is "For Farm", get all crops from cropgroup
    [crops] = await connection.query(
      `SELECT 
        id as cropId,
        cropNameEnglish
      FROM cropgroup 
      ORDER BY cropNameEnglish`
    );
  } else {
    // For other applicable types, get only certificate-specific crops
    [crops] = await connection.query(
      `SELECT 
        cg.id as cropId,
        cg.cropNameEnglish
      FROM certificatecrops cc
      INNER JOIN cropgroup cg ON cc.cropId = cg.id
      WHERE cc.certificateId = ?
      ORDER BY cg.cropNameEnglish`,
      [certificateId]
    );
  }

  return {
    crops,
    certificateInfo: {
      certificateId,
      certificateName,
      applicable,
    },
  };
};

// Get farmer clusters audits with related data
exports.getFarmerClustersAudits = async (searchTerm, connection) => {
  let query = `
    SELECT 
      fa.id as auditNo,
      fa.status,
      fa.sheduleDate,
      fc.clsName as clusterName,
      fc.district as clusterDistrict,
      c.srtName as certificateName,
      fo.id as officerId,
      fo.firstName as officerFirstName,
      fo.lastName as officerLastName,
      fo.empId as officerEmpId,
      fo.JobRole as officerJobRole
    FROM feildaudits fa
    LEFT JOIN certificationpayment cp ON fa.paymentId = cp.id
    LEFT JOIN farmcluster fc ON cp.clusterId = fc.id
    LEFT JOIN certificates c ON cp.certificateId = c.id
    LEFT JOIN feildofficer fo ON fa.assignOfficerId = fo.id
  `;

  const params = [];
  const conditions = [];

  // Add certificate applicable condition for Farmer Cluster
  conditions.push(`(c.applicable = 'For Farmer Cluster')`);

  // Add search conditions if searchTerm is provided
  if (searchTerm && searchTerm.trim() !== "") {
    const searchPattern = `%${searchTerm.trim()}%`;
    const searchConditions = [
      "fc.clsName LIKE ?",
      "fc.district LIKE ?",
      "c.srtName LIKE ?",
      "fo.firstName LIKE ?",
      "fo.lastName LIKE ?",
      "fa.status LIKE ?",
      "fo.empId LIKE ?",
      "fo.JobRole LIKE ?",
    ];

    conditions.push(`(${searchConditions.join(" OR ")})`);

    // Add the same parameter multiple times for each LIKE condition
    for (let i = 0; i < 8; i++) {
      params.push(searchPattern);
    }
  }

  // Combine all conditions with AND
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY fa.createdAt DESC`;

  const [rows] = await connection.query(query, params);
  return rows;
};

// Get field officers by district and job role
exports.getOfficersByDistrictAndRoleDAO = (district, jobRole, scheduleDate) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        fo.id,
        fo.empId,
        fo.firstName,
        fo.lastName,
        fo.JobRole,
        fo.distrct as district,
        COUNT(fa.id) as jobCount
      FROM 
        feildofficer fo
      LEFT JOIN 
        feildaudits fa ON fo.id = fa.assignOfficerId 
        AND DATE(fa.sheduleDate) = ? 
        AND fa.status IN ('Pending', 'Completed')
      WHERE 
        fo.assignDistrict LIKE ?
        AND fo.JobRole = ?
        AND fo.status = 'Approved'
      GROUP BY 
        fo.id, fo.empId, fo.firstName, fo.lastName, fo.JobRole, fo.distrct
      ORDER BY 
        fo.firstName, fo.lastName
    `;

    const params = [scheduleDate, `%${district}%`, jobRole];

    plantcare.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// Update field audit assign officer
exports.assignOfficerToAuditDAO = (
  fieldAuditId,
  assignOfficerId,
  scheduleDate = null
) => {
  return new Promise(async (resolve, reject) => {
    let connection;

    try {
      connection = await plantcare.promise().getConnection();
      await connection.beginTransaction();

      // Check if field audit exists
      const [auditExists] = await connection.query(
        `SELECT id FROM feildaudits WHERE id = ?`,
        [fieldAuditId]
      );

      if (auditExists.length === 0) {
        await connection.rollback();
        return reject(new Error("Field audit not found"));
      }

      // Check if officer exists and is active
      const [officerExists] = await connection.query(
        `SELECT id FROM feildofficer WHERE id = ? AND status = 'Approved'`,
        [assignOfficerId]
      );

      if (officerExists.length === 0) {
        await connection.rollback();
        return reject(new Error("Officer not found or not Approved"));
      }

      // Build dynamic update query based on whether scheduleDate is provided
      let updateQuery = `
        UPDATE feildaudits 
        SET assignOfficerId = ?, assignDate = NOW(), status = 'Pending'
      `;
      const queryParams = [assignOfficerId];

      // Add scheduleDate to update if provided
      if (scheduleDate) {
        updateQuery += `, sheduleDate = ?`;
        queryParams.push(scheduleDate);
      }

      updateQuery += ` WHERE id = ?`;
      queryParams.push(fieldAuditId);

      // Update the field audit with the assigned officer and optional schedule date
      const [result] = await connection.query(updateQuery, queryParams);

      if (result.affectedRows === 0) {
        await connection.rollback();
        return reject(new Error("Field audit not found or no changes made"));
      }

      await connection.commit();

      // Prepare response data
      const responseData = {
        fieldAuditId,
        assignOfficerId,
        assignDate: new Date(),
      };

      // Add scheduleDate to response if provided
      if (scheduleDate) {
        responseData.sheduleDate = scheduleDate;
      }

      resolve(responseData);
    } catch (err) {
      if (connection) await connection.rollback();
      reject(err);
    } finally {
      if (connection) connection.release();
    }
  });
};

// certificateCompanyDao.js or appropriate DAO file

exports.bulkInsertSlaveQuestionnaire = async (
  crtPaymentId,
  clusterFarmIds,
  connection
) => {
  if (!clusterFarmIds || clusterFarmIds.length === 0) {
    return { affectedRows: 0 };
  }

  const values = clusterFarmIds.map((clusterFarmId) => [
    crtPaymentId,
    clusterFarmId,
    1, // isCluster = true
  ]);

  const [result] = await connection.query(
    `INSERT INTO slavequestionnaire (crtPaymentId, clusterFarmId, isCluster) VALUES ?`,
    [values]
  );

  return result;
};

exports.getSlaveQuestionnaireIds = async (crtPaymentId, connection) => {
  const [rows] = await connection.query(
    `SELECT id FROM slavequestionnaire WHERE crtPaymentId = ? ORDER BY id ASC`,
    [crtPaymentId]
  );

  return rows.map((row) => row.id);
};

// certificateCompanyDao.js

exports.bulkInsertSlaveQuestionnaireItems = async (
  slaveIds,
  certificateId,
  connection
) => {
  if (!slaveIds || slaveIds.length === 0) {
    return { affectedRows: 0 };
  }

  // First, get all questionnaire items for the certificate
  const [questionnaireItems] = await connection.query(
    `SELECT type, qNo, qEnglish, qSinhala, qTamil 
     FROM questionnaire 
     WHERE certificateId = ?`,
    [certificateId]
  );

  if (questionnaireItems.length === 0) {
    return { affectedRows: 0 };
  }

  // Create values for all slaveIds with all questionnaire items
  const values = [];
  for (const slaveId of slaveIds) {
    for (const item of questionnaireItems) {
      values.push([
        slaveId,
        item.type,
        item.qNo,
        item.qEnglish,
        item.qSinhala,
        item.qTamil,
      ]);
    }
  }

  const [result] = await connection.query(
    `INSERT INTO slavequestionnaireitems (slaveId, type, qNo, qEnglish, qSinhala, qTamil) VALUES ?`,
    [values]
  );

  return result;
};

exports.singleInsertSlaveQuestionnaire = async (
  crtPaymentId,
  clusterFarmId,
  connection
) => {
  const values = [
    crtPaymentId,
    clusterFarmId,
    1, // isCluster = true
  ];

  const [result] = await connection.query(
    `INSERT INTO slavequestionnaire (crtPaymentId, clusterFarmId, isCluster) VALUES (?)`,
    [values]
  );

  return result;
};

exports.singleInsertSlaveQuestionnaireItems = async (
  slaveId,
  certificateId,
  connection
) => {
  // First, get all questionnaire items for the certificate
  const [questionnaireItems] = await connection.query(
    `SELECT type, qNo, qEnglish, qSinhala, qTamil 
     FROM questionnaire 
     WHERE certificateId = ?`,
    [certificateId]
  );

  if (questionnaireItems.length === 0) {
    return { affectedRows: 0 };
  }

  // Create values for all slaveIds with all questionnaire items
  const values = [];
  for (const item of questionnaireItems) {
    values.push([
      slaveId,
      item.type,
      item.qNo,
      item.qEnglish,
      item.qSinhala,
      item.qTamil,
    ]);
  }

  const [result] = await connection.query(
    `INSERT INTO slavequestionnaireitems (slaveId, type, qNo, qEnglish, qSinhala, qTamil) VALUES ?`,
    [values]
  );

  return result;
};

// Check if phone number(s) already exist in certificatecompany
exports.checkByPhoneNumbers = (
  phoneCode1,
  phoneNumber1,
  phoneCode2,
  phoneNumber2,
  excludeId = null
) => {
  return new Promise((resolve, reject) => {
    let conditions = [];
    let params = [];

    // Check phone number 1 if provided
    if (phoneNumber1) {
      conditions.push('(phoneCode1 = ? AND phoneNumber1 = ?)');
      params.push(phoneCode1, phoneNumber1);
    }

    // Check phone number 2 if provided
    if (phoneNumber2) {
      conditions.push('(phoneCode2 = ? AND phoneNumber2 = ?)');
      params.push(phoneCode2, phoneNumber2);
    }

    // If no phone numbers provided, return empty array
    if (conditions.length === 0) {
      return resolve([]);
    }

    let sql = `
      SELECT id, phoneCode1, phoneNumber1, phoneCode2, phoneNumber2
      FROM certificatecompany
      WHERE ${conditions.join(' OR ')}
    `;

    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }

    plantcare.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// Check if certificate name (English) already exists (excluding current certificate)
exports.checkCertificateNameExists = (srtName, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT id FROM certificates WHERE srtName = ?`;
    const values = [srtName];
    
    if (excludeId) {
      sql += ` AND id != ?`;
      values.push(excludeId);
    }
    
    sql += ` LIMIT 1`;
    
    plantcare.query(sql, values, (err, results) => {
      if (err) {
        console.error("Database error checking certificate name:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

// Check if certificate name (Sinhala) already exists (excluding current certificate)
exports.checkCertificateSinhalaNameExists = (srtNameSinhala, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT id FROM certificates WHERE srtNameSinhala = ? AND srtNameSinhala IS NOT NULL AND srtNameSinhala != ''`;
    const values = [srtNameSinhala];
    
    if (excludeId) {
      sql += ` AND id != ?`;
      values.push(excludeId);
    }
    
    sql += ` LIMIT 1`;
    
    plantcare.query(sql, values, (err, results) => {
      if (err) {
        console.error("Database error checking Sinhala certificate name:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

// Check if certificate name (Tamil) already exists (excluding current certificate)
exports.checkCertificateTamilNameExists = (srtNameTamil, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT id FROM certificates WHERE srtNameTamil = ? AND srtNameTamil IS NOT NULL AND srtNameTamil != ''`;
    const values = [srtNameTamil];
    
    if (excludeId) {
      sql += ` AND id != ?`;
      values.push(excludeId);
    }
    
    sql += ` LIMIT 1`;
    
    plantcare.query(sql, values, (err, results) => {
      if (err) {
        console.error("Database error checking Tamil certificate name:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

// Check if certificate number already exists (excluding current certificate)
exports.checkCertificateNumberExists = (srtNumber, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT id FROM certificates WHERE srtNumber = ?`;
    const values = [srtNumber];
    
    if (excludeId) {
      sql += ` AND id != ?`;
      values.push(excludeId);
    }
    
    sql += ` LIMIT 1`;
    
    plantcare.query(sql, values, (err, results) => {
      if (err) {
        console.error("Database error checking certificate number:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};
