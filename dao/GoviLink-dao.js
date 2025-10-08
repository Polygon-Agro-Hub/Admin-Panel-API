const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
  dash,
} = require("../startup/database");

exports.checkCompanyDisplayNameDao = async (companyName, regNumber, id) => {
  return new Promise((resolve, reject) => {
    let sql =
      "SELECT * FROM feildcompany WHERE (companyName = ? OR RegNumber = ?)";
    const sqlParams = [companyName, regNumber];

    if (id) {
      sql += " AND id != ?";
      sqlParams.push(id);
    }

    plantcare.query(sql, sqlParams, (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Check if either companyName or RegNumber already exists
        const nameExists = results.some(
          (result) => result.companyName === companyName
        );
        const regNumberExists = results.some(
          (result) => result.RegNumber === regNumber
        );

        resolve({
          exists: results.length > 0,
          nameExists,
          regNumberExists,
        });
      }
    });
  });
};

exports.createCompany = async (
  regNumber,
  companyName,
  email,
  financeOfficerName,
  accName,
  accNumber,
  bank,
  branch,
  phoneCode1,
  phoneNumber1,
  phoneCode2,
  phoneNumber2,
  logo, // This will now be the S3 URL or undefined
  modifyBy
) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO feildcompany (companyName, RegNumber, email, financeOfficerName, accName, accNumber, bank, branch, phoneCode1, phoneNumber1, phoneCode2, phoneNumber2, logo, modifyBy, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW())";

    // Handle undefined logo - set to NULL in database
    const logoValue = logo !== undefined ? logo : null;

    console.log("DAO - Logo value:", logoValue); // Debug log

    const values = [
      companyName,
      regNumber,
      email,
      financeOfficerName,
      accName,
      accNumber,
      bank,
      branch,
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      logoValue, // Use the handled logo value
      modifyBy,
    ];

    console.log("DAO - Executing query with values:", values); // Debug log

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        console.error("DAO - Database error:", err); // Debug log
        reject(err);
      } else {
        console.log("DAO - Insert successful, ID:", results.insertId); // Debug log
        resolve(results.insertId);
      }
    });
  });
};

exports.getCompanyDAO = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM feildcompany WHERE id = ?`;
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

// officerService.dao.js

exports.saveOfficerService = (englishName, tamilName, sinhalaName, srvFee) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO plant_care.officerservices (englishName, tamilName, sinhalaName, srvFee) 
      VALUES (?, ?, ?, ?)
    `;

    admin.query(
      sql,
      [englishName, tamilName, sinhalaName, srvFee],
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            message: "Officer service saved successfully",
            insertId: result.insertId,
          });
        }
      }
    );
  });
};

exports.getAllCompanyDAO = (searchTerm) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        fc.id,
        fc.companyName,
        fc.RegNumber,
        fc.email,
        fc.financeOfficerName,
        fc.accName,
        fc.accNumber,
        fc.bank,
        fc.branch,
        fc.phoneCode1,
        fc.phoneNumber1,
        fc.phoneCode2,
        fc.phoneNumber2,
        fc.logo,
        fc.modifyBy,
        au.userName as modifierName,  -- Get userName from adminusers
        fc.createdAt
      FROM 
        feildcompany fc
      LEFT JOIN 
        agro_world_admin.adminusers au ON fc.modifyBy = au.id
      WHERE 1=1
    `;

    const params = [];

    if (searchTerm && searchTerm.trim()) {
      sql +=
        " AND (fc.companyName LIKE ? OR fc.email LIKE ? OR fc.RegNumber LIKE ?)";
      const trimmed = `%${searchTerm.trim()}%`;
      params.push(trimmed, trimmed, trimmed);
    }

    plantcare.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.updateCompany = (
  id,
  regNumber,
  companyName,
  email,
  financeOfficerName,
  accName,
  accNumber,
  bank,
  branch,
  phoneCode1,
  phoneNumber1,
  phoneCode2,
  phoneNumber2,
  logo,
  modifyBy
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE feildcompany SET 
        regNumber = ?,
        companyName = ?,
        email = ?,
        financeOfficerName = ?,
        accName = ?,
        accNumber = ?,
        bank = ?,
        branch = ?,
        phoneCode1 = ?,
        phoneNumber1 = ?,
        phoneCode2 = ?,
        phoneNumber2 = ?,
        logo = ?,
        modifyBy = ?,
        createdAt = NOW()
      WHERE id = ?
    `;

    const values = [
      regNumber,
      companyName,
      email,
      financeOfficerName,
      accName,
      accNumber,
      bank,
      branch,
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      logo,
      modifyBy,
      id,
    ];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        console.error("Database error details:", err);
        return reject(err);
      }
      console.log("Update successful:", results);
      resolve(results);
    });
  });
};

exports.deleteCompanyById = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM feildcompany WHERE id = ?";
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows);
      }
    });
  });
};

// Update Officer Service by ID
exports.updateOfficerService = (
  id,
  englishName,
  tamilName,
  sinhalaName,
  srvFee,
  modifyBy
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE plant_care.officerservices
      SET englishName = ?, tamilName = ?, sinhalaName = ?, srvFee = ?, modifyBy = ?
      WHERE id = ?
    `;

    admin.query(
      sql,
      [englishName, tamilName, sinhalaName, srvFee, modifyBy, id], // <-- include id here
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.affectedRows === 0) {
            reject(new Error("No officer service found with the given ID"));
          } else {
            resolve({
              message: "Officer service updated successfully",
              affectedRows: result.affectedRows,
            });
          }
        }
      }
    );
  });
};

// Get Officer Service by ID
exports.getOfficerServiceById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, englishName, tamilName, sinhalaName, srvFee
      FROM plant_care.officerservices
      WHERE id = ?
    `;

    admin.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        if (results.length === 0) {
          reject(new Error("No officer service found with the given ID"));
        } else {
          resolve(results[0]); // return single service
        }
      }
    });
  });
};

exports.getAllOfficerServices = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT os.id, os.englishName, os.tamilName, os.sinhalaName, os.srvFee,
             au.userName AS modifiedByUser
      FROM plant_care.officerservices AS os
      LEFT JOIN agro_world_admin.adminusers AS au
        ON os.modifyBy = au.id
      WHERE os.isValid = 1
    `;

    admin.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results); // each row will now include modifiedByUser
      }
    });
  });
};

// Delete an officer service by ID
exports.deleteOfficerServiceById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE plant_care.officerservices 
                 SET isValid = 0 
                 WHERE id = ?`;

    admin.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          message: "Service marked as invalid successfully",
          affectedRows: results.affectedRows,
        });
      }
    });
  });
};

exports.getAllCompanyDAO = (searchTerm) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        fc.id,
        fc.companyName,
        fc.RegNumber,
        fc.email,
        fc.financeOfficerName,
        fc.accName,
        fc.accNumber,
        fc.bank,
        fc.branch,
        fc.phoneCode1,
        fc.phoneNumber1,
        fc.phoneCode2,
        fc.phoneNumber2,
        fc.logo,
        fc.modifyBy,
        au.userName as modifierName,  -- Get userName from adminusers
        fc.createdAt,
        (
          SELECT COUNT(*)
          FROM feildofficer fo1
          WHERE fo1.companyId = fc.id AND fo1.empId LIKE 'CFO%' AND fo1.status = 'Aproved'
        ) AS cfoCount,
        (
          SELECT COUNT(*)
          FROM feildofficer fo2
          WHERE fo2.companyId = fc.id AND fo2.empId LIKE 'FIO%' AND fo2.status = 'Aproved'
        ) AS fioCount
      FROM 
        feildcompany fc
      LEFT JOIN 
        agro_world_admin.adminusers au ON fc.modifyBy = au.id
      WHERE 1=1
    `;

    const params = [];

    if (searchTerm && searchTerm.trim()) {
      sql +=
        " AND (fc.companyName LIKE ? OR fc.email LIKE ? OR fc.RegNumber LIKE ?)";
      const trimmed = `%${searchTerm.trim()}%`;
      params.push(trimmed, trimmed, trimmed);
    }

    plantcare.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};
