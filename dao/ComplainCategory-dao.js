const { admin, plantcare, collectionofficer, marketPlace, dash, } = require("../startup/database");
const { Upload } = require("@aws-sdk/lib-storage");
const Joi = require("joi");

exports.getAllSystemApplicationData = () => {
  return new Promise((resolve, reject) => {
    const sql = `
          SELECT 
          sa.id AS systemAppId,
          sa.appName AS systemAppName,
          (SELECT COUNT(*) FROM complaincategory WHERE appId = sa.id) AS categoryCount
          FROM systemapplications sa
          
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


exports.getComplainCategoryData = (systemAppId) => {
  return new Promise((resolve, reject) => {
    const sql = `
        SELECT 
        cc.id,
        cc.categoryEnglish,
        ar.role
       
        FROM complaincategory cc
         LEFT JOIN adminroles ar ON cc.roleId = ar.id
        WHERE cc.appId = ?
        `;

    admin.query(sql, [systemAppId], (err, results) => {
      if (err) {
        return reject(err);
      }

      resolve(results);
    });
  });
};


exports.getAdminRolesDao = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, role
      FROM adminroles
      `;

    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};


exports.getSystemApplicationDao = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, appName
      FROM systemapplications
      `;

    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

// exports.CheckCategoryEnglishExists = (categoryEnglish) => {
//   return new Promise((resolve, reject) => {
//     const sql = `SELECT id FROM complaincategory WHERE categoryEnglish = ? LIMIT 1`;
//     admin.query(sql, [categoryEnglish], (err, results) => {
//       if (err) {
//         return reject(err);
//       }
//       resolve(results.length > 0);
//     });
//   });
// };
exports.CheckCategoryEnglishExists = (categoryEnglish, appId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT id FROM complaincategory WHERE categoryEnglish = ? AND appId = ? LIMIT 1`;
    admin.query(sql, [categoryEnglish, appId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results.length > 0);
    });
  });
};



exports.AddNewComplainCategoryDao = (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO complaincategory (roleId, appId, categoryEnglish, categorySinhala, categoryTamil)
      VALUES (?, ?, ?, ?, ?)
      `;

    admin.query(sql, [
      data.roleId,
      data.appId,
      data.categoryEnglish,
      data.categorySinhala,
      data.categoryTamil
    ],
      (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results);
      });
  });
};


exports.addNewApplicationData = (applicationName) => {
  return new Promise((resolve, reject) => {
      const sql = `INSERT INTO systemapplications (appName) VALUES (?)`;

      admin.query(sql, [applicationName], (err, results) => {  
          if (err) {
              return reject(err); 
          }
          
          resolve(results); 
      });
  });
};

exports.editApplicationData = (systemAppId, applicationName) => {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE systemapplications SET appName = ? WHERE id = ?`;

      admin.query(sql, [applicationName, systemAppId], (err, results) => {  
          if (err) {
              return reject(err); 
          }
          
          resolve(results); 
      });
  });
};

exports.checkApplicationNameExists = (applicationName, excludeId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT id FROM systemapplications WHERE appName = ? AND id != ? LIMIT 1`;
    admin.query(sql, [applicationName, excludeId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results.length > 0);
    });
  });
};

exports.checkApplicationExists = (applicationName) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT id FROM systemapplications WHERE LOWER(appName) = LOWER(?) LIMIT 1`;
    admin.query(sql, [applicationName], (err, results) => {
      if (err) return reject(err);
      resolve(results.length > 0);
    });
  });
};

// DAO - Get application name by ID
exports.getApplicationNameById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT appName FROM systemapplications WHERE id = ? LIMIT 1`;
    admin.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      if (results.length > 0) {
        resolve(results[0].appName);
      } else {
        resolve(null);
      }
    });
  });
};


exports.deleteApplicationData = (systemAppId) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM systemapplications WHERE id = ?`; // Use DELETE instead of UPDATE

    admin.query(sql, [systemAppId], (err, results) => {  
        if (err) {
            return reject(err); 
        }
        
        // Check if any row was deleted
        if (results.affectedRows === 0) {
          return reject(new Error('No application found with the provided systemAppId'));
        }

        resolve(results); 
    });
  });
};



exports.getCategoriDetailsByIdDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
        SELECT *
        FROM complaincategory 
        WHERE id = ?
        `;

    admin.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }

      resolve(results[0]);
    });
  });
};



exports.EditComplainCategoryDao = (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE complaincategory 
      SET 
        roleId = ?, 
        appId = ?, 
        categoryEnglish = ?, 
        categorySinhala = ?, 
        categoryTamil = ?
      WHERE id = ?
      `;

    admin.query(sql, [
      data.roleId,
      data.appId,
      data.categoryEnglish,
      data.categorySinhala,
      data.categoryTamil,
      data.id
    ],
      (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results);
      });
  });
};

exports.getAllMarketplaceComplaints = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        mc.id,
        mc.userId,
        mc.complaicategoryId,
        mc.complain,
        mc.reply,
        mc.status,
        mc.createdAt,
        mu.firstName,
        mu.lastName,
        mu.phonecode AS phonecode,
        mu.phoneNumber AS phone,
        CONCAT(mu.phonecode, '-', mu.phoneNumber) AS ContactNumber,
        mc.refId AS refNo,
        cc.categoryEnglish
      FROM market_place.marcketplacecomplain mc
      LEFT JOIN market_place.marketplaceusers mu ON mc.userId = mu.id
      LEFT JOIN agro_world_admin.complaincategory cc ON mc.complaicategoryId = cc.id
      LEFT JOIN agro_world_admin.systemapplications sa ON cc.appId = sa.id
      WHERE sa.id = 3
        AND mu.BuyerType = 'retail'
    `;
    marketPlace.query(sql, (err, results) => {
      if (err) {
        console.error('SQL error in getAllMarketplaceComplaints:', err);
        return reject({
          status: false,
          message: 'Database error during fetching marketplace complaints.',
          error: err.message
        });
      }
      resolve({
        status: true,
        data: results,
      });
    });
  });
};

exports.getAllMarketplaceComplaintsWholesale = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        mc.id,
        mc.userId,
        mc.complaicategoryId,
        mc.complain,
        mc.reply,
        mc.status,
        mc.createdAt,
        mu.firstName,
        mu.lastName,
        mu.phonecode AS phonecode,
        mu.companyName AS companyName,
        mu.phoneNumber AS phone,
        CONCAT(mu.phonecode, '-', mu.phoneNumber) AS ContactNumber,
        mc.refId AS refNo,
        cc.categoryEnglish
      FROM market_place.marcketplacecomplain mc
      LEFT JOIN market_place.marketplaceusers mu ON mc.userId = mu.id
      LEFT JOIN agro_world_admin.complaincategory cc ON mc.complaicategoryId = cc.id
      LEFT JOIN agro_world_admin.systemapplications sa ON cc.appId = sa.id
      WHERE sa.id = 3
        AND mu.BuyerType = 'wholesale'
    `;
    marketPlace.query(sql, (err, results) => {
      if (err) {
        console.error('SQL error in getAllMarketplaceComplaints:', err);
        return reject({
          status: false,
          message: 'Database error during fetching marketplace complaints.',
          error: err.message
        });
      }
      resolve({
        status: true,
        data: results,
      });
    });
  });
};


exports.getMarketplaceComplaintById = (complaintId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        mc.id,
        mc.userId,
        mc.complaicategoryId,
       
        mc.complain,
        mc.reply,
        mc.status,
        mc.createdAt,
        mu.firstName,
        mu.lastName,
        mu.phonecode AS phonecode,
        mu.phoneNumber AS phone,
        CONCAT(mu.phonecode, '-', mu.phoneNumber) AS ContactNumber,
        mc.refId AS refNo,
        cc.categoryEnglish,
        GROUP_CONCAT(mci.image) AS imageUrls
      FROM market_place.marcketplacecomplain mc
      LEFT JOIN market_place.marketplaceusers mu ON mc.userId = mu.id
      LEFT JOIN agro_world_admin.complaincategory cc ON mc.complaicategoryId = cc.id
      LEFT JOIN agro_world_admin.systemapplications sa ON cc.appId = sa.id
      LEFT JOIN market_place.marcketplacecomplainimages mci ON mc.id = mci.complainId
      WHERE sa.id = 3 AND mc.id = ?
      GROUP BY mc.id
    `;
    marketPlace.query(sql, [complaintId], (err, results) => {
      if (err) {
        console.error('SQL error in getMarketplaceComplaintById:', err);
        return reject({
          status: false,
          message: 'Database error during fetching marketplace complaint.',
          error: err.message
        });
      }
      if (results.length === 0) {
        return reject({
          status: false,
          message: 'No complaint found with the specified ID.'
        });
      }
      resolve({
        status: true,
        data: results[0], // Return the first (and only) result
      });
    });
  });
};

exports.updateMarketplaceComplaintReply = (complaintId, reply) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE market_place.marcketplacecomplain
      SET reply = ?, status = ?, replyTime = NOW()
      WHERE id = ?
    `;
    marketPlace.query(sql, [reply, "Closed", complaintId, ], (err, results) => {
      if (err) {
        console.error('SQL error in updateMarketplaceComplaintReply:', err);
        return reject({
          status: false,
          message: 'Database error during updating complaint reply.',
          error: err.message
        });
      }
      if (results.affectedRows === 0) {
        return reject({
          status: false,
          message: 'No complaint found with the specified ID.'
        });
      }
      resolve({
        status: true,
        message: 'Complaint reply updated successfully.'
      });
    });
  });
};

exports.getComplaintCategoryFromMarketplace = (appId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT DISTINCT 
        cc.id,
        cc.categoryEnglish
      FROM market_place.marcketplacecomplain mc
      INNER JOIN agro_world_admin.complaincategory cc 
        ON mc.complaicategoryId = cc.id
      WHERE cc.appId = ?
    `;

    admin.query(sql, [appId], (err, results) => {
      if (err) {
        console.error('[getComplaintCategoryFromMarketplace] DB error:', err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

