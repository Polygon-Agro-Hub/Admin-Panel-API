const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
  dash,
} = require("../startup/database");


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
