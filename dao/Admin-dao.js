const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
} = require("../startup/database");
const bcrypt = require("bcryptjs");
const { Upload } = require("@aws-sdk/lib-storage");
const Joi = require("joi");

exports.getPermissionsByRole = (role, position) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT rf.featureId, fe.name
      FROM rolefeatures rf
      JOIN features fe ON rf.featureId  = fe.id
      WHERE roleId = ? AND positionId = ?`;

    admin.query(sql, [role, position], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Map the results to return an array of permission names
        const permissions = results.map((row) => row.name);
        resolve(permissions);
      }
    });
  });
};

exports.loginAdmin = (email) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM adminusers WHERE mail = ? OR userName = ?";
    admin.query(sql, [email, email], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getAllAdminUsers = (limit, offset, role, search) => {
  return new Promise((resolve, reject) => {
    let countSql = `
      SELECT COUNT(DISTINCT AU.id) as total 
      FROM adminusers AU 
      JOIN adminroles AR ON AU.role = AR.id
      JOIN adminposition AP ON AU.position = AP.id
    `;

    const dataParms = [];
    let dataSql = `
      SELECT AU.id, AU.mail, AU.userName, AR.role, AP.positions  
      FROM adminusers AU 
      JOIN adminroles AR ON AU.role = AR.id
      JOIN adminposition AP ON AU.position = AP.id
      WHERE 1=1
    `;

    if (role) {
      dataSql += ` AND AR.id = ? `;
      countSql += ` AND AR.id = ? `;
      dataParms.push(role);
    }

    if (search) {
      dataSql += ` AND (AU.mail LIKE ? OR AU.userName LIKE ?) `;
      countSql += ` AND (AU.mail LIKE ? OR AU.userName LIKE ?) `;
      dataParms.push(`%${search}%`, `%${search}%`);
    }

    dataSql += ` ORDER BY AU.created_at DESC LIMIT ? OFFSET ? `;
    dataParms.push(limit, offset);

    admin.query(countSql, dataParms, (countErr, countResults) => {
      if (countErr) {
        reject(countErr);
      } else {
        admin.query(dataSql, dataParms, (dataErr, dataResults) => {
          if (dataErr) {
            reject(dataErr);
          } else {
            resolve({
              total: countResults[0].total,
              items: dataResults,
            });
          }
        });
      }
    });
  });
};

exports.adminCreateUser = (firstName, lastName, phoneNumber, NICnumber) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO users (`firstName`, `lastName`, `phoneNumber`, `NICnumber`) VALUES (?)";
    const values = [firstName, lastName, phoneNumber, NICnumber];

    plantcare.query(sql, [values], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getAllUsers = (limit, offset, searchItem, regStatus, district, plan) => {
  return new Promise((resolve, reject) => {
    let whereConditions = [];
    let countParams = [];
    let dataParams = [];

    console.log(regStatus);
    // Base SQL queries
    let countSql = "SELECT COUNT(*) as total FROM users";
    let dataSql = "SELECT * FROM users";

    // Add search condition for NICnumber, firstName, lastName, or phoneNumber if provided
    if (searchItem) {
      whereConditions.push(
        "(users.NICnumber LIKE ? OR users.firstName LIKE ? OR users.lastName LIKE ? OR users.phoneNumber LIKE ?)"
      );
      const searchQuery = `%${searchItem}%`;
      countParams.push(searchQuery, searchQuery, searchQuery, searchQuery);
      dataParams.push(searchQuery, searchQuery, searchQuery, searchQuery);
    }

    // Add registration status condition if provided
    // Add registration status condition if provided
    if (regStatus === "Registered") {
      console.log("Hit 01");
      whereConditions.push("LENGTH(users.farmerQr) > 0");
    } else if (regStatus === "Unregistered") {
      console.log("Hit 01");
      whereConditions.push(
        "LENGTH(users.farmerQr) = 0 OR users.farmerQr IS NULL"
      );
    }
    // Add district condition if provided
    if (district) {
      whereConditions.push("users.district LIKE ?");
      const districtQuery = `%${district}%`;
      countParams.push(districtQuery);
      dataParams.push(districtQuery);
    }

    if (plan) {
      whereConditions.push("users.membership LIKE ?");
      const planQuery = `%${plan}%`;
      countParams.push(planQuery);
      dataParams.push(planQuery);
    }

    // Combine WHERE conditions if any exist
    if (whereConditions.length > 0) {
      const whereClause = " WHERE " + whereConditions.join(" AND ");
      countSql += whereClause;
      dataSql += whereClause;
    }

    // Add order, limit, and offset clauses
    dataSql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    dataParams.push(parseInt(limit), parseInt(offset));

    // Execute the count query
    plantcare.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        return reject(countErr);
      }

      const total = countResults[0].total;

      // Execute the data query
      plantcare.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) {
          return reject(dataErr);
        }

        resolve({
          total: total,
          items: dataResults,
        });
      });
    });
  });
};

exports.createOngoingCultivations = (userId, cropCalenderId) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO ongoingcultivations (`userId`, `cropCalenderId`) VALUES (?)";
    const values = [userId, cropCalenderId];

    plantcare.query(sql, [values], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.createNews = async (
  titleEnglish,
  titleSinhala,
  titleTamil,
  descriptionEnglish,
  descriptionSinhala,
  descriptionTamil,
  imageBuffer, // accept the image buffer
  status,
  publishDate,
  expireDate
) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO content (titleEnglish, titleSinhala, titleTamil, descriptionEnglish, descriptionSinhala, descriptionTamil, image, status, publishDate, expireDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [
      titleEnglish,
      titleSinhala,
      titleTamil,
      descriptionEnglish,
      descriptionSinhala,
      descriptionTamil,
      imageBuffer, // pass the buffer as image
      status,
      publishDate,
      expireDate,
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

exports.getAllNews = async (limit, offset, status, createdAt) => {
  return new Promise((resolve, reject) => {
    let countsSql = "SELECT COUNT(*) as total FROM content";
    let dataSql = "SELECT * FROM content";
    let whereClauses = [];
    let queryParams = [];

    if (status) {
      whereClauses.push("status = ?");
      queryParams.push(status);
    }

    if (createdAt) {
      const formattedCreatedAt = new Date(createdAt)
        .toISOString()
        .split("T")[0];
      whereClauses.push("DATE(publishDate) = ?");
      queryParams.push(formattedCreatedAt);
    }

    if (whereClauses.length > 0) {
      const whereClause = " WHERE " + whereClauses.join(" AND ");
      countsSql += whereClause;
      dataSql += whereClause;
    }

    dataSql += " ORDER BY createdAt DESC";
    dataSql += " LIMIT ? OFFSET ?";
    queryParams.push(limit, offset);

    console.log(
      "Executing count query:",
      countsSql,
      "with params:",
      queryParams.slice(0, -2)
    );
    plantcare.query(
      countsSql,
      queryParams.slice(0, -2),
      (countErr, countResults) => {
        if (countErr) {
          console.error("Error in count query:", countErr);
          reject(countErr);
          return;
        }

        const total = countResults[0].total;
        console.log("Total count:", total);

        if (total === 0) {
          resolve({ items: [], total: 0 });
          return;
        }

        console.log(
          "Executing data query:",
          dataSql,
          "with params:",
          queryParams
        );
        plantcare.query(dataSql, queryParams, (dataErr, dataResults) => {
          if (dataErr) {
            console.error("Error in data query:", dataErr);
            reject(dataErr);
            return;
          }

          // Convert the image blob to base64 and include in the response
          const newsItems = dataResults.map((news) => {
            return news;
          });

          console.log("Data query results:", newsItems.length);
          resolve({ items: newsItems, total: total });
        });
      }
    );
  });
};

exports.getNewsById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM content WHERE id = ?";
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getCropCalenderById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM cropcalender WHERE id = ?";
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getNewsStatusById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT status FROM content WHERE id = ?";
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.updateNewsStatusById = (id, status) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE content SET status = ? WHERE id = ?";
    plantcare.query(sql, [status, id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.createMarketPrice = (
  titleEnglish,
  titleSinhala,
  titleTamil,
  descriptionEnglish,
  descriptionSinhala,
  descriptionTamil,
  imageBuffer,
  status,
  price,
  createdBy
) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO marketprice (titleEnglish, titleSinhala, titleTamil, descriptionEnglish, descriptionSinhala, descriptionTamil, image, status, price, createdBy) VALUES (?,?,?,?,?,?,?,?,?,?)";
    const values = [
      titleEnglish,
      titleSinhala,
      titleTamil,
      descriptionEnglish,
      descriptionSinhala,
      descriptionTamil,
      imageBuffer,
      status,
      price,
      createdBy,
    ];

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.insertId);
      }
    });
  });
};

exports.getAllMarketPrice = (status, createdAt, limit, offset) => {
  console.log("Create AT: ", createdAt);

  return new Promise((resolve, reject) => {
    let countsSql = "SELECT COUNT(*) as total FROM marketprice";
    let dataSql = "SELECT * FROM marketprice";
    let whereClauses = [];
    let queryParams = [];

    if (status) {
      whereClauses.push("status = ?");
      queryParams.push(status);
    }

    if (createdAt) {
      const formattedCreatedAt = new Date(createdAt)
        .toISOString()
        .split("T")[0];
      whereClauses.push("DATE(createdAt) = ?");
      queryParams.push(formattedCreatedAt);
    }

    if (whereClauses.length > 0) {
      const whereClause = " WHERE " + whereClauses.join(" AND ");
      countsSql += whereClause;
      dataSql += whereClause;
    }

    dataSql += " ORDER BY createdAt DESC";
    dataSql += " LIMIT ? OFFSET ?";
    queryParams.push(limit, offset);

    collectionofficer.query(
      countsSql,
      queryParams.slice(0, -2),
      (countErr, countResults) => {
        if (countErr) {
          return reject(countErr);
        }

        const total = countResults[0].total;

        collectionofficer.query(
          dataSql,
          queryParams,
          (dataErr, dataResults) => {
            if (dataErr) {
              return reject(dataErr);
            }

            resolve({ total, dataResults });
          }
        );
      }
    );
  });
};

exports.deleteMarketPriceById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM marketprice WHERE id = ?";
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getMarketPriceStatusById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT status FROM marketprice WHERE id = ?";
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.updateMarketPriceStatusById = (id, newStatus) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE marketprice SET status = ? WHERE id = ?";
    collectionofficer.query(sql, [newStatus, id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getMarketPriceById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM marketprice WHERE id = ?";
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.editMarketPrice = (id, data) => {
  return new Promise((resolve, reject) => {
    let sql = `
            UPDATE marketprice 
            SET 
                titleEnglish = ?, 
                titleSinhala = ?, 
                titleTamil = ?, 
                descriptionEnglish = ?, 
                descriptionSinhala = ?, 
                descriptionTamil = ?,
                price = ?
        `;
    let values = [
      data.titleEnglish,
      data.titleSinhala,
      data.titleTamil,
      data.descriptionEnglish,
      data.descriptionSinhala,
      data.descriptionTamil,
      data.price,
    ];

    if (data.imageData) {
      sql += `, image = ?`;
      values.push(data.imageData);
    }

    sql += ` WHERE id = ?`;
    values.push(id);

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

// exports.getAllOngoingCultivations = (searchItem, limit, offset) => {
//   return new Promise((resolve, reject) => {
//     // Count query
//     let countSql = `
//       SELECT 
//         COUNT(*) as total
//       FROM users U
//       LEFT JOIN ongoingcultivations OC  ON OC.userId = U.id
//       LEFT JOIN ongoingcultivationscrops OCC ON OC.id = OCC.ongoingCultivationId
//       INNER JOIN farms F ON F.userId = U.id
//       WHERE 1=1
//     `;

//     // Data query with proper grouping
//     let dataSql = `
//       SELECT 
//         OC.id AS cultivationId,
//         U.id AS userId,
//         U.firstName, 
//         U.lastName, 
//         U.NICnumber,
//         U.phoneNumber,
//         COUNT(DISTINCT F.id) AS FarmCount
//       FROM users U
//       LEFT JOIN ongoingcultivations OC  ON OC.userId = U.id
//       LEFT JOIN ongoingcultivationscrops OCC ON OC.id = OCC.ongoingCultivationId
//       INNER JOIN farms F ON F.userId = U.id
//       WHERE 1=1
//     `;

//     const countParams = [];
//     const dataParams = [];

//     if (searchItem) {
//       const searchQuery = `%${searchItem}%`;
//       const searchCondition = `
//         AND (
//           U.NICnumber LIKE ? OR 
//           U.firstName LIKE ? OR 
//           U.lastName LIKE ? OR
//           U.phoneNumber LIKE ?
//         )
//       `;
//       countSql += searchCondition;
//       dataSql += searchCondition;
//       countParams.push(searchQuery, searchQuery, searchQuery, searchQuery);
//       dataParams.push(searchQuery, searchQuery, searchQuery, searchQuery);
//     }

//     dataSql += `
//       GROUP BY OC.id, U.id, U.firstName, U.lastName, U.NICnumber, U.phoneNumber
//       ORDER BY OC.createdAt DESC 
//       LIMIT ? OFFSET ?
//     `;

//     countSql += ` GROUP BY OC.id, U.id, U.firstName, U.lastName, U.NICnumber, U.phoneNumber `
//     dataParams.push(limit, offset);

//     // Fetch total count
//     plantcare.query(countSql, countParams, (countErr, countResults) => {
//       if (countErr) {
//         return reject(countErr);
//       }

//       const total = countResults[0].total;

//       // Fetch paginated data
//       plantcare.query(dataSql, dataParams, (dataErr, dataResults) => {
//         if (dataErr) {
//           return reject(dataErr);
//         }
//         resolve({
//           total,
//           items: dataResults,
//           totalCrops: dataResults.reduce(
//             (sum, item) => sum + item.CropCount,
//             0
//           ),
//         });
//       });
//     });
//   });
// };


exports.getAllOngoingCultivations = (searchItem, limit, offset) => {
  return new Promise((resolve, reject) => {
    // Count query
    let countSql = `
      SELECT COUNT(DISTINCT U.id) AS total
      FROM users U
      INNER JOIN farms F ON U.id = F.userId
      WHERE 1=1
    `;

    // Data query with proper grouping
    let dataSql = `
      SELECT 
      	 U.id AS userId,
         U.firstName, 
         U.lastName, 
         U.NICnumber,
         U.phoneNumber,
         COUNT(DISTINCT F.id) AS FarmCount
      FROM users U
      INNER JOIN farms F ON U.id = F.userId
      WHERE 1=1
    `;

    const countParams = [];
    const dataParams = [];

    if (searchItem) {
      const searchQuery = `%${searchItem}%`;
      const searchCondition = `
        AND (
          U.NICnumber LIKE ? OR 
          U.firstName LIKE ? OR 
          U.lastName LIKE ? OR
          U.phoneNumber LIKE ?
        )
      `;
      countSql += searchCondition;
      dataSql += searchCondition;
      countParams.push(searchQuery, searchQuery, searchQuery, searchQuery);
      dataParams.push(searchQuery, searchQuery, searchQuery, searchQuery);
    }

    dataSql += `
      GROUP BY 
      	U.id,
        U.firstName, 
        U.lastName, 
        U.NICnumber,
        U.phoneNumber
      ORDER BY U.created_at DESC 
      LIMIT ? OFFSET ?
    `;

    dataParams.push(limit, offset);

    // Fetch total count
    plantcare.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        return reject(countErr);
      }

      const total = countResults[0].total;

      // Fetch paginated data
      plantcare.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) {
          return reject(dataErr);
        }
        resolve({
          total,
          items: dataResults,
        });
      });
    });
  });
};


exports.getOngoingCultivationsWithUserDetails = () => {
  const sql = `
        SELECT 
            ongoingCultivations.id AS cultivationId, 
            users.firstName, 
            users.lastName 
        FROM 
            ongoingcultivations 
        JOIN 
            users ON ongoingCultivations.userId = users.id;
    `;

  return new Promise((resolve, reject) => {
    plantcare.query(sql, (err, results) => {
      if (err) {
        reject("Error fetching ongoing cultivations: " + err);
      } else {
        resolve(results);
      }
    });
  });
};

// exports.getOngoingCultivationsById = (farmId, userId) => {
//   const sql = `
//     SELECT DISTINCT
//       ongoingcultivationscrops.id AS ongoingcultivationscropsid,
//       ongoingcultivationscrops.ongoingCultivationId,
//       ongoingcultivationscrops.cropCalendar,
//       ongoingcultivationscrops.startedAt,
//       (ongoingcultivationscrops.extentac + ongoingcultivationscrops.extentha * 2.47105 +  ongoingcultivationscrops.extentp / 160 )  AS extentac,
//       cropgroup.cropNameEnglish AS cropName,
//       cropvariety.varietyNameEnglish AS variety,
//       cropcalender.method AS cultivationMethod,
//       cropcalender.natOfCul AS natureOfCultivation,
//       cropcalender.cropDuration AS cropDuration,
//       ongoingcultivationscrops.longitude,
//       ongoingcultivationscrops.latitude,
//       (SELECT COUNT(*) FROM slavecropcalendardays WHERE onCulscropID = ongoingcultivationscrops.id) AS totalTasks,
//       (SELECT COUNT(*) FROM slavecropcalendardays WHERE onCulscropID = ongoingcultivationscrops.id AND status = 'completed') AS completedTasks
//     FROM
//       ongoingcultivationscrops
//     JOIN
//       cropcalender ON ongoingcultivationscrops.cropCalendar = cropcalender.id
//     JOIN
//       cropvariety ON cropcalender.cropVarietyId = cropvariety.id
//     JOIN
//       cropgroup ON cropvariety.cropGroupId = cropgroup.id
//     LEFT JOIN
//       slavecropcalendardays ON slavecropcalendardays.onCulscropID = ongoingcultivationscrops.id
//     WHERE
//       ongoingcultivationscrops.ongoingCultivationId = ?`;

//   return new Promise((resolve, reject) => {
//     plantcare.query(sql, [farmId], (err, results) => {  // <-- use farmId here
//       if (err) {
//         reject("Error fetching cultivation crops by ID: " + err);
//       } else {
//         resolve(results);
//       }
//     });
//   });
// };

exports.getOngoingCultivationsByFarmId = (farmId, userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT DISTINCT
        occ.id AS ongoingcultivationscropsid,
        occ.ongoingCultivationId,
        occ.cropCalendar,
        occ.startedAt,
        (occ.extentac + occ.extentha * 2.47105 + occ.extentp / 160) AS extentac,
        cg.cropNameEnglish AS cropName,
        cv.varietyNameEnglish AS variety,
        cc.method AS cultivationMethod,
        cc.natOfCul AS natureOfCultivation,
        cc.cropDuration AS cropDuration,
        occ.longitude,
        occ.latitude,
        au.userName AS modifyBy,
        u.firstName AS userFirstName,
        u.lastName AS userLastName,
        (SELECT COUNT(*) FROM slavecropcalendardays WHERE onCulscropID = occ.id) AS totalTasks,
        (SELECT COUNT(*) FROM slavecropcalendardays WHERE onCulscropID = occ.id AND status = 'completed') AS completedTasks,
        f.farmName,
        occ.planType
      FROM 
        ongoingcultivationscrops occ
      JOIN 
        ongoingcultivations oc ON occ.ongoingCultivationId = oc.id
      JOIN 
        users u ON oc.userId = u.id
      JOIN 
        cropcalender cc ON occ.cropCalendar = cc.id
      JOIN 
        cropvariety cv ON cc.cropVarietyId = cv.id
      JOIN 
        cropgroup cg ON cv.cropGroupId = cg.id
      LEFT JOIN 
        farms f ON occ.farmId = f.id
      LEFT JOIN
        agro_world_admin.adminusers au ON occ.modifyBy = au.id
      WHERE
        occ.farmId = ? AND oc.userId = ?`;

    plantcare.query(sql, [farmId, userId], (err, results) => {
      if (err) {
        return reject("Error fetching cultivation crops by farmId: " + err);
      }

      if (results.length > 0) {
        // Data found
        resolve({
          userFirstName: results[0].userFirstName,
          userLastName: results[0].userLastName,
          farmName: results[0].farmName,
          cultivations: results,
        });
      } else {
        // No cultivations found → still get user name
        const userSql = `SELECT firstName AS userFirstName, lastName AS userLastName FROM users WHERE id = ?`;
        plantcare.query(userSql, [userId], (userErr, userResult) => {
          if (userErr) {
            return reject("Error fetching user details: " + userErr);
          }

          if (userResult.length > 0) {
            resolve({
              userFirstName: userResult[0].userFirstName,
              userLastName: userResult[0].userLastName,
              cultivations: [],
            });
          } else {
            // User not found
            resolve({
              userFirstName: null,
              userLastName: null,
              cultivations: [],
            });
          }
        });
      }
    });
  });
};

exports.getFixedAssetsByCategory = (userId, category, farmId) => {
  const validCategories = {
    "Building and Infrastructures": `
            SELECT 
                fixedasset.id AS fixedassetId,
                fixedasset.category AS fixedassetcategory,
                buildingfixedasset.id AS buildingfixedassetId,
                buildingfixedasset.type,
                buildingfixedasset.floorArea,
                buildingfixedasset.ownership,
                buildingfixedasset.generalCondition,
                buildingfixedasset.district
            FROM 
                fixedasset
            JOIN 
                buildingfixedasset ON fixedasset.id = buildingfixedasset.fixedAssetId
            WHERE 
                fixedasset.userId = ? AND fixedasset.farmId = ?;
        `,
    Land: `
            SELECT 
                fixedasset.id AS fixedassetId,
                fixedasset.category AS fixedassetcategory,
                landfixedasset.id AS buildingfixedassetId,
                landfixedasset.extentha,
                landfixedasset.extentac,
                landfixedasset.extentp,
                landfixedasset.ownership,
                landfixedasset.district,
                landfixedasset.perennialCrop
            FROM 
                fixedasset
            JOIN 
                landfixedasset ON fixedasset.id = landfixedasset.fixedAssetId
            WHERE 
                fixedasset.userId = ? AND fixedasset.farmId = ?;
        `,
    "Machinery and Vehicles": `
            SELECT
                fixedasset.id AS fixedassetId,
                fixedasset.category AS fixedassetcategory,
                machtoolsfixedasset.asset,
                machtoolsfixedasset.assetType,
                machtoolsfixedasset.mentionOther,
                machtoolsfixedasset.numberOfUnits,
                machtoolsfixedasset.unitPrice,
                machtoolsfixedasset.totalPrice,
                machtoolsfixedasset.warranty,
                CASE 
                    WHEN machtoolsfixedasset.warranty = 'no' THEN 'No data'
                    WHEN machtoolsfixedasset.warranty = 'yes' AND machtoolsfixedassetwarranty.expireDate IS NULL THEN 'No data'
                    WHEN machtoolsfixedasset.warranty = 'yes' AND machtoolsfixedassetwarranty.expireDate > NOW() THEN 'Under warranty'
                    WHEN machtoolsfixedasset.warranty = 'yes' AND machtoolsfixedassetwarranty.expireDate <= NOW() THEN 'Expired'
                    ELSE 'No data'
                END AS warrantystatus
            FROM
                fixedasset
            JOIN
                machtoolsfixedasset ON fixedasset.id = machtoolsfixedasset.fixedAssetId
            LEFT JOIN
                machtoolsfixedassetwarranty ON machtoolsfixedasset.id = machtoolsfixedassetwarranty.machToolsId
            WHERE 
                fixedasset.userId = ? AND fixedasset.farmId = ? AND fixedasset.category = 'Machine and Vehicles';
        `,
    "Tools and Equipments": `
            SELECT
                fixedasset.id AS fixedassetId,
                fixedasset.category AS fixedassetcategory,
                machtoolsfixedasset.asset,
                machtoolsfixedasset.assetType,
                machtoolsfixedasset.mentionOther,
                machtoolsfixedasset.numberOfUnits,
                machtoolsfixedasset.unitPrice,
                machtoolsfixedasset.totalPrice,
                machtoolsfixedasset.warranty,
                CASE 
                    WHEN machtoolsfixedasset.warranty = 'no' THEN 'No data'
                    WHEN machtoolsfixedasset.warranty = 'yes' AND machtoolsfixedassetwarranty.expireDate IS NULL THEN 'No data'
                    WHEN machtoolsfixedasset.warranty = 'yes' AND machtoolsfixedassetwarranty.expireDate > NOW() THEN 'Under warranty'
                    WHEN machtoolsfixedasset.warranty = 'yes' AND machtoolsfixedassetwarranty.expireDate <= NOW() THEN 'Expired'
                    ELSE 'No data'
                END AS warrantystatus
            FROM
                fixedasset
            JOIN
                machtoolsfixedasset ON fixedasset.id = machtoolsfixedasset.fixedAssetId
            LEFT JOIN
                machtoolsfixedassetwarranty ON machtoolsfixedasset.id = machtoolsfixedassetwarranty.machToolsId
            WHERE 
                fixedasset.userId = ? AND fixedasset.farmId = ? AND fixedasset.category = 'Tools';
        `,
  };

  const sql = validCategories[category];

  if (!sql) {
    return Promise.reject("Invalid category.");
  }

  return new Promise((resolve, reject) => {
    plantcare.query(sql, [userId, farmId], (err, results) => {
      if (err) {
        reject("Error fetching assets: " + err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getBuildingOwnershipDetails = (buildingAssetId) => {
  return new Promise((resolve, reject) => {
    // First, get the building details including ownership type
    const getBuildingQuery = `
      SELECT 
        bf.id as buildingAssetId,
        bf.ownership,
        bf.type,
        bf.floorArea,
        bf.generalCondition,
        bf.district
      FROM 
        buildingfixedasset bf
      WHERE 
        bf.id = ?;
    `;

    plantcare.query(
      getBuildingQuery,
      [buildingAssetId],
      (err, buildingResults) => {
        if (err) {
          reject("Error fetching building details: " + err);
          return;
        }

        if (buildingResults.length === 0) {
          reject("Building not found");
          return;
        }

        const building = buildingResults[0];
        const ownership = building.ownership;

        // Define ownership-specific queries
        const ownershipQueries = {
          "Own Building (with title ownership)": `
          SELECT 
            oof.id,
            oof.buildingAssetId,
            oof.landAssetId,
            oof.issuedDate,
            oof.estimateValue
          FROM 
            ownershipownerfixedasset oof
          WHERE 
            oof.buildingAssetId = ?;
        `,
          "Leased Building": `
          SELECT 
            olf.id,
            olf.buildingAssetId,
            olf.landAssetId,
            olf.startDate,
            olf.durationYears,
            olf.durationMonths,
            olf.leastAmountAnnually
          FROM 
            ownershipleastfixedasset olf
          WHERE 
            olf.buildingAssetId = ?;
        `,
          "Permit Building": `
          SELECT 
            opf.id,
            opf.buildingAssetId,
            opf.landAssetId,
            opf.issuedDate,
            opf.permitFeeAnnually
          FROM 
            ownershippermitfixedasset opf
          WHERE 
            opf.buildingAssetId = ?;
        `,
          "Shared / No Ownership": `
          SELECT 
            osf.id,
            osf.buildingAssetId,
            osf.landAssetId,
            osf.paymentAnnually
          FROM 
            ownershipsharedfixedasset osf
          WHERE 
            osf.buildingAssetId = ?;
        `,
        };

        const ownershipQuery = ownershipQueries[ownership];

        if (!ownershipQuery) {
          // If no specific ownership query, return just building details
          resolve({
            buildingDetails: building,
            ownershipDetails: null,
            ownershipType: ownership,
          });
          return;
        }

        // Execute the ownership-specific query
        plantcare.query(
          ownershipQuery,
          [buildingAssetId],
          (err, ownershipResults) => {
            if (err) {
              reject("Error fetching ownership details: " + err);
            } else {
              resolve({
                buildingDetails: building,
                ownershipDetails:
                  ownershipResults.length > 0 ? ownershipResults[0] : null,
                ownershipType: ownership,
              });
            }
          }
        );
      }
    );
  });
};

exports.getLandOwnershipDetails = (landAssetId) => {
  return new Promise((resolve, reject) => {
    // First, get the land details including ownership type
    const getLandQuery = `
      SELECT 
        lf.id as landAssetId,
        lf.fixedAssetId,
        lf.ownership,
        lf.extentha,
        lf.extentac,
        lf.extentp,
        lf.district,
        lf.landFenced,
        lf.perennialCrop
      FROM 
        landfixedasset lf
      WHERE 
        lf.id = ?;
    `;

    plantcare.query(getLandQuery, [landAssetId], (err, landResults) => {
      if (err) {
        reject("Error fetching land details: " + err);
        return;
      }

      if (landResults.length === 0) {
        reject("Land not found");
        return;
      }

      const land = landResults[0];
      const ownership = land.ownership;

      // Get extent values without calculation
      const extentha = land.extentha || 0;
      const extentac = land.extentac || 0;
      const extentp = land.extentp || 0;

      // Define ownership-specific queries for land
      const ownershipQueries = {
        Own: `
          SELECT 
            oof.id,
            oof.buildingAssetId,
            oof.landAssetId,
            oof.issuedDate,
            oof.estimateValue
          FROM 
            ownershipownerfixedasset oof
          WHERE 
            oof.landAssetId = ?;
        `,
        Lease: `
          SELECT 
            olf.id,
            olf.buildingAssetId,
            olf.landAssetId,
            olf.startDate,
            olf.durationYears,
            olf.durationMonths,
            olf.leastAmountAnnually
          FROM 
            ownershipleastfixedasset olf
          WHERE 
            olf.landAssetId = ?;
        `,
        Permited: `
          SELECT 
            opf.id,
            opf.buildingAssetId,
            opf.landAssetId,
            opf.issuedDate,
            opf.permitFeeAnnually
          FROM 
            ownershippermitfixedasset opf
          WHERE 
            opf.landAssetId = ?;
        `,
        Shared: `
          SELECT 
            osf.id,
            osf.buildingAssetId,
            osf.landAssetId,
            osf.paymentAnnually
          FROM 
            ownershipsharedfixedasset osf
          WHERE 
            osf.landAssetId = ?;
        `,
      };

      const ownershipQuery = ownershipQueries[ownership];

      if (!ownershipQuery) {
        // If no specific ownership query, return just land details with separate extent values
        resolve({
          landDetails: {
            landAssetId: land.landAssetId,
            ownership: land.ownership,
            extentha: extentha,
            extentac: extentac,
            extentp: extentp,
            district: land.district,
            landFenced: land.landFenced,
            perennialCrop: land.perennialCrop,
          },
          ownershipDetails: null,
          ownershipType: ownership,
        });
        return;
      }

      // Execute the ownership-specific query
      plantcare.query(
        ownershipQuery,
        [landAssetId],
        (err, ownershipResults) => {
          if (err) {
            reject("Error fetching ownership details: " + err);
          } else {
            resolve({
              landDetails: {
                landAssetId: land.landAssetId,
                ownership: land.ownership,
                extentha: extentha,
                extentac: extentac,
                extentp: extentp,
                district: land.district,
                landFenced: land.landFenced,
                perennialCrop: land.perennialCrop,
              },
              ownershipDetails:
                ownershipResults.length > 0 ? ownershipResults[0] : null,
              ownershipType: ownership,
            });
          }
        }
      );
    });
  });
};

exports.getCurrentAssetsByCategory = (userId, category, farmId) => {
  const sql = `SELECT * FROM currentasset WHERE userId = ? AND category = ? AND farmId = ?`;
  const values = [userId, category, farmId];

  return new Promise((resolve, reject) => {
    plantcare.query(sql, values, (err, results) => {
      if (err) {
        reject("Error fetching current assets: " + err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.deleteAdminUserById = (id) => {
  const sql = "DELETE FROM adminusers WHERE id = ?";

  return new Promise((resolve, reject) => {
    admin.query(sql, [id], (err, results) => {
      if (err) {
        reject("Error executing delete query: " + err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.updateAdminUserById = (id, mail, userName, role, position) => {
  const sql = `
        UPDATE adminusers 
        SET 
            mail = ?, 
            userName = ?, 
            role = ?,
            position = ?
        WHERE id = ?`;

  return new Promise((resolve, reject) => {
    admin.query(sql, [mail, userName, role, position, id], (err, results) => {
      if (err) {
        reject("Error executing update query: " + err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.updateAdminUser = (id, mail, userName, role, position) => {
  return new Promise((resolve, reject) => {
    const sql = `
            UPDATE adminusers 
            SET 
                mail = ?, 
                userName = ?, 
                role = ?,
                position = ?
            WHERE id = ?
        `;

    const values = [mail, userName, role, position, id];

    admin.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getAdminUserById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM adminusers WHERE id = ?";

    admin.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getAdminPasswordById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT password FROM adminusers WHERE id = ?";
    admin.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// Update the password for a given admin user
exports.updateAdminPasswordById = (id, newPassword) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE adminusers SET password = ? WHERE id = ?";
    admin.query(sql, [newPassword, id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.deletePlantCareUserById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM users WHERE id = ?";
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// exports.updatePlantCareUserById = (userData, id) => {
//   return new Promise((resolve, reject) => {
//     const {
//       firstName,
//       lastName,
//       phoneNumber,
//       NICnumber,
//       district,
//       membership,
//       profileImage,
//     } = userData;

//     let sql = `
//       UPDATE users
//       SET
//           firstName = ?,
//           lastName = ?,
//           phoneNumber = ?,
//           NICnumber = ?,
//           district = ?,
//           membership = ?
//     `;
//     let values = [
//       firstName,
//       lastName,
//       phoneNumber,
//       NICnumber,
//       district,
//       membership,
//     ];

//     if (profileImage) {
//       sql += `, profileImage = ?`;
//       values.push(profileImage);
//     }

//     sql += ` WHERE id = ?`;
//     values.push(id);

//     plantcare.query(sql, values, (err, results) => {
//       if (err) {
//         reject(err);
//       } else {
//         resolve(results);
//       }
//     });
//   });
// };

exports.updatePlantCareUserById = (userData, id) => {
  return new Promise((resolve, reject) => {
    const {
      firstName,
      lastName,
      phoneNumber,
      NICnumber,
      district,
      membership,
      language,
      profileImageUrl,
      accNumber,
      accHolderName,
      bankName,
      branchName,
    } = userData;

    // Get a connection from the pool
    plantcare.getConnection((connErr, connection) => {
      if (connErr) return reject(connErr);

      connection.beginTransaction((beginErr) => {
        if (beginErr) {
          connection.release();
          return reject(beginErr);
        }

        connection.query(
          `SELECT phoneNumber, NICnumber FROM users WHERE (phoneNumber = ? OR NICnumber = ?) AND id != ?`,
          [phoneNumber, NICnumber, id],
          (checkErr, checkResults) => {
            if (checkErr) {
              return connection.rollback(() => {
                connection.release();
                reject(checkErr);
              });
            }

            if (checkResults.length > 0) {
              const duplicateFields = [];

              // Check which fields are duplicated
              const duplicatePhone = checkResults.some(
                (row) => row.phoneNumber === phoneNumber
              );
              const duplicateNIC = checkResults.some(
                (row) => row.NICnumber === NICnumber
              );

              if (duplicatePhone) duplicateFields.push("Mobile Number");
              if (duplicateNIC) duplicateFields.push("NIC");

              let errorMessage;
              if (duplicateFields.length === 1) {
                errorMessage = `${duplicateFields[0]} is already exists`;
              } else {
                errorMessage = `${duplicateFields.join(
                  " & "
                )} are already exists`;
              }

              return connection.rollback(() => {
                connection.release();
                reject(new Error(errorMessage));
              });
            }

            // Update user
            let sql = `
              UPDATE users 
              SET 
                  firstName = ?, 
                  lastName = ?, 
                  phoneNumber = ?, 
                  NICnumber = ?, 
                  district = ?, 
                  membership = ?,
                  language = ?
            `;
            let values = [
              firstName,
              lastName,
              phoneNumber,
              NICnumber,
              district,
              membership,
              language,
            ];

            if (profileImageUrl) {
              sql += `, profileImage = ?`;
              values.push(profileImageUrl);
            }

            sql += ` WHERE id = ?`;
            values.push(id);

            connection.query(
              sql,
              values,
              (updateUserErr, updateUserResults) => {
                if (updateUserErr) {
                  return connection.rollback(() => {
                    connection.release();
                    reject(updateUserErr);
                  });
                }

                // Update or insert bank details if provided
                if (accNumber && accHolderName && bankName) {
                  // First check if bank details exist
                  connection.query(
                    `SELECT id FROM userbankdetails WHERE userId = ?`,
                    [id],
                    (bankCheckErr, bankCheckResults) => {
                      if (bankCheckErr) {
                        return connection.rollback(() => {
                          connection.release();
                          reject(bankCheckErr);
                        });
                      }

                      if (bankCheckResults.length > 0) {
                        // Update existing bank details
                        connection.query(
                          `UPDATE userbankdetails 
                         SET accNumber = ?, accHolderName = ?, bankName = ?, branchName = ?
                         WHERE userId = ?`,
                          [
                            accNumber,
                            accHolderName,
                            bankName,
                            branchName || null,
                            id,
                          ],
                          (updateBankErr) => {
                            if (updateBankErr) {
                              return connection.rollback(() => {
                                connection.release();
                                reject(updateBankErr);
                              });
                            }

                            connection.commit((commitErr) => {
                              connection.release();
                              if (commitErr) {
                                return reject(commitErr);
                              }
                              resolve({
                                userId: id,
                                message:
                                  "User and bank details updated successfully",
                              });
                            });
                          }
                        );
                      } else {
                        // Insert new bank details
                        connection.query(
                          `INSERT INTO userbankdetails (userId, accNumber, accHolderName, bankName, branchName)
                         VALUES (?, ?, ?, ?, ?)`,
                          [
                            id,
                            accNumber,
                            accHolderName,
                            bankName,
                            branchName || null,
                          ],
                          (insertBankErr) => {
                            if (insertBankErr) {
                              return connection.rollback(() => {
                                connection.release();
                                reject(insertBankErr);
                              });
                            }

                            connection.commit((commitErr) => {
                              connection.release();
                              if (commitErr) {
                                return reject(commitErr);
                              }
                              resolve({
                                userId: id,
                                message:
                                  "User updated and bank details created successfully",
                              });
                            });
                          }
                        );
                      }
                    }
                  );
                } else {
                  connection.commit((commitErr) => {
                    connection.release();
                    if (commitErr) {
                      return reject(commitErr);
                    }
                    resolve({
                      userId: id,
                      message: "User updated successfully (no bank details)",
                    });
                  });
                }
              }
            );
          }
        );
      });
    });
  });
};

// exports.createPlantCareUser = (userData) => {
//   return new Promise((resolve, reject) => {
//     const {
//       firstName,
//       lastName,
//       phoneNumber,
//       NICnumber,
//       district,
//       membership,
//       profileImageUrl,
//     } = userData;

//     // SQL query to check if phoneNumber or NICnumber already exists
//     const checkSql = `
//             SELECT id FROM users WHERE phoneNumber = ? OR NICnumber = ?
//         `;
//     const checkValues = [phoneNumber, NICnumber];

//     plantcare.query(checkSql, checkValues, (checkErr, checkResults) => {
//       if (checkErr) {
//         return reject(checkErr); // Return the database error
//       }

//       if (checkResults.length > 0) {
//         // If a match is found, reject with an error message
//         return reject(new Error("Phone number or NIC number already exists"));
//       }

//       // Proceed with the INSERT operation
//       const insertSql = `
//             INSERT INTO users (firstName, lastName, phoneNumber, NICnumber, district, membership, profileImage)
//             VALUES (?, ?, ?, ?, ?, ?, ?)
//         `;
//       const insertValues = [
//         firstName,
//         lastName,
//         phoneNumber,
//         NICnumber,
//         district,
//         membership,
//         profileImageUrl,
//       ];

//       plantcare.query(insertSql, insertValues, (insertErr, insertResults) => {
//         if (insertErr) {
//           console.log(insertErr);

//           reject(insertErr); // Return the database error
//         } else {
//           resolve(insertResults.insertId); // Return the newly created user ID
//         }
//       });
//     });
//   });
// };

exports.createPlantCareUser = (userData) => {
  return new Promise((resolve, reject) => {
    const {
      firstName,
      lastName,
      phoneNumber,
      NICnumber,
      district,
      membership,
      language,
      profileImageUrl,
      accNumber,
      accHolderName,
      bankName,
      branchName,
    } = userData;

    // Get a connection from the pool
    plantcare.getConnection((connErr, connection) => {
      if (connErr) return reject(connErr);

      connection.beginTransaction((beginErr) => {
        if (beginErr) {
          connection.release();
          return reject(beginErr);
        }

        // Check if user exists with specific field checking
        connection.query(
          `SELECT phoneNumber, NICnumber FROM users WHERE phoneNumber = ? OR NICnumber = ?`,
          [phoneNumber, NICnumber],
          (checkErr, checkResults) => {
            if (checkErr) {
              return connection.rollback(() => {
                connection.release();
                reject(checkErr);
              });
            }

            if (checkResults.length > 0) {
              const duplicateFields = [];

              // Check which fields are duplicated
              const duplicatePhone = checkResults.some(
                (row) => row.phoneNumber === phoneNumber
              );
              const duplicateNIC = checkResults.some(
                (row) => row.NICnumber === NICnumber
              );

              if (duplicatePhone) duplicateFields.push("Mobile Number");
              if (duplicateNIC) duplicateFields.push("NIC");

              let errorMessage;
              if (duplicateFields.length === 1) {
                errorMessage = `${duplicateFields[0]} is already exists`;
              } else {
                errorMessage = `${duplicateFields.join(
                  " & "
                )} are already exists`;
              }

              return connection.rollback(() => {
                connection.release();
                reject(new Error(errorMessage));
              });
            }

            // Insert user with activeStatus set to 'inactive'
            connection.query(
              `INSERT INTO users (firstName, lastName, phoneNumber, NICnumber, district, membership, language, profileImage, activeStatus)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                firstName,
                lastName,
                phoneNumber,
                NICnumber,
                district,
                membership,
                language,
                profileImageUrl,
                "inactive",
              ],
              (insertUserErr, insertUserResults) => {
                if (insertUserErr) {
                  return connection.rollback(() => {
                    connection.release();
                    reject(insertUserErr);
                  });
                }

                const userId = insertUserResults.insertId;

                // Insert bank details if provided
                if (accNumber && accHolderName && bankName) {
                  connection.query(
                    `INSERT INTO userbankdetails (userId, accNumber, accHolderName, bankName, branchName)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                      userId,
                      accNumber,
                      accHolderName,
                      bankName,
                      branchName || null,
                    ],
                    (insertBankErr) => {
                      if (insertBankErr) {
                        return connection.rollback(() => {
                          connection.release();
                          reject(insertBankErr);
                        });
                      }

                      connection.commit((commitErr) => {
                        connection.release();
                        if (commitErr) {
                          return reject(commitErr);
                        }
                        resolve({
                          userId,
                          message: "User and bank details created successfully",
                        });
                      });
                    }
                  );
                } else {
                  connection.commit((commitErr) => {
                    connection.release();
                    if (commitErr) {
                      return reject(commitErr);
                    }
                    resolve({
                      userId,
                      message: "User created successfully (no bank details)",
                    });
                  });
                }
              }
            );
          }
        );
      });
    });
  });
};

// exports.getUserById = (userId) => {
//   return new Promise((resolve, reject) => {
//     const sql = "SELECT * FROM users WHERE id = ?";
//     plantcare.query(sql, [userId], (err, results) => {
//       if (err) {
//         return reject(err);
//       }
//       resolve(results[0]); // Return the first result
//     });
//   });
// };

exports.getUserById = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        u.*,
        ub.id AS bankDetailId,
        ub.accNumber,
        ub.accHolderName,
        ub.bankName,
        ub.branchName,
        ub.createdAt AS bankDetailCreatedAt
      FROM users u
      LEFT JOIN userbankdetails ub ON u.id = ub.userId
      WHERE u.id = ?
    `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length === 0) {
        return resolve(null); // Return null if no user found
      }

      // Combine user data with bank details
      const userData = {
        ...results[0],
        // Include bank details if they exist
        ...(results[0].bankDetailId && {
          accNumber: results[0].accNumber,
          accHolderName: results[0].accHolderName,
          bankName: results[0].bankName,
          branchName: results[0].branchName,
          bankDetailCreatedAt: results[0].bankDetailCreatedAt,
        }),
      };

      // Remove the joined table prefix if you want cleaner object
      delete userData.bankDetailId;

      resolve(userData);
    });
  });
};

exports.findAdminByEmailOrUsername = (email, userName) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM adminusers WHERE mail = ? OR userName = ?
    `;
    admin.query(sql, [email, userName], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

exports.countSuperAdmins = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS count FROM adminusers WHERE role = 'Super Admin'
    `;
    admin.query(sql, (err, results) => {
      if (err) return reject(err);
      resolve(results[0].count);
    });
  });
};

exports.createAdmin = (adminData, hashedPassword) => {
  return new Promise((resolve, reject) => {
    const sql = `
            INSERT INTO adminusers (mail, role, position, userName, password) 
            VALUES (?, ?, ?, ?, ?)
        `;
    const values = [
      adminData.mail,
      adminData.role,
      adminData.position,
      adminData.userName,
      hashedPassword,
    ];

    admin.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Pass the error back if it occurs
      }
      resolve(results); // Resolve with the results
    });
  });
};

exports.getCurrentAssetGroup = (userId, farmId) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT category, SUM(total) as totPrice 
            FROM currentasset 
            WHERE userId = ? AND farmId = ?
            GROUP BY category
        `;
    const values = [userId, farmId];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject promise on error
      }
      resolve(results); // Resolve promise with the query results
    });
  });
};

exports.getCurrentAssetRecordById = (currentAssetId) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT id, currentAssetId, 
                   COALESCE(numOfPlusUnit, 0) AS numOfPlusUnit, 
                   COALESCE(numOfMinUnit, 0) AS numOfMinUnit, 
                   totalPrice, createdAt  
            FROM currentassetrecord 
            WHERE currentAssetId = ?
            ORDER BY createdAt DESC
        `;
    const values = [currentAssetId];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.deleteCropTask = (taskId) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM cropcalendardays WHERE id = ?";
    const values = [taskId];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.getCropCalendarDayById = (taskId) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM cropcalendardays WHERE id = ?";
    const values = [taskId];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      // Return null if no record is found
      if (results.length === 0) {
        return resolve(null);
      }

      resolve(results[0]); // Resolve the promise with the first result
    });
  });
};

exports.editTask = (
  taskEnglish,
  taskSinhala,
  taskTamil,
  taskTypeEnglish,
  taskTypeSinhala,
  taskTypeTamil,
  taskCategoryEnglish,
  taskCategorySinhala,
  taskCategoryTamil,
  taskDescriptionEnglish,
  taskDescriptionSinhala,
  taskDescriptionTamil,
  reqImages,
  imageLink,
  videoLinkEnglish,
  videoLinkSinhala,
  videoLinkTamil,
  id
) => {
  return new Promise((resolve, reject) => {
    const sql = `
            UPDATE cropcalendardays 
            SET taskEnglish=?, taskSinhala=?, taskTamil=?, taskTypeEnglish=?, taskTypeSinhala=?, taskTypeTamil=?, 
                taskCategoryEnglish=?, taskCategorySinhala=?, taskCategoryTamil=?, taskDescriptionEnglish=?, taskDescriptionSinhala=?, taskDescriptionTamil=?, reqImages=?, imageLink=?, videoLinkEnglish=?, videoLinkSinhala=?, videoLinkTamil=?
            WHERE id = ?
        `;
    const values = [
      taskEnglish,
      taskSinhala,
      taskTamil,
      taskTypeEnglish,
      taskTypeSinhala,
      taskTypeTamil,
      taskCategoryEnglish,
      taskCategorySinhala,
      taskCategoryTamil,
      taskDescriptionEnglish,
      taskDescriptionSinhala,
      taskDescriptionTamil,
      reqImages,
      imageLink,
      videoLinkEnglish,
      videoLinkSinhala,
      videoLinkTamil,
      id,
    ];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject the promise on error
      }

      resolve(results); // Resolve the promise with the results
    });
  });
};

exports.getAllPost = () => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM publicforumposts ORDER BY createdAt DESC `;

    plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      if (results.length === 0) {
        return resolve(null);
      }
      resolve(results);
    });
  });
};

// exports.getAllUserTaskByCropId = (cropId, userId) => {
//   return new Promise((resolve, reject) => {
//     const countSql = `SELECT COUNT(*) as total FROM slavecropcalendardays WHERE
//     slavecropcalendardays.cropCalendarId = ?
//     AND slavecropcalendardays.userId = ?`;
//     const sql = `
//             SELECT
//     slavecropcalendardays.id AS slavecropcalendardaysId,
//     slavecropcalendardays.cropCalendarId,
//     slavecropcalendardays.taskIndex,
//     slavecropcalendardays.days,
//     slavecropcalendardays.taskEnglish,
//     slavecropcalendardays.status
// FROM
//     slavecropcalendardays
// WHERE
//     slavecropcalendardays.cropCalendarId = ?
//     AND slavecropcalendardays.userId = ?
// ORDER BY slavecropcalendardays.taskIndex;

//         `;
//     const values = [cropId, userId];

//     db.query(sql, values, (err, results) => {
//       if (err) {
//         return reject(err); // Reject promise if an error occurs
//       }
//       resolve(results); // Resolve the promise with the query results
//     });
//   });
// };

exports.getAllUserTaskByCropId = (cropId, userId, limit, offset) => {
  return new Promise((resolve, reject) => {
    const countSql = `
      SELECT COUNT(*) as total 
      FROM slavecropcalendardays 
      WHERE cropCalendarId = ? AND userId = ?`;

    const firstDateSql = `
      SELECT MIN(startingDate) as firstStartingDate
      FROM slavecropcalendardays
      WHERE cropCalendarId = ? AND userId = ?`;

    const dataSql = `
      SELECT 
          slavecropcalendardays.id AS slavecropcalendardaysId,
          slavecropcalendardays.cropCalendarId,
          slavecropcalendardays.taskIndex, 
          slavecropcalendardays.startingDate, 
          slavecropcalendardays.taskEnglish,
          slavecropcalendardays.imageLink,
          slavecropcalendardays.videoLinkEnglish,
          slavecropcalendardays.videoLinkSinhala,
          slavecropcalendardays.videoLinkTamil,
          slavecropcalendardays.status,
          slavecropcalendardays.onCulscropID,
          GROUP_CONCAT(taskimages.image SEPARATOR ', ') AS imageUploads
      FROM 
          slavecropcalendardays
      LEFT JOIN
          taskimages
      ON
          slavecropcalendardays.id = taskimages.slaveId
      WHERE 
          slavecropcalendardays.cropCalendarId = ? 
          AND slavecropcalendardays.userId = ? 
      GROUP BY slavecropcalendardays.id
      ORDER BY slavecropcalendardays.taskIndex
      `;
    // LIMIT ? OFFSET ?

    const values = [cropId, userId, limit, offset];

    // First, query the total count of the tasks
    plantcare.query(countSql, [cropId, userId], (countErr, countResults) => {
      if (countErr) {
        return reject(countErr);
      }

      // Query the first starting date
      plantcare.query(
        firstDateSql,
        [cropId, userId],
        (dateErr, dateResults) => {
          if (dateErr) {
            return reject(dateErr);
          }

          // Next, query the task data with pagination (limit and offset)
          plantcare.query(dataSql, values, (dataErr, dataResults) => {
            if (dataErr) {
              return reject(dataErr);
            }

            // Resolve with total count, first starting date, and paginated items
            resolve({
              total: countResults[0].total, // The total count of tasks
              firstStartingDate: dateResults[0].firstStartingDate, // The first starting date
              items: dataResults, // The list of tasks for the user
            });
          });
        }
      );
    });
  });
};

exports.getUserTaskStatusById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT status FROM slavecropcalendardays WHERE id = ?";
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.updateUserTaskStatusById = (id, newStatus) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE slavecropcalendardays SET status = ? WHERE id = ?";
    plantcare.query(sql, [newStatus, id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getSlaveCropCalendarDayById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM slavecropcalendardays WHERE id = ?";
    const values = [id];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      // Return null if no record is found
      if (results.length === 0) {
        return resolve(null);
      }

      resolve(results[0]); // Resolve the promise with the first result
    });
  });
};

exports.editUserTask = (
  taskEnglish,
  taskSinhala,
  taskTamil,
  taskTypeEnglish,
  taskTypeSinhala,
  taskTypeTamil,
  taskCategoryEnglish,
  taskCategorySinhala,
  taskCategoryTamil,
  startingDate,
  reqImages,
  imageLink,
  videoLinkEnglish,
  videoLinkSinhala,
  videoLinkTamil,
  id
) => {
  return new Promise((resolve, reject) => {
    const sql = `
            UPDATE slavecropcalendardays 
            SET taskEnglish=?, taskSinhala=?, taskTamil=?, taskTypeEnglish=?, taskTypeSinhala=?, taskTypeTamil=?, 
                taskCategoryEnglish=?, taskCategorySinhala=?, taskCategoryTamil=? , startingDate=?, reqImages=?,imageLink=?, videoLinkEnglish= ?, videoLinkSinhala= ?, videoLinkTamil= ?
            WHERE id = ?
        `;
    const values = [
      taskEnglish,
      taskSinhala,
      taskTamil,
      taskTypeEnglish,
      taskTypeSinhala,
      taskTypeTamil,
      taskCategoryEnglish,
      taskCategorySinhala,
      taskCategoryTamil,
      startingDate,
      reqImages,
      imageLink,
      videoLinkEnglish,
      videoLinkSinhala,
      videoLinkTamil,
      id,
    ];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject the promise on error
      }

      resolve(results); // Resolve the promise with the results
    });
  });
};

//post reply
exports.getAllPostReplyDao = (postid) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT 
        p.id,
        p.replyStaffId,
        p.replyMessage, 
        p.createdAt, 
        u.firstName, 
        u.lastName,
        fs.firstName AS staffFirstName,
        fs.lastName AS staffLastName
      FROM publicforumreplies p 
      LEFT JOIN users u ON p.replyId = u.id
      LEFT JOIN farmstaff fs ON p.replyStaffId = fs.id
      WHERE p.chatId = ?`;
    const values = [parseInt(postid)];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length === 0) {
        return resolve(null);
      }

      resolve(results);
    });
  });
};

// replyDao.js
exports.getReplyCount = () => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT chatId, COUNT(id) AS replyCount FROM publicforumreplies GROUP BY chatId";

    plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Handle error in the promise
      }

      // Return the count result
      resolve(results);
    });
  });
};

exports.deleteReply = (id) => {
  const sql = "DELETE FROM publicforumreplies WHERE id = ?";

  return new Promise((resolve, reject) => {
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        reject("Error executing delete query: " + err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.shiftUpTaskIndexDao = (taskId, indexId) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE  cropcalendardays SET taskIndex = ? WHERE id = ?";
    const values = [indexId, taskId];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results[0]); // Resolve the promise with the first result
    });
  });
};

exports.getAllTaskIdDao = (cropId) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT id, taskIndex FROM cropcalendardays WHERE cropId = ?";
    const values = [cropId];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results); // No need to wrap in arrays, return results directly
    });
  });
};

exports.addNewTaskDao = (task, indexId, cropId) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO cropcalendardays ( cropId, taskIndex, days, taskTypeEnglish, taskTypeSinhala, taskTypeTamil, taskCategoryEnglish, taskCategorySinhala, taskCategoryTamil, taskEnglish, taskSinhala, taskTamil, taskDescriptionEnglish, taskDescriptionSinhala, taskDescriptionTamil, reqImages, imageLink, videoLinkEnglish, videoLinkSinhala, videoLinkTamil) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    const values = [
      cropId,
      indexId,
      task.days, // <-- use this instead of undefined 'days'
      task.taskTypeEnglish,
      task.taskTypeSinhala,
      task.taskTypeTamil,
      task.taskCategoryEnglish,
      task.taskCategorySinhala,
      task.taskCategoryTamil,
      task.taskEnglish,
      task.taskSinhala,
      task.taskTamil,
      task.taskDescriptionEnglish,
      task.taskDescriptionSinhala,
      task.taskDescriptionTamil,
      task.reqImages,
      task.imageLink,
      task.videoLinkEnglish,
      task.videoLinkSinhala,
      task.videoLinkTamil,
    ];

    if (values.length !== 20) {
      return reject(
        new Error("Mismatch between column count and value count.")
      );
    }

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.addNewReplyDao = (chatId, replyId, replyMessage) => {
  console.log("Dao Reply: ", replyMessage);

  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO publicforumreplies (chatId, replyMessage) VALUES (?, ?)";
    const values = [chatId, replyMessage];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        console.error("Error executing query:", err); // Improved error logging
        return reject(err);
      } else {
        // console.log("Insert successful:", results);
        resolve(results);
      }
    });
  });
};

exports.deletePublicForumPost = (id) => {
  const sql = "DELETE FROM publicforumposts WHERE id = ?";

  return new Promise((resolve, reject) => {
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        reject("Error executing delete query: " + err);
      } else {
        resolve(results);
      }
    });
  });
};

//User separate task
exports.shiftUpTaskIndexDaoU = (taskId, indexId) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE  slavecropcalendardays SET taskIndex = ? WHERE id = ?";
    const values = [indexId, taskId];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results[0]); // Resolve the promise with the first result
    });
  });
};

exports.getAllTaskIdDaoU = (cropId, userId) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT id, taskIndex FROM slavecropcalendardays WHERE cropCalendarId  = ? AND userId = ?";
    const values = [cropId, userId];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results); // No need to wrap in arrays, return results directly
    });
  });
};

exports.addNewTaskDaoU = (task, indexId, userId, cropId, onCulscropID) => {
  console.log("Dao Task: ", task);
  const defStatus = "Pending";

  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO slavecropcalendardays (userId, onCulscropID, cropCalendarId, taskIndex, days, taskTypeEnglish, taskTypeSinhala, taskTypeTamil, taskCategoryEnglish, taskCategorySinhala, taskCategoryTamil, taskEnglish, taskSinhala, taskTamil, taskDescriptionEnglish, taskDescriptionSinhala, taskDescriptionTamil, reqImages, imageLink, videoLinkEnglish, videoLinkSinhala, videoLinkTamil, status) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?)";

    const values = [
      userId,
      onCulscropID,
      cropId,
      indexId,
      task.startingDate,
      task.taskTypeEnglish,
      task.taskTypeSinhala,
      task.taskTypeTamil,
      task.taskCategoryEnglish,
      task.taskCategorySinhala,
      task.taskCategoryTamil,
      task.taskEnglish,
      task.taskSinhala,
      task.taskTamil,
      task.taskDescriptionEnglish,
      task.taskDescriptionSinhala,
      task.taskDescriptionTamil,
      task.reqImages,
      task.imageLink,
      task.videoLinkEnglish,
      task.videoLinkSinhala,
      task.videoLinkTamil,
      defStatus,
    ];

    // Ensure that the values array length matches the expected column count
    if (values.length !== 23) {
      return reject(
        new Error("Mismatch between column count and value count.")
      );
    }

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.insertUserXLSXDataaaaa = (data) => {
  console.log("testing 03");
  return new Promise((resolve, reject) => {
    console.log("testing 03");
    // Define validation schema
    const schema = Joi.object({
      "First Name": Joi.string().trim().min(2).max(50).required(),
      "Last Name": Joi.string().trim().min(2).max(50).required(),
      "Phone Number": Joi.alternatives()
        .try(
          Joi.string().pattern(/^\+94\d{9}$/),
          Joi.number().integer().min(94000000000).max(94999999999)
        )
        .required(),
      "NIC Number": Joi.alternatives()
        .try(
          Joi.string().pattern(/^(19\d{9}|\d{9}[vV])$/),
          Joi.number().integer().min(100000000000).max(1999999999999)
        )
        .required(),
      Membership: Joi.required(),
      District: Joi.required(),
    }).required();

    console.log("testing 01");

    // Validate all data
    // const validatedData = [];
    // for (let i = 0; i < data.length; i++) {
    //   console.log(data[i]);
    //   const { error, value } = schema.validate(data[i]);
    //   if (error) {
    //     return reject(
    //       new Error(
    //         `Validation error in row ${i + 1}: ${error.details[0].message}`
    //       )
    //     );
    //   }
    //   validatedData.push(value);
    // }

    const sql = `
      INSERT INTO users 
      (firstName, lastName, phoneNumber, NICnumber, membership, district) 
      VALUES ?`;

    const values = data.map((row) => [
      row["First Name"],
      row["Last Name"],
      String(row["Phone Number"]).startsWith("+")
        ? row["Phone Number"]
        : `+${row["Phone Number"]}`,
      String(row["NIC Number"]),
      row["Membership"],
      row["District"],
    ]);

    plantcare.query(sql, [values], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          message: "All data validated and inserted successfully",
          totalRows: data.length,
          insertedRows: result.affectedRows,
        });
      }
    });
  });
};

exports.getAllRoles = () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM adminroles";

    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results); // No need to wrap in arrays, return results directly
    });
  });
};

exports.getAllPosition = () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM adminposition";

    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results); // No need to wrap in arrays, return results directly
    });
  });
};

exports.deleteUserCropTask = (taskId) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM slavecropcalendardays WHERE id = ?";
    const values = [taskId];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.getAllUserTaskIdDao = (cropId, userId) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT id, taskIndex FROM slavecropcalendardays WHERE cropCalendarId = ? AND userId = ?";
    const values = [cropId, userId];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results); // No need to wrap in arrays, return results directly
    });
  });
};

exports.shiftUpUserTaskIndexDao = (taskId, indexId) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE  slavecropcalendardays SET taskIndex = ? WHERE id = ?";
    const values = [indexId, taskId];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results[0]); // Resolve the promise with the first result
    });
  });
};

exports.getPaymentSlipReportrrrr = (officerID) => {
  return new Promise((resolve, reject) => {
    const dataSql = `
      SELECT u.id, co.firstNameEnglish AS officerFirstName, co.lastNameEnglish AS officerLastName, u.firstName, u.lastName, u.NICnumber, SUM(gradeAprice)+SUM(gradeBprice)+SUM(gradeCprice) AS total
      FROM registeredfarmerpayments rp, plant_care.users u ,farmerpaymentscrops fpc, collectionofficer co
      WHERE rp.userId = u.id AND rp.id = fpc.registerFarmerId 
      GROUP BY u.id, co.firstNameEnglish, co.lastNameEnglish, u.firstName, u.lastName, u.NICnumber
    `;
    collectionofficer.query(dataSql, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

// exports.getPaymentSlipReport = (officerID, limit, offset) => {
//   return new Promise((resolve, reject) => {
//     // SQL query to count the total number of rows
//     const countSql = `
//       SELECT COUNT(*) AS total
//       FROM registeredfarmerpayments
//       WHERE collectionOfficerId = ?
//     `;

//     // SQL query to fetch paginated results
//     const dataSql = `
//       SELECT
//         rp.id,
//         u.id AS userId,
//         u.firstName,
//         u.lastName,
//         u.NICnumber,
//         co.firstNameEnglish AS officerFirstName,
//         co.lastNameEnglish AS officerLastName,
//         rp.createdAt
//       FROM
//         registeredfarmerpayments rp
//       JOIN
//         users u ON rp.userId = u.id
//       JOIN
//         collectionofficer co ON rp.collectionOfficerId = co.id
//       WHERE
//         rp.collectionOfficerId = ?
//       ORDER BY
//         rp.createdAt DESC
//       LIMIT ?
//       OFFSET ?
//     `;

//     // Execute the count query
//     db.query(countSql, [officerID], (countErr, countResults) => {
//       if (countErr) {
//         return reject(countErr);
//       }

//       const total = countResults[0].total;

//       // Execute the data query
//       db.query(dataSql, [officerID, limit, offset], (dataErr, dataResults) => {
//         if (dataErr) {
//           return reject(dataErr);
//         }

//         // Optional: Process each user's data (if needed)
//         const processedDataResults = dataResults.map((user) => {
//           return user;
//         });

//         // Resolve with total count and the processed results
//         resolve({
//           total: total,
//           items: processedDataResults,
//         });
//       });
//     });
//   });
// };

exports.getPaymentSlipReport = (
  officerID,
  limit,
  offset,
  date = null,
  search = null
) => {
  return new Promise((resolve, reject) => {
    // Base SQL queries
    let countSql = `
      SELECT COUNT(*) AS total 
      FROM registeredfarmerpayments rp 
      JOIN plant_care.users u ON rp.userId = u.id 
      WHERE rp.collectionOfficerId = ? 
    `;
    let dataSql = `
      SELECT 
          rp.id,
          u.id AS userId,
          u.firstName,
          u.lastName,
          u.NICnumber,
          co.firstNameEnglish AS officerFirstName,
          co.lastNameEnglish AS officerLastName,
          rp.invNo,
          rp.createdAt
      FROM 
          registeredfarmerpayments rp
      JOIN 
          plant_care.users u ON rp.userId = u.id
      JOIN 
          collectionofficer co ON rp.collectionOfficerId = co.id
      WHERE 
          rp.collectionOfficerId = ? 
    `;

    const params = [officerID];

    // Add date filter if provided
    if (date) {
      countSql += " AND DATE(rp.createdAt) = ?";
      dataSql += " AND DATE(rp.createdAt) = ?";
      params.push(date);
    }

    // Add search filter if provided
    if (search) {
      const searchQuery = `%${search}%`;
      countSql +=
        " AND (u.firstName LIKE ? OR u.lastName LIKE ? OR u.NICnumber LIKE ?)";
      dataSql +=
        " AND (u.firstName LIKE ? OR u.lastName LIKE ? OR u.NICnumber LIKE ?)";
      params.push(searchQuery, searchQuery, searchQuery);
    }

    // Add pagination parameters
    dataSql += " ORDER BY rp.createdAt DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    // Execute the count query
    collectionofficer.query(
      countSql,
      params.slice(0, params.length - 2),
      (countErr, countResults) => {
        if (countErr) {
          console.error("Error in count query:", countErr);
          return reject(countErr);
        }

        const total = countResults[0]?.total || 0;

        // Execute the data query
        collectionofficer.query(dataSql, params, (dataErr, dataResults) => {
          if (dataErr) {
            console.error("Error in data query:", dataErr);
            return reject(dataErr);
          }

          resolve({
            total: total,
            items: dataResults,
          });
        });
      }
    );
  });
};

exports.getFarmerListReport = (id) => {
  return new Promise((resolve, reject) => {
    const dataSql = `
      SELECT 
  rp.id,
  u.id AS userId,
  u.firstName,
  u.lastName,
  u.NICnumber,
  co.firstNameEnglish AS officerFirstName,
  co.lastNameEnglish AS officerLastName
FROM 
  registeredfarmerpayments rp
JOIN 
  plant_care.users u ON rp.userId = u.id
JOIN 
  collectionofficer co ON rp.collectionOfficerId = co.id
WHERE 
  rp.collectionOfficerId = ?
ORDER BY 
  rp.createdAt DESC
LIMIT 10 OFFSET 2;

    `;

    collectionofficer.query(dataSql, [id], (error, results) => {
      if (error) {
        return reject(error);
      }
      resolve(results);
    });
  });
};

exports.getFarmerCropListReport = (id) => {
  return new Promise((resolve, reject) => {
    const dataSql = `
SELECT 
  fp.id,
  cv.varietyNameEnglish,
  cg.cropNameEnglish,
  fp.gradeAprice,
  fp.gradeBprice,
  fp.gradeCprice,
  fp.gradeAquan,
  fp.gradeBquan,
  fp.gradeCquan
FROM 
  farmerpaymentscrops fp
JOIN 
  plant_care.cropvariety cv ON fp.cropId = cv.id
JOIN 
  plant_care.cropgroup cg ON cv.cropGroupId  = cg.id
WHERE 
  fp.registerFarmerId  = ?
    `;

    collectionofficer.query(dataSql, [id], (error, results) => {
      if (error) {
        return reject(error);
      }
      resolve(results);
    });
  });
};

exports.getFarmerCropListReportDate = (id) => {
  return new Promise((resolve, reject) => {
    const dataSql = `
SELECT 
  rfp.createdAt,
  rfp.invNo
FROM 
  registeredfarmerpayments rfp
WHERE 
  rfp.id  = ?
    `;

    collectionofficer.query(dataSql, [id], (error, results) => {
      if (error) {
        return reject(error);
      }
      resolve(results);
    });
  });
};

exports.getReportfarmerDetails = (userId) => {
  return new Promise((resolve, reject) => {
    const dataSql = `
      SELECT 
        u.id,
        u.firstName,
        u.lastName,
        u.phoneNumber,
        u.NICnumber,
        u.farmerQr,
        u.houseNo,
        u.streetName,
        u.city,
        ub.accNumber,
        ub.accHolderName,
        ub.bankName,
        ub.branchName
      FROM 
        users u
      LEFT JOIN 
        userbankdetails ub ON u.id = ub.userId 
      WHERE 
        u.id  = ?
    `;

    plantcare.query(dataSql, [userId], (error, results) => {
      if (error) {
        return reject(error);
      }

      if (results.length === 0) {
        return resolve(null); // No user found with the given ID
      }
      resolve(results[0]);
    });
  });
};

// exports.insertUserXLSXData = (data) => {
//   return new Promise(async (resolve, reject) => {
//     try {
//       const schema = Joi.object({
//         "First Name": Joi.string().trim().min(2).max(50).required(),
//         "Last Name": Joi.string().trim().min(2).max(50).required(),
//         "Phone Number": Joi.alternatives()
//           .try(
//             Joi.string().pattern(/^\+94\d{9}$/),
//             Joi.number().integer().min(94000000000).max(94999999999)
//           )
//           .required(),
//         "NIC Number": Joi.alternatives()
//           .try(
//             Joi.string(),
//             Joi.number().integer().min(10000000000).max(199999999999)
//           )
//           .required(),
//         Membership: Joi.required(),
//         District: Joi.required(),
//       }).required();

//       const validatedData = [];
//       const duplicateData = [];
//       const phoneSet = new Set();
//       const nicSet = new Set();

//       // Check for duplicates within the Excel file
//       for (let i = 0; i < data.length; i++) {
//         const { error, value } = schema.validate(data[i]);
//         if (error) {
//           reject(
//             new Error(
//               `Validation error in row ${i + 1}: ${error.details[0].message}`
//             )
//           );
//           return;
//         }

//         const phone = String(value["Phone Number"]);
//         const nic = String(value["NIC Number"]);

//         if (phoneSet.has(phone) || nicSet.has(nic)) {
//           duplicateData.push({
//             firstName: value["First Name"],
//             lastName: value["Last Name"],
//             phoneNumber: phone,
//             NICnumber: nic,
//           });
//         } else {
//           phoneSet.add(phone);
//           nicSet.add(nic);
//           validatedData.push(value);
//         }
//       }

//       // Database check for existing users
//       const phones = validatedData.map((row) =>
//         String(row["Phone Number"]).startsWith("+")
//           ? row["Phone Number"]
//           : `+${row["Phone Number"]}`
//       );
//       const nics = validatedData.map((row) => String(row["NIC Number"]));

//       const existingUsers = await new Promise((resolve, reject) => {
//         const sql = `
//           SELECT firstName, lastName, phoneNumber, NICnumber 
//           FROM users 
//           WHERE phoneNumber IN (?) OR NICnumber IN (?)
//         `;
//         plantcare.query(sql, [phones, nics], (err, results) => {
//           if (err) reject(err);
//           else resolve(results);
//         });
//       });

//       // Filter new users
//       const existingPhones = new Set(
//         existingUsers.map((user) => user.phoneNumber)
//       );
//       const existingNICs = new Set(existingUsers.map((user) => user.NICnumber));

//       const newUsers = validatedData.filter((user) => {
//         const phone = String(user["Phone Number"]);
//         const nic = String(user["NIC Number"]);
//         return !existingPhones.has(phone) && !existingNICs.has(nic);
//       });

//       if (newUsers.length > 0) {
//         const sql = `
//           INSERT INTO users 
//           (firstName, lastName, phoneNumber, NICnumber, membership, district) 
//           VALUES ?
//         `;
//         const values = newUsers.map((row) => [
//           row["First Name"],
//           row["Last Name"],
//           String(row["Phone Number"]).startsWith("+")
//             ? row["Phone Number"]
//             : `+${row["Phone Number"]}`,
//           String(row["NIC Number"]),
//           row["Membership"],
//           row["District"],
//         ]);

//         await new Promise((resolve, reject) => {
//           plantcare.query(sql, [values], (err, result) => {
//             if (err) reject(err);
//             else resolve(result);
//           });
//         });
//       }

//       resolve({
//         message: "Partial data inserted. Some users already exist.",
//         existingUsers,
//         duplicateData, // Duplicates within Excel
//         totalRows: data.length,
//         insertedRows: newUsers.length,
//       });
//     } catch (error) {
//       reject(error);
//     }
//   });
// };

exports.insertUserXLSXData = (data) => {
  return new Promise(async (resolve, reject) => {
    try {
      const schema = Joi.object({
        "First Name": Joi.string().trim().min(2).max(50),
        "Last Name": Joi.string().trim().min(2).max(50),
        "Phone Number": Joi.any()
          .required()
          .custom((value, helpers) => {
            const normalized = normalizeSLMobile(value);
           
            if (!normalized) {
              return helpers.error('any.invalid');
            }
          
            return normalized; // ✅ return normalized value
          })
          .messages({
            'any.invalid': 'Requried a Valid Phone Number, ex: +94XXXXXXXXXX, 94XXXXXXXXXX, 07XXXXXXXX, 7XXXXXXXX',
            'any.required': 'Phone Number is required'
          }),
        "NIC Number": Joi.alternatives()
          .try(
            Joi.string(),
            Joi.number().integer().min(10000000000).max(199999999999)
          ),
        Membership: Joi.optional(),
        District: Joi.optional(),
      }).required();

      const validatedData = [];
      const duplicateData = [];
      const emptyRows = [];
      const phoneSet = new Set();
      const nicSet = new Set();

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        // Check if all fields in the row are empty
        const isEmptyRow = 
          (!row["First Name"] || row["First Name"].toString().trim() === "") &&
          (!row["Last Name"] || row["Last Name"].toString().trim() === "") &&
          (!row["Phone Number"] || row["Phone Number"].toString().trim() === "") &&
          (!row["NIC Number"] || row["NIC Number"].toString().trim() === "") &&
          (!row["Membership"] || row["Membership"].toString().trim() === "") &&
          (!row["District"] || row["District"].toString().trim() === "");

        if (isEmptyRow) {
          emptyRows.push(i + 1); // Store row number (1-based index)
          continue; // Skip this empty row
        }

        const { error, value } = schema.validate(row);
        if (error) {
          reject(
            new Error(
              `Validation error in row ${i + 1}: ${error.details[0].message}`
            )
          );
          return;
        }

        // Convert values to string for comparison
        const phone = String(value["Phone Number"]).trim();
        const nic = String(value["NIC Number"]).trim();

        // Check for duplicates within the Excel file
        if (phoneSet.has(phone) || nicSet.has(nic)) {
          duplicateData.push({
            firstName: value["First Name"],
            lastName: value["Last Name"],
            phoneNumber: phone,
            NICnumber: nic,
            rowNumber: i + 1,
          });
        } else {
          phoneSet.add(phone);
          nicSet.add(nic);
          validatedData.push({
            ...value,
            rowNumber: i + 1
          });
        }
      }

      // If no valid data after skipping empties
      if (validatedData.length === 0) {
        resolve({
          message: "No valid data found. All rows were empty or contained duplicates.",
          emptyRows: emptyRows,
          duplicateData: duplicateData,
          totalRows: data.length,
          insertedRows: 0,
          skippedRows: emptyRows.length,
          duplicateRows: duplicateData.length
        });
        return;
      }

      // Database check for existing users
      const phones = validatedData.map((row) => {
        const phone = String(row["Phone Number"]).trim();
        return phone.startsWith("+") ? phone : `+${phone}`;
      });
      
      const nics = validatedData.map((row) => String(row["NIC Number"]).trim());

      const existingUsers = await new Promise((resolve, reject) => {
        const sql = `
          SELECT firstName, lastName, phoneNumber, NICnumber 
          FROM users 
          WHERE phoneNumber IN (?) OR NICnumber IN (?)
        `;
        plantcare.query(sql, [phones, nics], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      // Filter new users
      const existingPhones = new Set(
        existingUsers.map((user) => user.phoneNumber)
      );
      const existingNICs = new Set(existingUsers.map((user) => user.NICnumber));

      const newUsers = validatedData.filter((user) => {
        const phone = String(user["Phone Number"]).trim();
        const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;
        const nic = String(user["NIC Number"]).trim();
        return !existingPhones.has(formattedPhone) && !existingNICs.has(nic);
      });

      let insertedRows = 0;
      if (newUsers.length > 0) {
        const sql = `
          INSERT INTO users 
          (firstName, lastName, phoneNumber, NICnumber, membership, district) 
          VALUES ?
        `;
        // const values = newUsers.map((row) => [
        //   row["First Name"],
        //   row["Last Name"],
        //   String(row["Phone Number"]).trim().startsWith("+")
        //     ? String(row["Phone Number"]).trim()
        //     : `+${String(row["Phone Number"]).trim()}`,
        //   String(row["NIC Number"]).trim(),
        //   row["Membership"],
        //   row["District"],
        // ]);

        const values = newUsers.map((row) => [
          row["First Name"],
          row["Last Name"],
          normalizeSLMobile(row["Phone Number"]),
          String(row["NIC Number"]).trim(),
          row["Membership"],
          row["District"],
        ]);

        await new Promise((resolve, reject) => {
          plantcare.query(sql, [values], (err, result) => {
            if (err) reject(err);
            else {
              insertedRows = result.affectedRows || newUsers.length;
              resolve(result);
            }
          });
        });
      }

      resolve({
        message: newUsers.length > 0 
          ? "Data inserted successfully. Some users already exist or were duplicates." 
          : "No new users inserted. All users already exist in database or were duplicates.",
        existingUsers,
        duplicateData, // Duplicates within Excel
        emptyRows, // Empty rows that were skipped
        totalRows: data.length,
        insertedRows: insertedRows,
        skippedRows: emptyRows.length,
        duplicateRows: duplicateData.length,
        processedRows: validatedData.length
      });
    } catch (error) {
      reject(error);
    }
  });
};

function normalizeSLMobile(number) {
  if (!number) return null;

  let mobile = String(number).trim().replace(/\s|-/g, '');

  if (mobile.startsWith('+94') && mobile.length === 12) return mobile;
  if (mobile.startsWith('94') && mobile.length === 11) return `+${mobile}`;
  if (mobile.startsWith('0') && mobile.length === 10) return `+94${mobile.substring(1)}`;
  if (/^\d{9}$/.test(mobile)) return `+94${mobile}`;

  return null;
}

exports.getUserFeedbackDetails = (page, limit) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
          du.firstName,
          du.lastName,
          du.createdAt AS deletedUserCreatedAt,
          GROUP_CONCAT(fl.orderNumber ORDER BY fl.orderNumber ASC) AS orderNumbers,
          GROUP_CONCAT(fl.feedbackEnglish ORDER BY fl.orderNumber ASC) AS feedbacks
      FROM 
          userfeedback uf
      JOIN 
          deleteduser du ON uf.deletedUserId = du.id
      JOIN 
          feedbacklist fl ON uf.feedbackId = fl.id
      GROUP BY 
          du.firstName, du.lastName, du.createdAt
      ORDER BY 
          du.createdAt
    `;

    const params = [];

    // Apply pagination ONLY if limit is provided
    if (limit) {
      const limitInt = parseInt(limit, 10);
      const offsetInt = (parseInt(page, 10) - 1) * limitInt;

      sql += ` LIMIT ? OFFSET ?`;
      params.push(limitInt, offsetInt);
    }

    console.log("Executing SQL query:", sql);

    plantcare.query(sql, params, (err, results) => {
      if (err) {
        console.error("Error details:", err);
        return reject(
          new Error("An error occurred while fetching user feedback details")
        );
      }

      resolve(results);
    });
  });
};

exports.createFeedback = async (
  orderNumber,
  feedbackEnglish,
  feedbackSinahala,
  feedbackTamil
) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO feedbacklist (orderNumber, feedbackEnglish, feedbackSinahala, feedbackTamil) VALUES (?, ?, ?, ?)";
    const values = [
      orderNumber,
      feedbackEnglish,
      feedbackSinahala,
      feedbackTamil,
    ];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err); // Handle error in the promise
      }

      // Return the grouped result
      resolve(results);
    });
  });
};

exports.getNextOrderNumber = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT COALESCE(MAX(orderNumber), 0) + 1 AS nextOrderNumber
      FROM feedbacklist
    `;

    plantcare.query(query, (error, results) => {
      if (error) {
        return reject(error); // Handle error
      }

      resolve(results[0].nextOrderNumber); // Return the next order number
    });
  });
};

exports.getAllfeedackList = () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM feedbacklist ORDER BY orderNumber";

    plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results); // No need to wrap in arrays, return results directly
    });
  });
};

exports.getUserFeedbackCount = () => {
  return new Promise((resolve, reject) => {
    const sql = `
SELECT COUNT(DISTINCT deletedUserId) AS Total FROM userfeedback`;

    console.log("Executing full SQL query:", sql);

    plantcare.query(sql, (err, results) => {
      if (err) {
        console.error("Error details:", err); // Log the full error details
        return reject(
          new Error("An error occurred while fetching user feedback details")
        );
      }

      console.log("Query Results:", results); // Log the results for debugging
      resolve(results[0]); // Resolve the promise with the results
    });
  });
};

exports.getDeletedUserCount = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS Total FROM deleteduser`;

    console.log("Executing full SQL query:", sql);

    plantcare.query(sql, (err, results) => {
      if (err) {
        console.error("Error details:", err); // Log the full error details
        return reject(
          new Error("An error occurred while fetching deleted user count")
        );
      }

      console.log("Query Results:", results); // Log the results for debugging
      resolve(results[0]); // Resolve the promise with the results
    });
  });
};

exports.updateFeedbackOrder = async (feedbacks) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE feedbacklist SET orderNumber = ? WHERE id = ?";

    const queries = feedbacks.map((feedback) => {
      return new Promise((resolveInner, rejectInner) => {
        plantcare.query(
          sql,
          [feedback.orderNumber, feedback.id],
          (err, results) => {
            if (err) {
              return rejectInner(err);
            }
            resolveInner(results);
          }
        );
      });
    });
    Promise.all(queries)
      .then((results) => resolve(results))
      .catch((err) => reject(err));
  });
};

exports.getFeedbackById = async (feedbackId) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM feedbacklist WHERE id = ?";
    plantcare.query(sql, [feedbackId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0]);
    });
  });
};

exports.deleteFeedbackAndUpdateOrder = async (feedbackId, orderNumber) => {
  return new Promise((resolve, reject) => {
    const deleteSql = "DELETE FROM feedbacklist WHERE id = ?";
    const updateSql =
      "UPDATE feedbacklist SET orderNumber = orderNumber - 1 WHERE orderNumber > ?";

    plantcare.query(deleteSql, [feedbackId], (deleteErr, deleteResults) => {
      if (deleteErr) {
        return reject(deleteErr);
      }
      plantcare.query(updateSql, [orderNumber], (updateErr, updateResults) => {
        if (updateErr) {
          return reject(updateErr);
        }

        resolve({
          deleteResults,
          updateResults,
        });
      });
    });
  });
};

exports.getAllfeedackListForBarChart = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        fl.orderNumber,
        COUNT(uf.feedbackId) AS feedbackCount
      FROM 
        feedbacklist fl
      LEFT JOIN 
        userfeedback uf
      ON 
        fl.id = uf.feedbackId
      GROUP BY 
        fl.orderNumber
      ORDER BY 
        fl.orderNumber;
    `;

    plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }

      resolve(results);
    });
  });
};

exports.getMeById = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, mail, userName, role, position
      FROM adminusers
      WHERE id = ?`;

    admin.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else if (results.length === 0) {
        reject(new Error("User not found."));
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.activeUsers = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
     SELECT COUNT(*) AS active_users_count
      FROM users
      WHERE id = 'active'`;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.allUsers = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
     SELECT COUNT(*) AS all_farmer_count
      FROM users`;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.allUsersTillPreviousMonth = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
     SELECT COUNT(*) AS all_previous_month_farmer_count
      FROM users
      WHERE plant_care.users.created_at <= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)`;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.qrUsers = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
     SELECT COUNT(*) AS farmer_qr_count
      FROM users
      WHERE farmerQr IS NOT NULL AND farmerQr <> ''
      `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.qrUsersTillPreviousMonth = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
     SELECT COUNT(*) AS farmer_qr_count_previous_month
      FROM users
      WHERE created_at <= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
      AND farmerQr IS NOT NULL AND farmerQr <> ''
      `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.newUsers = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
     SELECT COUNT(*) AS new_users_count
      FROM users
      WHERE DATE(created_at) = CURRENT_DATE`;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.vegEnroll = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT COUNT(DISTINCT occ.id) AS veg_cultivation_count
    FROM ongoingcultivationscrops occ
    JOIN cropcalender cc ON occ.cropCalendar = cc.id
    JOIN cropvariety cv ON cc.cropVarietyId = cv.id
    JOIN cropgroup cg ON cv.cropGroupId = cg.id
    WHERE cg.category = 'Vegetables' ;
    `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.vegEnrollTillPreviousMonth = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT COUNT(DISTINCT occ.id) AS veg_cultivation_count_till_previous_month
    FROM ongoingcultivationscrops occ
    JOIN cropcalender cc ON occ.cropCalendar = cc.id
    JOIN cropvariety cv ON cc.cropVarietyId = cv.id
    JOIN cropgroup cg ON cv.cropGroupId = cg.id
    WHERE cg.category = 'Vegetables' AND occ.createdAt <= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
    `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.legumesEnroll = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT COUNT(DISTINCT occ.id) AS legumes_cultivation_count
    FROM ongoingcultivationscrops occ
    JOIN cropcalender cc ON occ.cropCalendar = cc.id
    JOIN cropvariety cv ON cc.cropVarietyId = cv.id
    JOIN cropgroup cg ON cv.cropGroupId = cg.id
    WHERE cg.category = 'Legumes' ;
    `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.legumesEnrollTillPreviousMonth = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT COUNT(DISTINCT occ.id) AS legumes_cultivation_count_till_previous_month
    FROM ongoingcultivationscrops occ
    JOIN cropcalender cc ON occ.cropCalendar = cc.id
    JOIN cropvariety cv ON cc.cropVarietyId = cv.id
    JOIN cropgroup cg ON cv.cropGroupId = cg.id
    WHERE cg.category = 'Legumes' AND occ.createdAt <= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
    `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.spicesEnroll = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT COUNT(DISTINCT occ.id) AS spices_cultivation_count
    FROM ongoingcultivationscrops occ
    JOIN cropcalender cc ON occ.cropCalendar = cc.id
    JOIN cropvariety cv ON cc.cropVarietyId = cv.id
    JOIN cropgroup cg ON cv.cropGroupId = cg.id
    WHERE cg.category = 'Spices' ;
    `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.spicesEnrollTillPreviousMonth = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT COUNT(DISTINCT occ.id) AS spices_cultivation_count_till_previous_month
    FROM ongoingcultivationscrops occ
    JOIN cropcalender cc ON occ.cropCalendar = cc.id
    JOIN cropvariety cv ON cc.cropVarietyId = cv.id
    JOIN cropgroup cg ON cv.cropGroupId = cg.id
    WHERE cg.category = 'Spices' AND occ.createdAt <= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
    `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.grainEnroll = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT COUNT(DISTINCT occ.id) AS grain_cultivation_count
    FROM ongoingcultivationscrops occ
    JOIN cropcalender cc ON occ.cropCalendar = cc.id
    JOIN cropvariety cv ON cc.cropVarietyId = cv.id
    JOIN cropgroup cg ON cv.cropGroupId = cg.id
    WHERE cg.category = 'Grain' ;
    `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.grainEnrollTillPreviousMonth = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT COUNT(DISTINCT occ.id) AS grain_cultivation_count_till_previous_month
    FROM ongoingcultivationscrops occ
    JOIN cropcalender cc ON occ.cropCalendar = cc.id
    JOIN cropvariety cv ON cc.cropVarietyId = cv.id
    JOIN cropgroup cg ON cv.cropGroupId = cg.id
    WHERE cg.category = 'Grain' AND occ.createdAt <= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) ;
    `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.fruitEnroll = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT COUNT(DISTINCT occ.id) AS fruit_cultivation_count
    FROM ongoingcultivationscrops occ
    JOIN cropcalender cc ON occ.cropCalendar = cc.id
    JOIN cropvariety cv ON cc.cropVarietyId = cv.id
    JOIN cropgroup cg ON cv.cropGroupId = cg.id
    WHERE cg.category = 'Fruit' ;
    `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.fruitEnrollTillPreviousMonth = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT COUNT(DISTINCT occ.id) AS fruit_cultivation_count_till_previous_month
    FROM ongoingcultivationscrops occ
    JOIN cropcalender cc ON occ.cropCalendar = cc.id
    JOIN cropvariety cv ON cc.cropVarietyId = cv.id
    JOIN cropgroup cg ON cv.cropGroupId = cg.id
    WHERE cg.category = 'Fruit' AND occ.createdAt <= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) ;
    `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.mushEnroll = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT COUNT(DISTINCT occ.id) AS mush_cultivation_count
    FROM ongoingcultivationscrops occ
    JOIN cropcalender cc ON occ.cropCalendar = cc.id
    JOIN cropvariety cv ON cc.cropVarietyId = cv.id
    JOIN cropgroup cg ON cv.cropGroupId = cg.id
    WHERE cg.category = 'Mushrooms' ;
    `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.getFarmerRegistrationCountsByDistrict = (district) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
          COUNT(CASE WHEN farmerQr IS NOT NULL THEN 1 END) AS registered_count,
          COUNT(CASE WHEN farmerQr IS NULL THEN 1 END) AS unregistered_count
      FROM 
          users
      WHERE 
          district = ?;
    `;

    plantcare.query(sql, [district], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};

exports.mushEnrollTillPreviousMonth = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT COUNT(DISTINCT occ.id) AS mush_cultivation_count_till_previous_month
    FROM ongoingcultivationscrops occ
    JOIN cropcalender cc ON occ.cropCalendar = cc.id
    JOIN cropvariety cv ON cc.cropVarietyId = cv.id
    JOIN cropgroup cg ON cv.cropGroupId = cg.id
    WHERE cg.category = 'Mushrooms' AND occ.createdAt <= DATE_SUB(CURDATE(), INTERVAL 1 MONTH);
    `;

    plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the user object
        resolve(results[0]);
      }
    });
  });
};

exports.updateAdminRoleById = (id, role, email) => {
  const sql = `UPDATE adminroles SET role = ?, email = ? WHERE id = ?`;
  return new Promise((resolve, reject) => {
    admin.query(sql, [role, email, id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.deleteOngoingCultivationsById = (id) => {
  const sql = `
    DELETE FROM ongoingcultivationscrops
    WHERE id = ? `;

  return new Promise((resolve, reject) => {
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        reject("Error deleting cultivation crops by ID: " + err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getFarmerStaffDao = (ownerId, role, searchText) => {
  const sqlParams = [ownerId];

  let sql = `
    SELECT
      f.id,
      f.firstName,
      f.lastName,
      f.phoneCode,
      f.phoneNumber,
      f.role,
      f.nic,
      f.image,
      f.modifyBy,
      a.userName AS modifiedByUserName
    FROM farmstaff f
    LEFT JOIN agro_world_admin.adminusers a
      ON f.modifyBy = a.id
    WHERE f.ownerId = ?
  `;

  if (searchText) {
    sql += ` AND (f.firstName LIKE ? OR f.lastName LIKE ? OR f.nic LIKE ? )`;
    const searchParam = `%${searchText}%`;
    console.log(searchParam);

    sqlParams.push(searchParam, searchParam, searchParam);
  }

  if (role) {
    sql += ` AND f.role = ?`;
    sqlParams.push(role);
  }

  return new Promise((resolve, reject) => {
    plantcare.query(sql, sqlParams, (err, results) => {
      if (err) {
        reject("Error fetching farm staff: " + err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getFarmOwnerByIdDao = (ownerId) => {
  const sql = `
    SELECT
      id,
      firstName,
      lastName,
      phoneCode,
      phoneNumber,
      nic,
      role
    
    FROM farmstaff
    WHERE id = ?
  `;

  return new Promise((resolve, reject) => {
    plantcare.query(sql, [ownerId], (err, results) => {
      if (err) {
        reject("Error fetching farm owner by ID: " + err);
      } else {
        // Return the first record (should only be one)
        resolve(results[0] || null);
      }
    });
  });
};

exports.updateFarmOwnerByIdDao = (ownerId, data, userId) => {
  const { firstName, lastName, phoneCode, phoneNumber, nic, role } = data;

  const sql = `
    UPDATE farmstaff
    SET
      firstName = ?,
      lastName = ?,
      phoneCode = ?,
      phoneNumber = ?,
      nic = ?,
      role = ?,
      modifyBy = ?
    WHERE id = ?
  `;

  const params = [
    firstName,
    lastName,
    phoneCode,
    phoneNumber,
    nic,
    role,
    userId,
    ownerId,
  ];

  return new Promise((resolve, reject) => {
    plantcare.query(sql, params, (err, results) => {
      if (err) {
        reject("Error updating farm owner: " + err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getUserFarmDetailsDao = (userId) => {
  const sqlParams = [userId];
  let sql = `
    SELECT
      u.id as userId,
      u.firstName,
      u.lastName,
      u.phoneNumber,
      u.NICnumber,
      u.profileImage,
      u.membership,
      u.activeStatus,
      u.houseNo,
      u.streetName,
      u.city as userCity,
      u.district as userDistrict,
      u.route,
      u.language,
      f.id as farmId,
      f.farmName,
      f.farmIndex,
      f.extentha,
      f.extentac,
      f.extentp,
      f.district as farmDistrict,
      f.plotNo,
      f.street as farmStreet,
      f.city as farmCity,
      f.staffCount,
      f.appUserCount,
      f.imageId,
      f.isBlock,
      f.createdAt as farmCreatedAt
    FROM users u
    LEFT JOIN farms f ON u.id = f.userId
    WHERE u.id = ?
    ORDER BY f.farmIndex, f.createdAt
  `;

  return new Promise((resolve, reject) => {
    plantcare.query(sql, sqlParams, (err, results) => {
      if (err) {
        reject("Error fetching user farm details: " + err);
      } else {
        // Structure the data: user info + array of farms
        const structuredData = {
          user: null,
          farms: [],
        };

        if (results.length > 0) {
          // Extract user info from first row (same for all rows)
          const firstRow = results[0];
          structuredData.user = {
            id: firstRow.userId,
            firstName: firstRow.firstName,
            lastName: firstRow.lastName,
            phoneNumber: firstRow.phoneNumber,
            NICnumber: firstRow.NICnumber,
            profileImage: firstRow.profileImage,
            membership: firstRow.membership,
            activeStatus: firstRow.activeStatus,
            houseNo: firstRow.houseNo,
            streetName: firstRow.streetName,
            city: firstRow.userCity,
            district: firstRow.userDistrict,
            route: firstRow.route,
            language: firstRow.language,
          };

          // Extract all farms
          results.forEach((row) => {
            if (row.farmId) {
              // Only add if farm exists
              structuredData.farms.push({
                id: row.farmId,
                farmName: row.farmName,
                farmIndex: row.farmIndex,
                extentha: row.extentha,
                extentac: row.extentac,
                extentp: row.extentp,
                district: row.farmDistrict,
                plotNo: row.plotNo,
                street: row.farmStreet,
                city: row.farmCity,
                staffCount: row.staffCount,
                appUserCount: row.appUserCount,
                imageId: row.imageId,
                isBlock: row.isBlock,
                createdAt: row.farmCreatedAt,
              });
            }
          });
        }

        resolve(structuredData);
      }
    });
  });
};

exports.deleteFarmDao = (farmId) => {
  return new Promise((resolve, reject) => {
    plantcare.query(
      `DELETE scd FROM slavecropcalendardays scd
       JOIN farmstaff fs ON scd.completedStaffId = fs.id
       WHERE fs.farmId = ?`,
      [farmId],
      (err) => {
        if (err) return reject(err);

        // Now delete farmstaff rows
        plantcare.query(
          `DELETE FROM farmstaff WHERE farmId = ?`,
          [farmId],
          (err) => {
            if (err) return reject(err);

            // Finally delete the farm
            plantcare.query(
              `DELETE FROM farms WHERE id = ?`,
              [farmId],
              (err, result) => {
                if (err) reject(err);
                else
                  resolve({
                    message: "Farm and related data deleted successfully",
                    affectedRows: result.affectedRows,
                  });
              }
            );
          }
        );
      }
    );
  });
};

exports.getAllFarmsWithCultivations = (userId, searchItem) => {
  return new Promise((resolve, reject) => {
    let params = [];
    let searchSql = "";

    if (searchItem) {
      searchSql = `
        AND (
          F.regCode LIKE ?
        )
      `;
      const searchQuery = `%${searchItem}%`;
      params.push(searchQuery);
    }

    if (userId) {
      searchSql += " AND U.id = ? ";
      params.push(userId);
    }

    const sql = `
      SELECT 
        F.id AS farmId,
        F.farmName,
        F.farmIndex,
        F.staffCount,
        F.district AS farmDistrict,
        F.createdAt AS farmCreatedAt,
        F.regCode,
        U.id AS userId,
        U.firstName,
        U.lastName,
        U.NICnumber,
        COUNT(DISTINCT OCC.id) AS cultivationCount,
        (F.extentac + F.extentha * 2.47105 + F.extentp / 160) AS area
      FROM farms F
      LEFT JOIN users U ON F.userId = U.id
      LEFT JOIN ongoingcultivations OC ON OC.userId = U.id
      LEFT JOIN ongoingcultivationscrops OCC 
        ON OCC.ongoingCultivationId = OC.id 
        AND OCC.farmId = F.id
      WHERE 1=1 ${searchSql}
      GROUP BY F.id, U.id
      ORDER BY F.createdAt DESC
    `;

    plantcare.query(sql, params, (err, results) => {
      if (err) return reject(err);

      const usersMap = {};
      results.forEach((row) => {
        if (!usersMap[row.userId]) {
          usersMap[row.userId] = {
            userId: row.userId,
            firstName: row.firstName,
            lastName: row.lastName,
            NICnumber: row.NICnumber,
            farms: [],
          };
        }

        usersMap[row.userId].farms.push({
          farmId: row.farmId,
          farmName: row.farmName,
          regCode: row.regCode,
          farmIndex: row.farmIndex,
          staffCount: row.staffCount,
          farmDistrict: row.farmDistrict,
          farmCreatedAt: row.farmCreatedAt,
          cultivationCount: row.cultivationCount,
          area: parseFloat(row.area).toFixed(2),
        });
      });

      resolve({
        totalUsers: Object.keys(usersMap).length,
        items: Object.values(usersMap),
      });
    });
  });
};

// // Delete a farm by farmId
// exports.deleteFarmById = (farmId) => {
//   return new Promise((resolve, reject) => {
//     if (!farmId) {
//       return reject(new Error("Farm ID is required"));
//     }

//     const sql = `DELETE FROM farms WHERE id = ?`;

//     plantcare.query(sql, [farmId], (err, result) => {
//       if (err) return reject(err);

//       if (result.affectedRows === 0) {
//         return resolve({
//           success: false,
//           message: "No farm found with the given ID",
//         });
//       }

//       resolve({ success: true, message: `Farm deleted successfully.` });
//     });
//   });
// };

exports.deleteFarmById = (farmId) => {
  return new Promise((resolve, reject) => {
    if (!farmId) {
      return reject(new Error("Farm ID is required"));
    }

    const deleteRelatedRecords = `
      DELETE scd 
      FROM slavecropcalendardays scd
      JOIN farmstaff fs ON scd.completedStaffId = fs.id
      WHERE fs.farmId = ?;
    `;

    const deleteFarmStaff = `DELETE FROM farmstaff WHERE farmId = ?;`;
    const deleteFarm = `DELETE FROM farms WHERE id = ?;`;

    // ✅ Get a connection from the pool
    plantcare.getConnection((err, connection) => {
      if (err) return reject(err);

      // ✅ Begin transaction
      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          return reject(err);
        }

        connection.query(deleteRelatedRecords, [farmId], (err) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              reject(err);
            });
          }

          connection.query(deleteFarmStaff, [farmId], (err) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                reject(err);
              });
            }

            connection.query(deleteFarm, [farmId], (err, result) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  reject(err);
                });
              }

              connection.commit((err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    reject(err);
                  });
                }

                connection.release();

                if (result.affectedRows === 0) {
                  return resolve({
                    success: false,
                    message: "No farm found with the given ID",
                  });
                }

                resolve({
                  success: true,
                  message: "Farm deleted successfully.",
                });
              });
            });
          });
        });
      });
    });
  });
};

exports.tracktaskAddOngoingCultivation = (userId, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE ongoingcultivationscrops
      SET modifyBy = ?
      WHERE id = ?
    `;

    const values = [userId, id];

    // Ensure that the values array length matches the expected column count

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// Find admin by email
exports.findAdminByEmail = (email) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM adminusers WHERE mail = ?";
    admin.query(sql, [email], (err, results) => {
      if (err) reject(err);
      else resolve(results[0]);
    });
  });
};

// Find admin by ID
exports.findAdminById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM adminusers WHERE id = ?";
    admin.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results[0] || null);
    });
  });
};

// Create or replace password reset token
exports.createPasswordResetToken = (userId, token, expiresAt) => {
  return new Promise((resolve, reject) => {
    // Always delete existing token first
    const deleteSql = "DELETE FROM adminresetpasswordtoken WHERE userId = ?";
    admin.query(deleteSql, [userId], (delErr) => {
      if (delErr) return reject(delErr);

      const insertSql = `
        INSERT INTO adminresetpasswordtoken (userId, resetPasswordToken, resetPasswordExpires) 
        VALUES (?, ?, ?)
      `;
      admin.query(insertSql, [userId, token, expiresAt], (insErr) => {
        if (insErr) return reject(insErr);
        resolve(token);
      });
    });
  });
};

// Verify reset token
exports.verifyResetToken = (token) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT u.mail, t.resetPasswordExpires, t.userId 
                 FROM adminresetpasswordtoken t 
                 JOIN adminusers u ON t.userId = u.id 
                 WHERE t.resetPasswordToken = ?`;
    admin.query(sql, [token], (err, results) => {
      if (err) return reject(err);
      if (results.length === 0) return resolve(null);

      const tokenData = results[0];
      const now = new Date();
      if (now > new Date(tokenData.resetPasswordExpires)) return resolve(null);

      resolve({ email: tokenData.mail, userId: tokenData.userId });
    });
  });
};

// Reset password
exports.resetPassword = (userId, newPassword) => {
  return new Promise(async (resolve, reject) => {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const updateSql = "UPDATE adminusers SET password = ? WHERE id = ?";
      admin.query(updateSql, [hashedPassword, userId], (updateErr) => {
        if (updateErr) return reject(updateErr);

        const deleteSql =
          "DELETE FROM adminresetpasswordtoken WHERE userId = ?";
        admin.query(deleteSql, [userId], (delErr) => {
          if (delErr) return reject(delErr);
          resolve(true);
        });
      });
    } catch (hashErr) {
      reject(hashErr);
    }
  });
};

// Find reset token (ignores expiry - for resend flow)
exports.findResetToken = (token) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM adminresetpasswordtoken 
      WHERE resetPasswordToken = ?
    `;
    admin.query(sql, [token], (err, results) => {
      if (err) return reject(err);
      resolve(results[0] || null);
    });
  });
};

// Delete reset token for user
exports.deletePasswordResetToken = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM adminresetpasswordtoken WHERE userId = ?";
    admin.query(sql, [userId], (err, result) => {
      if (err) return reject(err);
      resolve(result.affectedRows > 0);
    });
  });
};

// Reset password and clear token
exports.resetPassword = (userId, newPassword) => {
  return new Promise(async (resolve, reject) => {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const updateSql = "UPDATE adminusers SET password = ? WHERE id = ?";
      admin.query(updateSql, [hashedPassword, userId], (updateErr) => {
        if (updateErr) return reject(updateErr);

        const deleteSql =
          "DELETE FROM adminresetpasswordtoken WHERE userId = ?";
        admin.query(deleteSql, [userId], (delErr) => {
          if (delErr) return reject(delErr);
          resolve(true);
        });
      });
    } catch (err) {
      reject(err);
    }
  });
};

exports.GetCompaniesDAO = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, companyName 
      FROM feildcompany
    `;
    plantcare.query(sql, [], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.GetAllManagerList = () => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT id, empId, firstName, lastName FROM feildofficer WHERE JobRole = 'Chief Field Officer' AND status = 'Approved'";

    plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getForCreateId = (role) => {
  console.log("role", role);
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT empId FROM feildofficer WHERE empId LIKE ? ORDER BY empId DESC LIMIT 1";

    // Replace 'your_database_connection' with your actual DB connection variable
    plantcare.query(sql, [`${role}%`], (err, results) => {
      if (err) {
        return reject(err);
      }

      let newEmpId;

      if (results.length > 0) {
        const numericPart = parseInt(results[0].empId.substring(3), 10);
        const incrementedValue = numericPart + 1;
        newEmpId = `${role}${incrementedValue.toString().padStart(5, "0")}`;
      } else {
        // If no records found, start with 00001
        newEmpId = `${role}00001`;
      }

      resolve({ empId: newEmpId });
    });
  });
};

exports.checkNICExist = async (nic, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT COUNT(*) as count FROM feildofficer WHERE nic = ?`;
    const params = [nic];
    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }
    plantcare.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results[0].count > 0);
    });
  });
};

exports.checkEmailExist = async (email, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT COUNT(*) as count FROM feildofficer WHERE email = ?`;
    const params = [email];
    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }
    plantcare.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results[0].count > 0);
    });
  });
};

exports.checkPhoneNumberExist = async (phoneNumber, excludeId = null) => {
  console.log("officer", excludeId);
  return new Promise((resolve, reject) => {
    let sql = `SELECT COUNT(*) as count 
               FROM feildofficer 
               WHERE (phoneNumber1 = ? OR phoneNumber2 = ?)`;
    const params = [phoneNumber, phoneNumber];
    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }
    plantcare.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results[0].count > 0);
    });
  });
};

exports.getFOIDforCreateEmpIdDao = (employee) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT empId 
      FROM feildofficer
      WHERE jobRole = ?
      ORDER BY 
        CAST(SUBSTRING(empId FROM 4) AS UNSIGNED) DESC
      LIMIT 1
    `;
    const values = [employee];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length === 0) {
        if (employee === "Field Officer") {
          return resolve("FIO00001");
        } else if (employee === "Chief Field Officer") {
          return resolve("CFO00001");
        }
        // ✅ FIXED: Removed the strange character and added proper return
        return resolve(null);
      }

      const highestId = results[0].empId;

      // Extract the numeric part
      const prefix = highestId.substring(0, 3); // Get "FIO" or "CFO"
      const numberStr = highestId.substring(3); // Get "00007"
      const number = parseInt(numberStr, 10); // Convert to number 7

      // Increment and format back to 5 digits
      const nextNumber = number + 1;
      const nextId = `${prefix}${nextNumber.toString().padStart(5, "0")}`; // "FIO00008" or "CFO00008"

      resolve(nextId);
    });
  });
};

// exports.createFieldOfficer = (
//   officerData,
//   profileImageUrl,
//   nicFrontUrl,
//   nicBackUrl,
//   passbookUrl,
//   contractUrl,
//   lastId
// ) => {
//   return new Promise((resolve, reject) => {
//     try {
//       // If no image URLs, set them to null
//       const profileUrl = profileImageUrl || null;
//       const frontNicUrl = nicFrontUrl || null;
//       const backNicUrl = nicBackUrl || null;
//       const backPassbookUrl = passbookUrl || null;
//       const contractUrlValue = contractUrl || null;

//       const sql = `
//                 INSERT INTO feildofficer (
//                     companyId, irmId, firstName, lastName, empType, empId, jobRole,
//                     phoneCode1, phoneNumber1, phoneCode2, phoneNumber2, language, email,
//                     nic, house, street, city, distrct, province, country, comAmount,
//                     accName, accNumber, bank, branch, profile, frontNic, backNic,
//                     backPassbook, contract, assignDistrict, status
//                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
//             `;

//       // Replace 'db' with your actual database connection variable
//       plantcare.query(
//         sql,
//         [
//           officerData.companyId,
//           officerData.irmId,
//           officerData.firstName,
//           officerData.lastName,
//           officerData.empType,
//           lastId,
//           officerData.jobRole,
//           officerData.phoneCode1,
//           officerData.phoneNumber1,
//           officerData.phoneCode2,
//           officerData.phoneNumber2,
//           officerData.language,
//           officerData.email,
//           officerData.nic,
//           officerData.house,
//           officerData.street,
//           officerData.city,
//           officerData.distrct,
//           officerData.province,
//           officerData.country,
//           officerData.comAmount,
//           officerData.accName,
//           officerData.accNumber,
//           officerData.bank,
//           officerData.branch,
//           profileUrl,
//           frontNicUrl,
//           backNicUrl,
//           backPassbookUrl,
//           contractUrlValue,
//           officerData.assignDistrict,
//           "Not Aproved",
//         ],
//         (err, results) => {
//           if (err) {
//             console.log(err);
//             return reject(err); // Reject promise if an error occurs
//           }
//           resolve(results); // Resolve the promise with the query results
//         }
//       );
//     } catch (error) {
//       reject(error); // Reject if any error occurs
//     }
//   });
// };

exports.createFieldOfficer = (
  officerData,
  profileImageUrl,
  nicFrontUrl,
  nicBackUrl,
  passbookUrl,
  contractUrl,
  lastId
) => {
  return new Promise((resolve, reject) => {
    try {
      // If no image URLs, set them to null
      const profileUrl = profileImageUrl || null;
      const frontNicUrl = nicFrontUrl || null;
      const backNicUrl = nicBackUrl || null;
      const backPassbookUrl = passbookUrl || null;
      const contractUrlValue = contractUrl || null;

      const sql = `
                INSERT INTO feildofficer (irmId, firstName, lastName, firstNameSinhala, firstNameTamil, lastNameSinhala,  
                     lastNameTamil, empType, empId, jobRole, 
                    phoneCode1, phoneNumber1, phoneCode2, phoneNumber2, language, email, 
                    nic, house, street, city, distrct, province, country, comAmount, 
                    accName, accNumber, bank, branch, profile, frontNic, backNic, 
                    backPassbook, contract, assignDistrict, status
                ) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;

      // Replace 'db' with your actual database connection variable
      plantcare.query(
        sql,
        [
          officerData.irmId,
          officerData.firstName,
          officerData.lastName,
          officerData.firstNameSinhala,
          officerData.firstNameTamil,
          officerData.lastNameSinhala,
          officerData.lastNameTamil,
          officerData.empType,
          lastId,
          officerData.jobRole,
          officerData.phoneCode1,
          officerData.phoneNumber1,
          officerData.phoneCode2,
          officerData.phoneNumber2,
          officerData.language,
          officerData.email,
          officerData.nic,
          officerData.house,
          officerData.street,
          officerData.city,
          officerData.distrct,
          officerData.province,
          officerData.country,
          officerData.comAmount,
          officerData.accName,
          officerData.accNumber,
          officerData.bank,
          officerData.branch,
          profileUrl,
          frontNicUrl,
          backNicUrl,
          backPassbookUrl,
          contractUrlValue,
          officerData.assignDistrict,
          "Not Approved",
        ],
        (err, results) => {
          if (err) {
            console.log(err);
            return reject(err); // Reject promise if an error occurs
          }
          resolve(results); // Resolve the promise with the query results
        }
      );
    } catch (error) {
      reject(error); // Reject if any error occurs
    }
  });
};

exports.getFieldOfficerByIdDAO = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
          SELECT 
              FO.*
          FROM 
              feildofficer FO
          WHERE 
              FO.id = ?`;

    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      if (results.length === 0) {
        return resolve(null); // No officer found
      }

      const officer = results[0];

      const assignDistrictsArray = officer.assignDistrict
        ? officer.assignDistrict.split(",").map((d) => d.trim())
        : [];
      resolve({
        fieldOfficer: {
          id: officer.id,
          firstName: officer.firstName,
          lastName: officer.lastName,
          firstNameSinhala: officer.firstNameSinhala,
          firstNameTamil: officer.firstNameTamil,
          lastNameSinhala: officer.lastNameSinhala,
          lastNameTamil: officer.lastNameTamil,
          phoneNumber01: officer.phoneNumber1,
          phoneNumber02: officer.phoneNumber2,
          phoneCode01: officer.phoneCode1,
          phoneCode02: officer.phoneCode2,
          image: officer.profile,
          frontNic: officer.frontNic,
          backNic: officer.backNic,
          backPassbook: officer.backPassbook,
          contract: officer.contract,
          status: officer.status,
          nic: officer.nic,
          email: officer.email,
          houseNumber: officer.house,
          streetName: officer.street,
          city: officer.city,
          district: officer.distrct,
          province: officer.province,
          country: officer.country,
          empId: officer.empId,
          jobRole: officer.JobRole,
          employeeType: officer.empType,
          accHolderName: officer.accName,
          accNumber: officer.accNumber,
          bankName: officer.bank,
          branchName: officer.branch,
          companyName: officer.companyName,
          assignDistricts: assignDistrictsArray,
          comAmount: officer.comAmount,
          language: officer.language,
          irmId: officer.irmId,
        },
      });
    });
  });
};

exports.getFieldOfficerImages = (id) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT profile, frontNic, backNic, backPassbook, contract  FROM plant_care.feildofficer WHERE id = ?";
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0]);
    });
  });
};

exports.DeleteFieldOfficerDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
            DELETE FROM plant_care.feildofficer
            WHERE id = ?
        `;
    collectionofficer.query(sql, [parseInt(id)], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.updateFieldOfficer = (
  officerId,
  officerData,
  profileImageUrl,
  nicFrontUrl,
  nicBackUrl,
  passbookUrl,
  contractUrl,
  tokenUserId
) => {
  return new Promise((resolve, reject) => {
    try {
      // Build dynamic SQL query based on provided fields
      let sql = `UPDATE feildofficer SET `;
      const values = [];
      const updates = [];

      // Add all non-image fields
      const fields = [
        'irmId', 'firstName', 'lastName', 'firstNameSinhala', 'firstNameTamil',
        'lastNameSinhala', 'lastNameTamil', 'empType', 'jobRole', 'phoneCode1',
        'phoneNumber1', 'phoneCode2', 'phoneNumber2', 'language', 'email', 'nic',
        'house', 'street', 'city', 'distrct', 'province', 'country', 'comAmount',
        'accName', 'accNumber', 'bank', 'branch', 'assignDistrict', 'status', 'modifyBy'
      ];

      fields.forEach(field => {
        if (officerData[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(officerData[field]);
        }
      });

      // Only update image fields if new URLs are provided
      if (profileImageUrl !== undefined) {
        updates.push('profile = ?');
        values.push(profileImageUrl);
      }

      if (nicFrontUrl !== undefined) {
        updates.push('frontNic = ?');
        values.push(nicFrontUrl);
      }

      if (nicBackUrl !== undefined) {
        updates.push('backNic = ?');
        values.push(nicBackUrl);
      }

      if (passbookUrl !== undefined) {
        updates.push('backPassbook = ?');
        values.push(passbookUrl);
      }

      if (contractUrl !== undefined) {
        updates.push('contract = ?');
        values.push(contractUrl);
      }

      // Add WHERE condition
      sql += updates.join(', ') + ' WHERE id = ?';
      values.push(officerId);

      console.log('Update SQL:', sql);
      console.log('Update values:', values);

      plantcare.query(sql, values, (err, results) => {
        if (err) {
          console.log(err);
          return reject(err);
        }
        resolve(results);
      });
    } catch (error) {
      reject(error);
    }
  });
};

exports.deleteFarmStaffDao = async (id) => {
  return new Promise((resolve, reject) => {
    let sql = `
      DELETE FROM farmstaff
      WHERE id = ?
    `;

    plantcare.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

exports.addFarmerQRCodeDao = async (qrcode, id) => {
  return new Promise((resolve, reject) => {
    let sql = `
      UPDATE users
      SET farmerQr = ?
      WHERE id = ?
    `;

    plantcare.query(sql, [qrcode, id], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

exports.GetAllFiealdofficerComplainDAO = (
  page,
  limit,
  status,
  category,
  comCategory,
  searchText,
  rpstatus
) => {
  return new Promise((resolve, reject) => {
    const Sqlparams = [];
    const Counterparams = [];
    const offset = (page - 1) * limit;

    // SQL to count total records - Updated with adminusers join
    let countSql = `
      SELECT COUNT(*) AS total
      FROM feildofficercomplains fc
      LEFT JOIN feildofficer fo ON fc.officerId = fo.id
      LEFT JOIN agro_world_admin.complaincategory cc ON fc.complainCategory = cc.id
      LEFT JOIN agro_world_admin.adminroles ar ON cc.roleId = ar.id
      LEFT JOIN agro_world_admin.adminusers au ON fc.adminReplyBy = au.id
      WHERE 1=1
    `;

    // SQL to fetch paginated data - Updated with adminusers join
    let sql = `
      SELECT 
        fc.id, 
        fc.refNo,
        fo.empId AS empId,
        CONCAT(fo.firstName, ' ', fo.lastName) AS officerName,
        CONCAT(fo.firstNameSinhala, ' ', fo.lastNameSinhala) AS officerNameSinhala,
        CONCAT(fo.firstNameTamil, ' ', fo.lastNameTamil) AS officerNameTamil,
        cc.categoryEnglish AS complainCategory,
        CONCAT(fo2.firstName, ' ', fo2.lastName) AS replyOfficerName,
        fc.createdAt,
        fc.complain,
        fc.status ,
        fc.reply,
        fc.language,
        au.userName AS adminReplyByName
      FROM feildofficercomplains fc
      LEFT JOIN feildofficer fo ON fc.officerId = fo.id
      LEFT JOIN agro_world_admin.complaincategory cc ON fc.complainCategory = cc.id
      LEFT JOIN feildofficer fo2 ON cc.roleId = fo2.id
      LEFT JOIN agro_world_admin.adminusers au ON fc.adminReplyBy = au.id
      WHERE 1=1
    `;

    // Add filter for status
    if (status) {
      if (status === "Assigned") {
        countSql += " AND fc.status = ? ";
        sql += " AND fc.status = ? ";
        Sqlparams.push('Opened');
        Counterparams.push('Opened');
      } else if (status === "Closed") {
        countSql += " AND fc.status = ? ";
        sql += " AND fc.status = ? ";
        Sqlparams.push('Closed');
        Counterparams.push('Closed');
      }
    }

    // Fixed category filter to use the correct alias
    if (category) {
      countSql += " AND ar.role = ? ";
      sql += " AND ar.role = ? ";
      Sqlparams.push(category);
      Counterparams.push(category);
    }

    if (comCategory) {
      countSql += " AND fc.complainCategory = ? ";
      sql += " AND fc.complainCategory = ? ";
      Sqlparams.push(comCategory);
      Counterparams.push(comCategory);
    }

    // Add search functionality - ONLY for empId
    if (searchText) {
      countSql += " AND fo.empId LIKE ? ";
      sql += " AND fo.empId LIKE ? ";
      const searchQuery = `%${searchText}%`;
      Sqlparams.push(searchQuery);
      Counterparams.push(searchQuery);
    }

    if (rpstatus) {
      if (rpstatus === "Yes") {
        countSql += " AND fc.reply IS NOT NULL ";
        sql += " AND fc.reply IS NOT NULL ";
      } else {
        countSql += " AND fc.reply IS NULL ";
        sql += " AND fc.reply IS NULL ";
      }
    }

    // Add pagination
    sql += " ORDER BY fc.createdAt DESC LIMIT ? OFFSET ?";
    Sqlparams.push(parseInt(limit), parseInt(offset));

    // Execute count query to get total records
    plantcare.query(countSql, Counterparams, (countErr, countResults) => {
      if (countErr) {
        return reject(countErr);
      }

      const total = countResults[0]?.total || 0;

      // Execute main query to get paginated results
      plantcare.query(sql, Sqlparams, (dataErr, results) => {
        if (dataErr) {
          return reject(dataErr);
        }

        resolve({ results, total });
      });
    });
  });
};

exports.getFiealdOfficerComplainById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = ` 
    SELECT 
      foc.id, 
      foc.refNo, 
      foc.createdAt, 
      foc.language, 
      foc.complain, 
      foc.complainCategory, 
      foc.reply, 
      fo.firstName AS firstName, 
      fo.lastName AS lastName, 
      fo.phoneCode1 AS phoneCode01, 
      fo.phoneNumber1 AS phoneNumber01,  
      cc.categoryEnglish AS complainCategory, 
      fo.empId AS empId, 
      fo.JobRole AS jobRole,
      CONCAT(fo.firstName, ' ', fo.lastName) AS officerName,
      CONCAT(fo.firstNameSinhala, ' ', fo.lastNameSinhala) AS officerNameSinhala,
      CONCAT(fo.firstNameTamil, ' ', fo.lastNameTamil) AS officerNameTamil
    FROM feildofficercomplains foc
    LEFT JOIN feildofficer fo ON foc.officerId = fo.id
    LEFT JOIN agro_world_admin.complaincategory cc ON foc.complainCategory = cc.id
    WHERE foc.id = ? 
    `;
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};


exports.trackUserTaskUpdateDao = (id, adminId) => {
  return new Promise((resolve, reject) => {
    const sql =
      `
      UPDATE slavecropcalendardays scd
      JOIN plant_care.ongoingcultivationscrops occ ON scd.onCulscropID = occ.id
      SET occ.modifyBy = ?
      WHERE scd.id = ?
      `;

    plantcare.query(sql, [adminId, id], (err, results) => {
      if (err) {
        return reject(err); // Handle error in the promise
      }

      // Return the count result
      resolve(results);
    });
  });
};

exports.getFarmerPensionDetailsDao = (page, limit, searchText) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let countSql = `
      SELECT COUNT(*) AS total
      FROM pensionrequest
      WHERE reqStatus = 'Approved'
    `;

    let dataSql = `
      SELECT 
        pr.id,
        pr.fullName,
        pr.nic,
        CONCAT(u.firstName, ' ', u.lastName) AS farmerFullName,
        u.phoneNumber,
        pr.dob,
        pr.sucType,
        pr.sucNic,
        pr.sucdob,
        pr.defaultPension,
        pr.reqStatus,
        au.userName AS approveBy,
        pr.approveTime,
        pr.createdAt
      FROM pensionrequest pr
      LEFT JOIN agro_world_admin.adminusers au ON pr.approveBy = au.id
      LEFT JOIN users u ON pr.userId = u.id
      WHERE pr.reqStatus = 'Approved'
    `;

    const countParams = [];
    const dataParams = [];

    if (searchText && searchText.trim() !== "") {
      const cond = ` AND nic LIKE ? `;
      countSql += cond;
      dataSql += cond;

      const pattern = `%${searchText}%`;
      countParams.push(pattern);
      dataParams.push(pattern);
    }

    dataSql += ` ORDER BY pr.approveTime DESC LIMIT ? OFFSET ?`;
    dataParams.push(parseInt(limit), parseInt(offset));

    plantcare.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) return reject(countErr);

      plantcare.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) return reject(dataErr);

        resolve({
          total: countResults[0].total,
          items: dataResults,
        });
      });
    });
  });
};

exports.getCultivationForPensionDao = (id) => {
  return new Promise((resolve, reject) => {
    let sql = `
     SELECT
        oc.id AS ongoingCultivationId,
        cv.varietyNameEnglish,
        cg.cropNameEnglish,
        (occ.extentac + occ.extentha * 2.47105 +  occ.extentp / 160 )  AS extentac,
        (SELECT COUNT(*) FROM slavecropcalendardays scd1 WHERE scd1.onCulscropID = occ.id) AS totalTasks,
        (SELECT COUNT(*) FROM slavecropcalendardays scd2 WHERE scd2.onCulscropID = occ.id AND scd2.status = 'completed') AS completedTasks,
        occ.createdAt
      FROM ongoingcultivations oc
      INNER JOIN ongoingcultivationscrops occ ON oc.id = occ.ongoingCultivationId
      LEFT JOIN cropcalender cc ON occ.cropCalendar = cc.id
      LEFT JOIN cropvariety cv ON cc.cropVarietyId = cv.id
      LEFT JOIN cropgroup cg ON cv.cropGroupId = cg.id
      WHERE oc.userId = ?
    `;

    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};