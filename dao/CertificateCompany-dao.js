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
exports.checkByRegNumber = (regNumber) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT id FROM certificatecompany WHERE regNumber = ?";
    plantcare.query(sql, [regNumber], (err, results) => {
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
  modifyBy,
}) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO certificates
      (srtcomapnyId, srtName, srtNumber, applicable, accreditation, serviceAreas,
       price, timeLine, commission, tearms, scope, modifyBy, modifyDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
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
      modifyBy,
    ];

    plantcare.query(sql, values, (err, result) => {
      if (err) return reject(err);
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
      modifyBy,
      id,
    ];
    plantcare.query(sql, values, (err, result) => {
      if (err) return reject(err);
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
