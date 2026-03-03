const { admin, plantcare, collectionofficer, marketPlace, investment, goviShop } = require("../startup/database");

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






exports.getAllShowViewActionDAO = (
    status,
    searchText,
  ) => {
    return new Promise((resolve, reject) => {
  
      let countSql = `
      SELECT COUNT(*) as total 
       FROM govi_shop.shopusers su
       LEFT JOIN agro_world_admin.adminusers a ON su.acticatedBy = a.id
       `;

      let dataSql = `
      SELECT
    su.shopName, su.ownername, su.shopPhone, su.nic, su.userStatus, su.acticatedAt, a.userName 
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
            total
          });
        });
      });
    });
  };