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
  userId
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO certificatecompany
      (comName, regNumber, taxId, phoneCode1, phoneNumber1, phoneCode2, phoneNumber2, address, modifyBy, modifyDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
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
      userId,
    ];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.insertId);
      }
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
        cc.createdAt
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
  modifyBy
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE certificatecompany 
      SET comName=?, regNumber=?, taxId=?, phoneCode1=?, phoneNumber1=?, 
          phoneCode2=?, phoneNumber2=?, address=?,
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
      (srtcomapnyId, srtName, srtNumber, applicable, accreditation, serviceAreas, price, timeLine, commission, tearms, scope, modifyBy, modifyDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const values = [
      srtcomapnyId,
      srtName,
      srtNumber,
      applicable,
      accreditation,
      JSON.stringify(serviceAreas), // <-- convert array to JSON string
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
