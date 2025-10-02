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
  logo,
  modifyBy
) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO feildcompany (companyName, RegNumber, email, financeOfficerName, accName, accNumber, bank, branch, phoneCode1, phoneNumber1, phoneCode2, phoneNumber2, logo, modifyBy, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW())";

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
      logo,
      modifyBy,
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

    admin.query(sql, [englishName, tamilName, sinhalaName, srvFee], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          message: "Officer service saved successfully",
          insertId: result.insertId
        });
      }
    });
  });
};

// Update Officer Service by ID
exports.updateOfficerService = (id, englishName, tamilName, sinhalaName, srvFee, modifyBy) => {
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
              affectedRows: result.affectedRows
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
          message: 'Service marked as invalid successfully', 
          affectedRows: results.affectedRows 
        });
      }
    });
  });
};

