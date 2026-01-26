const { admin, plantcare, collectionofficer, marketPlace, investment, } = require("../startup/database");
const { Upload } = require("@aws-sdk/lib-storage");
const Joi = require("joi");

exports.getAllSystemApplicationData = () => {
  return new Promise((resolve, reject) => {
    const sql = `
          SELECT 
          sa.id AS systemAppId,
          sa.appName AS systemAppName,
          au.userName AS modifiedBy,
          (SELECT COUNT(*) FROM complaincategory WHERE appId = sa.id) AS categoryCount
          FROM systemapplications sa
          LEFT JOIN adminusers au ON sa.modifyBy = au.id
          ORDER BY sa.appName ASC
          
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
        ar.role,
        au.userName AS modifyBy
        FROM complaincategory cc
        LEFT JOIN adminroles ar ON cc.roleId = ar.id
        LEFT JOIN adminusers au ON cc.modifyBy = au.id
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

exports.editApplicationData = (systemAppId, applicationName, adminId) => {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE systemapplications SET appName = ?, modifyBy = ? WHERE id = ?`;

    admin.query(sql, [applicationName, adminId, systemAppId], (err, results) => {
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



exports.EditComplainCategoryDao = (data, adminId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE complaincategory 
      SET 
        roleId = ?, 
        appId = ?, 
        categoryEnglish = ?, 
        categorySinhala = ?, 
        categoryTamil = ?,
        modifyBy = ?
      WHERE id = ?
      `;

    admin.query(sql, [
      data.roleId,
      data.appId,
      data.categoryEnglish,
      data.categorySinhala,
      data.categoryTamil,
      adminId,
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

exports.getAllMarketplaceComplaints = (role) => {
  return new Promise((resolve, reject) => {
    let sql = `
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
        au.userName AS replyBy
      FROM market_place.marcketplacecomplain mc
      LEFT JOIN market_place.marketplaceusers mu ON mc.userId = mu.id
      LEFT JOIN agro_world_admin.complaincategory cc ON mc.complaicategoryId = cc.id
      LEFT JOIN agro_world_admin.systemapplications sa ON cc.appId = sa.id
      LEFT JOIN agro_world_admin.adminusers au ON mc.replyBy = au.id
      WHERE sa.id = 3
        AND mu.BuyerType = 'retail'
    `;
    const sqlParams = [];

    if(role !== 1){
      sql += " AND cc.roleId = ? ";
      sqlParams.push(role);
    }

    marketPlace.query(sql, sqlParams, (err, results) => {
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

exports.getAllMarketplaceComplaintsWholesale = (role) => {
  return new Promise((resolve, reject) => {
    let sql = `
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
        cc.categoryEnglish,
        au.userName AS replyBy
      FROM market_place.marcketplacecomplain mc
      LEFT JOIN market_place.marketplaceusers mu ON mc.userId = mu.id
      LEFT JOIN agro_world_admin.complaincategory cc ON mc.complaicategoryId = cc.id
      LEFT JOIN agro_world_admin.systemapplications sa ON cc.appId = sa.id
      LEFT JOIN agro_world_admin.adminusers au ON mc.replyBy = au.id
      WHERE sa.id = 3
        AND mu.BuyerType = 'wholesale'
    `;

    const sqlParams = [];
    if(role !== 1){
      sql += " AND cc.roleId = ? ";
      sqlParams.push(role);
    }
    marketPlace.query(sql, sqlParams, (err, results) => {
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
        mu.companyName,
        CONCAT(mu.companyPhoneCode, '-', mu.companyPhone) AS companyContactNumber,
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

exports.updateMarketplaceComplaintReply = (complaintId, reply, adminId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE market_place.marcketplacecomplain
      SET reply = ?, status = ?, replyBy = ?, replyTime = NOW()
      WHERE id = ?
    `;
    marketPlace.query(sql, [reply, "Closed", adminId, complaintId], (err, results) => {
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


exports.GetAllDistributedComplainDAO = (
  page,
  limit,
  status,
  category,
  comCategory,
  filterCompany,
  searchText,
  rpstatus
) => {
  return new Promise((resolve, reject) => {
    const Sqlparams = [];
    const Counterparams = [];
    const offset = (page - 1) * limit;

    // SQL to count total records - Added missing JOINs
    let countSql = `
      SELECT COUNT(*) AS total
      FROM distributedcomplains oc
      LEFT JOIN collectionofficer co ON oc.officerId = co.id
      LEFT JOIN agro_world_admin.complaincategory cc ON oc.complainCategory = cc.id
      LEFT JOIN  company c ON co.companyId = c.id
      LEFT JOIN  distributedcenter dc ON co.distributedCenterId = dc.id
      LEFT JOIN agro_world_admin.adminroles ar ON cc.roleId = ar.id
      WHERE complainAssign = 'Admin'
    `;

    // SQL to fetch paginated data
    let sql = `
      SELECT 
        oc.id, 
        oc.refNo,
        co.empId AS empId,
        CONCAT (co.firstNameEnglish, ' ', co.lastNameEnglish) AS officerName,
        CONCAT (co.firstNameSinhala, ' ', co.lastNameSinhala) AS officerNameSinhala,
        CONCAT (co.firstNameTamil, ' ', co.lastNameTamil) AS officerNameTamil,
        c.companyNameEnglish AS companyName,
        cc.categoryEnglish AS complainCategory,
        ar.role,
        oc.createdAt,
        oc.complain,
        oc.AdminStatus AS status,
        oc.reply,
        dc.regCode,
        oc.language,
        au.userName AS replyBy
      FROM distributedcomplains oc
      LEFT JOIN collectionofficer co ON oc.officerId = co.id
      LEFT JOIN agro_world_admin.complaincategory cc ON oc.complainCategory = cc.id
      LEFT JOIN  company c ON co.companyId = c.id
      LEFT JOIN  distributedcenter dc ON co.distributedCenterId = dc.id
      LEFT JOIN agro_world_admin.adminroles ar ON cc.roleId = ar.id
      LEFT JOIN agro_world_admin.adminusers au ON oc.adminReplyBy = au.id
      WHERE complainAssign = 'Admin'
    `;

    // Add filter for status
    if (status) {
      countSql += " AND oc.AdminStatus = ? ";
      sql += " AND oc.AdminStatus = ? ";
      Sqlparams.push(status);
      Counterparams.push(status);
    }

    // Fixed category filter to use the correct alias
    if (category) {
      countSql += " AND ar.role = ? ";
      sql += " AND ar.role = ? ";
      Sqlparams.push(category);
      Counterparams.push(category);
    }

    if (comCategory) {
      countSql += " AND oc.complainCategory = ? ";
      sql += " AND oc.complainCategory = ? ";
      Sqlparams.push(comCategory);
      Counterparams.push(comCategory);
    }

    if (filterCompany) {
      countSql += " AND c.id = ? ";
      sql += " AND c.id = ? ";
      Sqlparams.push(filterCompany);
      Counterparams.push(filterCompany);
    }

    // Add search functionality
    if (searchText) {
      countSql += `
        AND (oc.refNo LIKE ? OR co.empId LIKE ? OR dc.regCode LIKE ? OR c.companyNameEnglish LIKE ?)
      `;
      sql += `
        AND (oc.refNo LIKE ? OR co.empId LIKE ? OR dc.regCode LIKE ? OR c.companyNameEnglish LIKE ?)
      `;
      const searchQuery = `%${searchText}%`;
      Sqlparams.push(searchQuery, searchQuery, searchQuery, searchQuery);
      Counterparams.push(searchQuery, searchQuery, searchQuery, searchQuery);
    }

    if (rpstatus) {
      if (rpstatus === "Yes") {
        countSql += " AND oc.reply IS NOT NULL ";
        sql += " AND oc.reply IS NOT NULL ";
      } else {
        countSql += " AND oc.reply IS NULL ";
        sql += " AND oc.reply IS NULL ";
      }
    }

    // Add pagination
    sql += " ORDER BY oc.createdAt DESC LIMIT ? OFFSET ?";
    Sqlparams.push(parseInt(limit), parseInt(offset));

    // Execute count query to get total records
    collectionofficer.query(
      countSql,
      Counterparams,
      (countErr, countResults) => {
        if (countErr) {
          return reject(countErr);
        }

        const total = countResults[0]?.total || 0;

        // Execute main query to get paginated results
        collectionofficer.query(sql, Sqlparams, (dataErr, results) => {
          if (dataErr) {
            return reject(dataErr);
          }

          resolve({ results, total });
        });
      }
    );
  });
};


exports.getDistributedComplainById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = ` 
    SELECT 
      oc.id, 
      oc.refNo, 
      oc.createdAt, 
      oc.language, 
      oc.complain, 
      oc.complainCategory, 
      oc.reply, 
      cof.firstNameEnglish AS firstName, 
      cof.lastNameEnglish AS lastName, 
      cof.phoneCode01, 
      cof.phoneNumber01,  
      cc.categoryEnglish AS complainCategory, 
      cof.empId AS empId, 
      cof.jobRole AS jobRole,
      CONCAT (cof.firstNameEnglish, ' ', cof.lastNameEnglish) AS officerName,
      CONCAT (cof.firstNameSinhala, ' ', cof.lastNameSinhala) AS officerNameSinhala,
      CONCAT (cof.firstNameTamil, ' ', cof.lastNameTamil) AS officerNameTamil
    FROM distributedcomplains oc
    LEFT JOIN collectionofficer cof ON oc.officerId = cof.id
    LEFT JOIN agro_world_admin.complaincategory cc ON oc.complainCategory = cc.id
    WHERE oc.id = ? 
    `;
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};


exports.sendDistributedComplainReply = (complainId, reply, adminId) => {
  return new Promise((resolve, reject) => {
    // Input validation
    if (!complainId) {
      return reject(new Error("Complain ID is required"));
    }

    if (reply === undefined || reply === null || reply.trim() === "") {
      return reject(new Error("Reply cannot be empty"));
    }

    const sql = `
      UPDATE distributedcomplains 
      SET reply = ?, DIOStatus = ?, DCMStatus = ? , DCHstatus = ? , AdminStatus = ?, adminReplyBy = ?, replyTime = NOW()
      WHERE id = ?
    `;

    const status = "Closed";
    const adminStatus = "Closed";
    const values = [reply, status, status, status, status, adminId, complainId];

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        console.error("Database error details:", err);
        return reject(err);
      }

      if (results.affectedRows === 0) {
        console.warn(`No record found with id: ${complainId}`);
        return reject(new Error(`No record found with id: ${complainId}`));
      }

      console.log("Update successful:", results);
      resolve({
        message: "Reply sent successfully",
        affectedRows: results.affectedRows,
      });
    });
  });
};


exports.GetAllCompanyForOfficerComplain = () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT id, companyNameEnglish FROM company WHERE isDistributed = 1";
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.GetAllDriverComplainDAO = (
  page,
  limit,
  status,
  category,
  comCategory,
  filterCompany,
  searchText,
  rpstatus
) => {
  return new Promise((resolve, reject) => {
    const Sqlparams = [];
    const Counterparams = [];
    const offset = (page - 1) * limit;

    // SQL to count total records - Added missing JOINs
    let countSql = `
      SELECT COUNT(*) AS total
      FROM drivercomplains oc
  LEFT JOIN collectionofficer co ON oc.driverId = co.id
  LEFT JOIN agro_world_admin.complaincategory cc ON oc.complainCategory = cc.id
  LEFT JOIN  company c ON co.companyId = c.id
  LEFT JOIN  distributedcenter dc ON co.distributedCenterId = dc.id
  LEFT JOIN agro_world_admin.adminroles ar ON cc.roleId = ar.id
  LEFT JOIN agro_world_admin.adminusers au ON oc.adminReplyBy = au.id
  WHERE 1=1
    `;

    // SQL to fetch paginated data
    let sql = `
    SELECT 
    oc.id, 
    oc.refNo,
    co.empId AS empId,
    CONCAT (co.firstNameEnglish, ' ', co.lastNameEnglish) AS officerName,
    CONCAT (co.firstNameSinhala, ' ', co.lastNameSinhala) AS officerNameSinhala,
    CONCAT (co.firstNameTamil, ' ', co.lastNameTamil) AS officerNameTamil,
    c.companyNameEnglish AS companyName,
    cc.categoryEnglish AS complainCategory,
    ar.role,
    oc.createdAt,
    oc.complain,
    oc.status AS status,
    oc.reply,
    dc.regCode,
    au.userName AS replyBy
  FROM drivercomplains oc
  LEFT JOIN collectionofficer co ON oc.driverId = co.id
  LEFT JOIN agro_world_admin.complaincategory cc ON oc.complainCategory = cc.id
  LEFT JOIN  company c ON co.companyId = c.id
  LEFT JOIN  distributedcenter dc ON co.distributedCenterId = dc.id
  LEFT JOIN agro_world_admin.adminroles ar ON cc.roleId = ar.id
  LEFT JOIN agro_world_admin.adminusers au ON oc.adminReplyBy = au.id
  WHERE 1=1
    `;

    // Add filter for status
    if (status) {
      countSql += " AND oc.status = ? ";
      sql += " AND oc.status = ? ";
      Sqlparams.push(status);
      Counterparams.push(status);
    }

    // Fixed category filter to use the correct alias
    if (category) {
      countSql += " AND ar.role = ? ";
      sql += " AND ar.role = ? ";
      Sqlparams.push(category);
      Counterparams.push(category);
    }

    if (comCategory) {
      countSql += " AND oc.complainCategory = ? ";
      sql += " AND oc.complainCategory = ? ";
      Sqlparams.push(comCategory);
      Counterparams.push(comCategory);
    }

    if (filterCompany) {
      countSql += " AND c.id = ? ";
      sql += " AND c.id = ? ";
      Sqlparams.push(filterCompany);
      Counterparams.push(filterCompany);
    }

    // Add search functionality
    if (searchText) {
      countSql += `
        AND (oc.refNo LIKE ? OR co.empId LIKE ? OR dc.regCode LIKE ? OR c.companyNameEnglish LIKE ?)
      `;
      sql += `
        AND (oc.refNo LIKE ? OR co.empId LIKE ? OR dc.regCode LIKE ? OR c.companyNameEnglish LIKE ?)
      `;
      const searchQuery = `%${searchText}%`;
      Sqlparams.push(searchQuery, searchQuery, searchQuery, searchQuery);
      Counterparams.push(searchQuery, searchQuery, searchQuery, searchQuery);
    }

    if (rpstatus) {
      console.log('rpstatus', rpstatus)
      if (rpstatus === "Yes") {
        countSql += " AND oc.reply IS NOT NULL ";
        sql += " AND oc.reply IS NOT NULL ";
      } else {
        countSql += " AND oc.reply IS NULL ";
        sql += " AND oc.reply IS NULL ";
      }
    }

    // Add pagination
    sql += " ORDER BY oc.createdAt DESC LIMIT ? OFFSET ?";
    Sqlparams.push(parseInt(limit), parseInt(offset));

    // Execute count query to get total records
    collectionofficer.query(
      countSql,
      Counterparams,
      (countErr, countResults) => {
        if (countErr) {
          return reject(countErr);
        }

        const total = countResults[0]?.total || 0;

        // Execute main query to get paginated results
        collectionofficer.query(sql, Sqlparams, (dataErr, results) => {
          if (dataErr) {
            return reject(dataErr);
          }

          resolve({ results, total });
        });
      }
    );
  });
};

exports.getDriverComplainById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = ` 
    SELECT 
      oc.id, 
      oc.refNo, 
      oc.createdAt, 
      oc.complain, 
      oc.complainCategory, 
      oc.reply, 
      cof.firstNameEnglish AS firstName, 
      cof.lastNameEnglish AS lastName, 
      cof.phoneCode01, 
      cof.phoneNumber01,  
      cc.categoryEnglish AS complainCategory, 
      cof.empId AS empId, 
      cof.jobRole AS jobRole,
      CONCAT (cof.firstNameEnglish, ' ', cof.lastNameEnglish) AS officerName,
      CONCAT (cof.firstNameSinhala, ' ', cof.lastNameSinhala) AS officerNameSinhala,
      CONCAT (cof.firstNameTamil, ' ', cof.lastNameTamil) AS officerNameTamil
    FROM drivercomplains oc
    LEFT JOIN collectionofficer cof ON oc.driverId = cof.id
    LEFT JOIN agro_world_admin.complaincategory cc ON oc.complainCategory = cc.id
    WHERE oc.id = ? 
    `;
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};