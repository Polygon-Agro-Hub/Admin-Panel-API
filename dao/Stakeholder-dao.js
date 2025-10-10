const { admin, plantcare, collectionofficer, marketPlace } = require("../startup/database");
const { Upload } = require("@aws-sdk/lib-storage");
const Joi = require("joi");


exports.getAdminUsersByPosition = () => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT p.positions AS positionName, COUNT(a.id) AS adminUserCount
            FROM adminusers a
            JOIN adminposition p ON a.position = p.id
            GROUP BY p.positions
          `;
    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);
      const formattedResult = results.reduce((acc, item) => {
        acc[item.positionName] = item;
        return acc;
      }, {})
      // console.log('formatterResult-->', formattedResult);
      resolve(formattedResult); // Resolve the promise with the query results
    });
  });
};


exports.getNewAdminUsers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
              SELECT COUNT(*) AS newAdminUserCount FROM adminusers WHERE DATE(created_at) = CURDATE();

            `;
    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results); // Resolve the promise with the query results
    });
  });
};

//not use
exports.getAllAdminUsers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS TotalAdminUserCount FROM adminusers;
            `;
    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results); // Resolve the promise with the query results
    });
  });
};


exports.getCollectionOfficersByPosition = () => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT 
                CASE 
                   WHEN jobRole = 'Collection Centre Head' AND companyId = '1' AND status = 'Approved' THEN 'CCH'
                    WHEN jobRole = 'Collection Centre Manager' AND companyId = '1' AND status = 'Approved' THEN 'CCM'
                    WHEN jobRole = 'Collection Officer' AND companyId = '1' AND status = 'Approved' THEN 'COO'
                    WHEN jobRole = 'Customer Officer' AND companyId = '1' AND status = 'Approved' THEN 'CUO'
                END AS job,
                COUNT(id) AS officerCount
            FROM collectionofficer
            GROUP BY job;

            `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result--->', results);
      const formattedResult = results.reduce((acc, item) => {
        acc[item.job] = item;
        return acc;
      }, {})

      resolve(formattedResult); // Resolve the promise with the query results
    });
  });
};


exports.getNewCollectionOfficers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
              SELECT COUNT(*) AS count FROM collectionofficer WHERE DATE(createdAt) = CURDATE() AND companyId = '1' AND status = 'Approved';

            `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result collectionofficer count', results[0]);

      resolve(results[0].count); // Resolve the promise with the query results
    });
  });
};


//not usefull
exports.getAllCollectionOfficers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS totalOfficerCount FROM collectionofficer;
            `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      console.log('result', results);

      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.getActiveCollectionOfficers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS activeOfficerCount FROM collectionofficer WHERE onlineStatus = 1 AND companyId = '1' AND status = 'Approved';
            `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results[0].activeOfficerCount); // Resolve the promise with the query results
    });
  });
};


exports.getPlantCareUserByQrRegistration = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        CASE 
            WHEN farmerQr IS NOT NULL AND farmerQr <> '' THEN 'QrCode'
            ELSE 'notQrCode'
        END AS qrStatus,
        COUNT(*) AS count
      FROM users
      GROUP BY qrStatus;
            `;
    plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);
      const formattedResult = results.reduce((acc, item) => {
        acc[item.qrStatus] = item;
        return acc;
      }, {})
      // console.log('formatterResult-->', formattedResult);

      resolve(formattedResult); // Resolve the promise with the query results
    });
  });
};


exports.getNewPlantCareUsers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
         SELECT COUNT(*) AS newPlantCareUserCount FROM users WHERE DATE(created_at) = CURDATE()

            `;
    plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results[0].newPlantCareUserCount); // Resolve the promise with the query results
    });
  });
};



exports.getActivePlantCareUsers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS activePlantCareUserCount FROM users WHERE activeStatus = 'active'
            `;
    plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results[0].activePlantCareUserCount); // Resolve the promise with the query results
    });
  });
};



exports.getActiveSalesAgents = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS activeSalesAgents FROM salesagent WHERE status = 'active'
            `;
    marketPlace.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results[0]); // Resolve the promise with the query results
    });
  });
};


exports.getNewSalesAgents = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS newSalesAgents FROM salesagent WHERE DATE(createdAt) = CURDATE() 

            `;
    marketPlace.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results[0]); // Resolve the promise with the query results
    });
  });
};


exports.getAllSalesAgents = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS totalSaleAgents FROM salesagent
    `;
    marketPlace.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results[0]); // Resolve the promise with the query results
    });
  });
};



exports.getTodayRegAdmin = () => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT COUNT(*) AS todayCount
            FROM adminusers
            WHERE DATE(created_at) = CURDATE() 
          `;
    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('Today ->', results);
      
      resolve(results[0]); // Resolve the promise with the query results
    });
  });
};

exports.getAllFieldOfficers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * 
      FROM plant_care.feildofficer
    `;
    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve with all rows
    });
  });
};
