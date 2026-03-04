const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
  investment,
  goviShop,
} = require("../startup/database");

// -----------------------------------------------------------------------------------
//example dao check line 19 instance (goviShop.query) carefully before copy pasting
//------------------------------------------------------------------------------------

// exports.forexample = () => {
//   return new Promise((resolve, reject) => {
//     const sql = `
//       SELECT os.id, os.englishName, os.tamilName, os.sinhalaName, os.srvFee,
//              au.userName AS modifiedByUser
//       FROM plant_care.officerservices AS os
//       LEFT JOIN agro_world_admin.adminusers AS au
//         ON os.modifyBy = au.id
//       WHERE os.isValid = 1
//     `;

//     goviShop.query(sql, (err, results) => {
//       if (err) {
//         reject(err);
//       } else {
//         resolve(results); // each row will now include modifiedByUser
//       }
//     });
//   });
// };

exports.getAllGoviShopUsers = (search, currentPlanFilter) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        su.id,
        su.shopName,
        su.ownername,
        su.shopPhone,
        su.email,
        su.nic,
        su.adress,
        su.brImg,
        su.longitude,
        su.latitude,
        su.isAvailable,
        su.currentPlan,
        su.userStatus,
        su.acticatedBy,
        su.acticatedAt,
        su.createdAt,
        au.userName AS activatedByUser
      FROM shopusers su
      LEFT JOIN agro_world_admin.adminusers au ON su.acticatedBy = au.id
    `;

    const values = [];
    const whereConditions = [];

    // Add search condition if search parameter is provided
    if (search) {
      whereConditions.push(
        `(su.shopName LIKE ? OR su.nic LIKE ? OR su.shopPhone LIKE ?)`,
      );
      values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Add currentPlan filter if provided
    if (currentPlanFilter) {
      whereConditions.push(`su.currentPlan = ?`);
      values.push(currentPlanFilter);
    }

    // Add WHERE clause if there are any conditions
    if (whereConditions.length > 0) {
      sql += ` WHERE ` + whereConditions.join(" AND ");
    }

    sql += " ORDER BY su.createdAt DESC";

    goviShop.query(sql, values, (err, results) => {
      if (err) return reject(err);
      resolve({
        total: results.length,
        shopUsers: results,
      });
    });
  });
};

exports.getGoviShopUserById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        su.id,
        su.shopName,
        su.ownername,
        su.shopPhone,
        su.email,
        su.nic,
        su.adress,
        su.brImg,
        su.longitude,
        su.latitude,
        su.isAvailable,
        su.currentPlan,
        su.userStatus,
        su.acticatedBy,
        su.acticatedAt,
        su.createdAt,
        au.userName AS activatedByUser
      FROM shopusers su
      LEFT JOIN agro_world_admin.adminusers au ON su.acticatedBy = au.id
      WHERE su.id = ?
    `;

    goviShop.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results[0]);
    });
  });
};

exports.deleteGoviShopUser = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM shopusers WHERE id = ?";
    goviShop.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results.affectedRows > 0);
    });
  });
};

exports.viewGoviShopSupplierByIdDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        su.id,
        su.shopName,
        su.email,
        su.createdAt,
        su.shopPhone,
        su.adress,
        su.brImg,
        su.latitude,
        su.longitude,
        su.ownername,
        su.nic,
        su.currentPlan,
        pp.planPrice,
        pp.expireDate,
        CASE
          WHEN pp.expireDate IS NULL THEN 'NO_PLAN'
          WHEN pp.expireDate < CURDATE() THEN 'EXPIRED'
          ELSE 'ACTIVE'
        END AS planStatus
      FROM shopusers su
      LEFT JOIN (
        SELECT 
          pp1.userId,
          pp1.planPrice,
          pp1.expireDate,
          pp1.createdAt
        FROM paymentplan pp1
        INNER JOIN (
          SELECT 
            userId,
            MAX(createdAt) AS maxCreatedAt
          FROM paymentplan
          GROUP BY userId
        ) latest
        ON pp1.userId = latest.userId
        AND pp1.createdAt = latest.maxCreatedAt
      ) pp ON su.id = pp.userId
      WHERE su.id = ?
    `;

    goviShop.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};

exports.getAllShowViewActionDAO = (status, searchText) => {
  return new Promise((resolve, reject) => {
    let countSql = `
      SELECT COUNT(*) as total 
       FROM govi_shop.shopusers su
       LEFT JOIN agro_world_admin.adminusers a ON su.acticatedBy = a.id
    `;

    let dataSql = `
      SELECT
        su.id,
        su.shopName, 
        su.ownername, 
        su.shopPhone, 
        su.nic, 
        su.userStatus, 
        su.acticatedAt, 
        a.userName 
      FROM govi_shop.shopusers su 
      LEFT JOIN agro_world_admin.adminusers a ON su.acticatedBy = a.id
    `;

    const params = [];

    let whereConditions = [];

    if (searchText) {
      whereConditions.push(`
          (
            su.shopName LIKE ?
            OR su.nic LIKE ?
            OR su.shopPhone LIKE ?
          )
        `);

      const searchValue = `%${searchText}%`;
      params.push(...Array(3).fill(searchValue));
    }

    if (status) {
      whereConditions.push(`su.userStatus = ?`);
      params.push(status);
    }

    // Append WHERE conditions if any exist
    if (whereConditions.length > 0) {
      const whereClause = " WHERE " + whereConditions.join(" AND ");
      countSql += whereClause;
      dataSql += whereClause;
    }

    dataSql += " ORDER BY su.createdAt DESC";

    // Execute count query first
    goviShop.query(countSql, params, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      goviShop.query(dataSql, params, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }

        resolve({
          items: dataResults,
          total,
        });
      });
    });
  });
};

exports.goviShopViewDocumentDAO = (id) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT
        id,
        shopName,
        ownername,
        shopPhone,
        nic,
        userStatus,
        brImg,
        paySlip
      FROM shopusers
      WHERE id = ?
    `;

    goviShop.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};

exports.updateGoviShopUserStatusDAO = (id, status) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE shopusers
      SET userStatus = ?
      WHERE id = ?
    `;

    goviShop.query(sql, [status, id], (err, results) => {
      if (err) return reject(err);
      resolve(results.affectedRows > 0);
    });
  });
};
