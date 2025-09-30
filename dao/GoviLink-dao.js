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
