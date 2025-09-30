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
  address
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO certificatecompany
      (comName, regNumber, taxId, phoneCode1, phoneNumber1, phoneCode2, phoneNumber2, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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

// Get all certificate companies with pagination and search
exports.getAllCertificateCompanies = (limit, offset, search) => {
  return new Promise((resolve, reject) => {
    // Base SQL
    let sql = `
      SELECT 
        cc.id,
        cc.comName AS companyName, 
        cc.regNumber,
        cc.phoneCode1,
        cc.phoneNumber1,
        cc.createdAt,
        COUNT(c.id) AS certificateCount
      FROM certificatecompany cc
      LEFT JOIN certificates c ON cc.id = c.srtcomapnyId
    `;

    const values = [];
    if (search) {
      sql += ` WHERE cc.regNumber LIKE ? OR cc.taxId LIKE ?`;
      values.push(`%${search}%`, `%${search}%`);
    }

    sql += " GROUP BY cc.id ORDER BY cc.createdAt DESC LIMIT ? OFFSET ?";
    values.push(limit, offset);

    // Count total companies
    let countSql = `SELECT COUNT(*) AS total FROM certificatecompany cc`;
    if (search) {
      countSql += ` WHERE cc.regNumber LIKE ? OR cc.taxId LIKE ?`;
    }

    plantcare.query(
      countSql,
      search ? [`%${search}%`, `%${search}%`] : [],
      (err, countResults) => {
        if (err) return reject(err);
        const total = countResults[0].total;

        plantcare.query(sql, values, (err, results) => {
          if (err) return reject(err);
          resolve({ total, companies: results });
        });
      }
    );
  });
};
