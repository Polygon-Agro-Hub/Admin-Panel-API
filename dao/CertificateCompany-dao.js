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
  modifyBy,
}) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO certificates
      (srtcomapnyId, srtName, srtNumber, applicable, accreditation, serviceAreas,
       price, timeLine, commission, tearms, scope, logo, modifyBy, modifyDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      srtcomapnyId,
      srtName,
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
    const sql = `
      INSERT INTO certificatecrops (certificateId, cropId)
      VALUES ?
    `;
    const values = cropIds.map((cropId) => [certificateId, cropId]);

    plantcare.query(sql, [values], (err, result) => {
      if (err) return reject(err);
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
  modifyBy,
}) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE certificates
      SET
        srtcomapnyId = ?,
        srtName = ?,
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
        modifyBy = ?,
        modifyDate = NOW()
      WHERE id = ?
    `;
    const values = [
      srtcomapnyId,
      srtName,
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
exports.createFarmCluster = async (clusterName, modifyBy, connection) => {
  const [result] = await connection.query(
    `INSERT INTO farmcluster (clsName, modifyBy, modifyDate) VALUES (?, ?, NOW())`,
    [clusterName, modifyBy]
  );
  return result;
};

// Check if a cluster name already exists
exports.isClusterNameExists = async (clusterName, connection) => {
  const [rows] = await connection.query(
    `SELECT id FROM farmcluster WHERE clsName = ?`,
    [clusterName.trim()]
  );
  return rows.length > 0;
};

// Get farmer IDs by NIC
exports.getFarmerIdsByNICs = async (nicList, connection) => {
  const [rows] = await connection.query(
    `SELECT id, NICnumber FROM users WHERE NICnumber IN (?)`,
    [nicList]
  );
  const map = {};
  rows.forEach((r) => (map[r.NICnumber] = r.id));
  return map;
};

// Bulk insert farmers into cluster
exports.bulkInsertClusterFarmers = async (clusterId, farmerIds, connection) => {
  if (farmerIds.length === 0) return { affectedRows: 0 };
  const values = farmerIds.map((id) => [clusterId, id]);
  const [result] = await connection.query(
    `INSERT INTO farmclusterfarmers (clusterId, farmerId) VALUES ?`,
    [values]
  );
  return result;
};

// Get all farmer clusters with member count and last modified info
exports.getAllFarmerClusters = async (connection, search = "") => {
  let query = `
    SELECT 
      fc.id AS clusterId,
      fc.clsName AS clusterName,
      COUNT(fcf.farmerId) AS memberCount,
      au.userName AS lastModifiedBy,
      fc.modifyDate AS lastModifiedDate
    FROM farmcluster fc
    LEFT JOIN farmclusterfarmers fcf ON fc.id = fcf.clusterId
    LEFT JOIN agro_world_admin.adminusers au ON fc.modifyBy = au.id
  `;

  const params = [];

  if (search) {
    query += ` WHERE fc.clsName LIKE ? `;
    params.push(`%${search}%`);
  }

  // Sort by cluster name alphabetically (A → Z)
  query += `
    GROUP BY fc.id, fc.clsName, au.userName, fc.modifyDate
    ORDER BY fc.clsName ASC
  `;

  const [rows] = await connection.query(query, params);
  return rows;
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
  const [clusterRows] = await connection.query(
    `SELECT clsName AS clusterName FROM farmcluster WHERE id = ?`,
    [clusterId]
  );
  const clusterName = clusterRows.length ? clusterRows[0].clusterName : null;

  let query = `
    SELECT 
      u.id,
      u.firstName,
      u.lastName,
      u.NICnumber AS NIC,
      u.phoneNumber
    FROM users u
    INNER JOIN farmclusterfarmers fcf ON u.id = fcf.farmerId
    WHERE fcf.clusterId = ?
  `;
  const params = [clusterId];

  if (search) {
    query += ` AND (u.NICnumber LIKE ? OR u.phoneNumber LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY u.firstName ASC, u.lastName ASC`;

  const [rows] = await connection.query(query, params);
  const members = rows.map((user, index) => ({
    no: String(index + 1).padStart(2, "0"),
    id: user.id,
    farmerId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    nic: user.NIC,
    phoneNumber: user.phoneNumber,
  }));

  return {
    clusterId,
    clusterName,
    members,
  };
};

// Delete specific user from a cluster
exports.deleteClusterUser = async (clusterId, farmerId, connection) => {
  const [result] = await connection.query(
    `DELETE FROM farmclusterfarmers WHERE clusterId = ? AND farmerId = ?`,
    [clusterId, farmerId]
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
    `SELECT id FROM farmclusterfarmers WHERE clusterId = ? AND farmerId = ?`,
    [clusterId, farmerId]
  );
  return rows.length > 0;
};

// Insert farmer into cluster
exports.insertFarmerIntoCluster = async (clusterId, farmerId, connection) => {
  await connection.query(
    `INSERT INTO farmclusterfarmers (clusterId, farmerId, createdAt) VALUES (?, ?, NOW())`,
    [clusterId, farmerId]
  );
};

// Update only clsName in farmcluster using existing connection
exports.updateClusterName = async (
  clusterId,
  clusterName,
  userId,
  connection
) => {
  await connection.query(
    `UPDATE farmcluster 
     SET clsName = ?, modifyBy = ?, modifyDate = NOW() 
     WHERE id = ?`,
    [clusterName.trim(), userId, clusterId]
  );
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
