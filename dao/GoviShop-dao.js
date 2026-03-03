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
        id,
        shopName,
        email,
        createdAt,
        shopPhone,
        adress,
        brImg,
        latitude,
        longitude,
        ownername,
        nic,
        currentPlan
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
