const {
  admin,
  plantcare,
  collectionofficer,
} = require("../startup/database");

const triggeGetRejectOfficers = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT c.id FROM collectionofficer c WHERE c.status = 'Rejected'";
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};