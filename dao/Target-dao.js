const {
  plantcare,
  collectionofficer,
  marketPlace,
} = require("../startup/database");

// exports.getSavedCenterCropsDao = (id, date, state, searchText) => {
//   return new Promise((resolve, reject) => {
//     let dataSql = `
//           SELECT
//               CG.cropNameEnglish,
//               CV.varietyNameEnglish,
//               DT.grade,
//               DT.target,
//               DT.id,
//               CC.varietyId
//           FROM
//               centercrops CC
//           LEFT JOIN
//               dailytarget DT ON CC.companyCenterId = DT.companyCenterId AND CC.varietyId = DT.varietyId

//       `;

//     const dataParams = [];

//     if (state) {
//       const dateParam = new Date(date).toISOString().split("T")[0];
//       dataSql += ` AND DT.date = ? `;
//       dataParams.push(dateParam);
//     } else {
//       const dateParam = new Date(date).toISOString().split("T")[0];
//       dataSql += `AND DT.date != ? `;
//       dataParams.push(dateParam);
//     }

//     dataSql += `
//           JOIN
//               plant_care.cropvariety CV ON CC.varietyId = CV.id
//           JOIN
//               plant_care.cropgroup CG ON CV.cropGroupId = CG.id
//           WHERE
//               CC.companyCenterId = ?
//       `;
//     dataParams.push(id);

//     if (searchText) {
//       dataSql += ` AND (CG.cropNameEnglish LIKE ? OR CV.varietyNameEnglish LIKE ?) `;
//       dataParams.push(`%${searchText}%`, `%${searchText}%`);
//     }

//     dataSql += `
//           ORDER BY
//               CG.cropNameEnglish ASC, CV.varietyNameEnglish ASC

//       `;

//     collectionofficer.query(dataSql, dataParams, (err, results) => {
//       if (err) {
//         return reject(err);
//       }

//       if (results.length === 0 && state) {
//         this.getSavedCenterCropsDao(id, date, false, searchText)
//           .then(resolve) // Resolve with the result from the recursive call
//           .catch(reject); // Reject with any error from the recursive call
//       } else {
//         const aggregatedResults = {};

//         results.forEach((row) => {
//           const key = `${row.cropNameEnglish}|${row.varietyNameEnglish}`;

//           if (!aggregatedResults[key]) {
//             aggregatedResults[key] = {
//               cropNameEnglish: row.cropNameEnglish,
//               varietyNameEnglish: row.varietyNameEnglish,
//               varietyId: row.varietyId,
//               targetA: 0,
//               targetB: 0,
//               targetC: 0,
//               idA: null,
//               idB: null,
//               idC: null,
//             };
//           }

//           if (row.grade === "A") {
//             aggregatedResults[key].targetA = parseFloat(row.target);
//             aggregatedResults[key].idA = row.id;
//           } else if (row.grade === "B") {
//             aggregatedResults[key].targetB = parseFloat(row.target);
//             aggregatedResults[key].idB = row.id;
//           } else if (row.grade === "C") {
//             aggregatedResults[key].targetC = parseFloat(row.target);
//             aggregatedResults[key].idC = row.id;
//           }
//         });

//         const finalResults = Object.values(aggregatedResults);

//         // Check if ALL crops have ALL null IDs (completely new)
//         const isNew = finalResults.every(
//           (item) => item.idA === null && item.idB === null && item.idC === null
//         );

//         resolve({ data: finalResults, isNew });
//       }
//     });
//   });
// };

exports.getSavedCenterCropsDao = (id, date, state, searchText) => {
  return new Promise((resolve, reject) => {
    if (!date) {
      return resolve({ data: [], isNew: true, latestAssignBy: null });
    }
    let dataSql = `
      SELECT 
          CG.cropNameEnglish, 
          CV.varietyNameEnglish,
          DT.grade,
          DT.target,
          DT.id,
          CC.varietyId,
          DT.assignBy,
          DT.assignTime
      FROM 
          centercrops CC
      LEFT JOIN 
          dailytarget DT ON CC.companyCenterId = DT.companyCenterId AND CC.varietyId = DT.varietyId
      `;

    const dataParams = [];

    if (state) {
      console.log('date', date)
      dataSql += ` AND DATE(DT.date) = ? `;
      dataParams.push(date);
    } else {
      dataSql += ` AND DATE(DT.date) != ? `;
      dataParams.push(date);
    }

    dataSql += `
      JOIN 
          plant_care.cropvariety CV ON CC.varietyId = CV.id
      JOIN 
          plant_care.cropgroup CG ON CV.cropGroupId = CG.id
      WHERE 
          CC.companyCenterId = ? 
      `;
    dataParams.push(id);

    if (searchText) {
      dataSql += ` AND (CG.cropNameEnglish LIKE ? OR CV.varietyNameEnglish LIKE ?) `;
      dataParams.push(`%${searchText}%`, `%${searchText}%`);
    }

    dataSql += `
      ORDER BY
          CG.cropNameEnglish ASC, CV.varietyNameEnglish ASC
      `;

    collectionofficer.query(dataSql, dataParams, (err, results) => {
      if (err) {
        return reject(err);
      }

      let latestAssignTime;
      let latestAssignBy
      if (results.length > 0) {
        // Sort by assignTime descending (latest first)
        results.sort((a, b) => new Date(b.assignTime) - new Date(a.assignTime));
      
        // Get the latest item's assignBy and assignTime
        latestAssignBy = results[0].assignBy;
        latestAssignTime = results[0].assignTime;
      
        console.log("Latest assignBy:", latestAssignBy);
        console.log("Latest assignTime:", latestAssignTime);
      }
      

        const aggregatedResults = {};

        results.forEach((row) => {
          const key = `${row.cropNameEnglish}|${row.varietyNameEnglish}`;

          if (!aggregatedResults[key]) {
            aggregatedResults[key] = {
              cropNameEnglish: row.cropNameEnglish,
              varietyNameEnglish: row.varietyNameEnglish,
              varietyId: row.varietyId,
              targetA: 0,
              targetB: 0,
              targetC: 0,
              idA: null,
              idB: null,
              idC: null,
            };
          }

          if (row.grade === "A") {
            aggregatedResults[key].targetA = parseFloat(row.target);
            aggregatedResults[key].idA = row.id;
          } else if (row.grade === "B") {
            aggregatedResults[key].targetB = parseFloat(row.target);
            aggregatedResults[key].idB = row.id;
          } else if (row.grade === "C") {
            aggregatedResults[key].targetC = parseFloat(row.target);
            aggregatedResults[key].idC = row.id;
          }
        });

        const finalResults = Object.values(aggregatedResults);
        const isNew = finalResults.every(
          (item) => item.idA === null && item.idB === null && item.idC === null
        );

        resolve({ data: finalResults, isNew, latestAssignBy });

    });
  });
};

exports.updateCenterTargeQtyDao = (id, qty) => {
  return new Promise((resolve, reject) => {
    let dataSql = `
         UPDATE dailytarget 
         SET target = ?, assignStatus = 0
         WHERE id = ?
      `;
    const dataParams = [qty, id];
    collectionofficer.query(dataSql, dataParams, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.addNewCenterTargetDao = (
  companyCenterId,
  varietyId,
  grade,
  target,
  date
) => {
  return new Promise((resolve, reject) => {
    let dataSql = `
         INSERT INTO dailytarget (companyCenterId, varietyId, grade, target,complete, date, assignStatus)
         VALUES (?, ?, ?, ?, ?, ?, 0)
      `;

    const dateParam = new Date(date).toISOString().split("T")[0];

    const dataParams = [
      companyCenterId,
      varietyId,
      grade,
      target,
      0,
      dateParam,
    ];
    collectionofficer.query(dataSql, dataParams, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

// exports.getCompanyCenterIDDao = (companyId, centerId) => {
//   return new Promise((resolve, reject) => {
//     console.log(
//       `Looking for companyCenter with companyId: ${companyId}, centerId: ${centerId}`
//     );
//     let dataSql = `
//           SELECT id FROM companycenter WHERE companyId = ? AND centerId = ?
//       `;
//     const dataParams = [companyId, centerId];
//     collectionofficer.query(dataSql, dataParams, (err, results) => {
//       if (err) {
//         return reject(err);
//       }
//       if (results.length === 0) {
//         return resolve(null);
//       }
//       resolve(results[0].id);
//     });
//   });
// };

exports.getCompanyCenterIDDao = (companyId, centerId) => {
  return new Promise((resolve, reject) => {
    console.log(
      `Looking for companyCenter with companyId: ${companyId}, centerId: ${centerId}`
    ); // Add this line

    let dataSql = `
      SELECT id FROM companycenter WHERE companyId = ? AND centerId = ?
    `;
    const dataParams = [companyId, centerId];

    collectionofficer.query(dataSql, dataParams, (err, results) => {
      if (err) {
        console.error("Error in getCompanyCenterIDDao:", err); // Better error logging
        return reject(err);
      }

      console.log("Query results:", results); // Log the results

      if (results.length === 0) {
        console.warn(
          `No companyCenter found for companyId: ${companyId}, centerId: ${centerId}`
        );
        return resolve(null);
      }
      resolve(results[0].id);
    });
  });
};

exports.getCenterCenterCropsDao = (
  companyCenterId,
  page,
  limit,
  searchText
) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    const countParams = [companyCenterId];
    const dataParams = [companyCenterId, companyCenterId]; // Ensures correct parameter order

    let countSql = `
          SELECT COUNT(DISTINCT CV.id) AS total
          FROM marketprice MP
          JOIN marketpriceserve MPS ON MPS.marketPriceId = MP.id
          JOIN plant_care.cropvariety CV ON MP.varietyId = CV.id
          JOIN plant_care.cropgroup CG ON CV.cropGroupId = CG.id
          WHERE MPS.companyCenterId = ?
      `;

    let dataSql = `
          SELECT 
              CG.cropNameEnglish, 
              CV.varietyNameEnglish, 
              CV.id AS cropId, 
              CASE 
                  WHEN EXISTS (
                      SELECT 1
                      FROM centercrops
                      WHERE companyCenterId = ? AND varietyId = CV.id
                  ) THEN 1 
                  ELSE 0 
              END AS isAssign
          FROM 
              marketprice MP
              JOIN marketpriceserve MPS ON MPS.marketPriceId = MP.id
              JOIN plant_care.cropvariety CV ON MP.varietyId = CV.id
              JOIN plant_care.cropgroup CG ON CV.cropGroupId = CG.id
          WHERE 
              MPS.companyCenterId = ?
          
      `;

    if (searchText) {
      dataSql += ` AND (CG.cropNameEnglish LIKE ? OR CV.varietyNameEnglish LIKE ?) `;
      countSql += ` AND (CG.cropNameEnglish LIKE ? OR CV.varietyNameEnglish LIKE ?) `;
      dataParams.push(`%${searchText}%`, `%${searchText}%`);
      countParams.push(`%${searchText}%`, `%${searchText}%`);
    }

    dataSql += ` 
          GROUP BY 
                  CG.cropNameEnglish, 
                  CV.varietyNameEnglish,
                  CV.id
              ORDER BY 
                  CG.cropNameEnglish ASC, 
                  CV.varietyNameEnglish ASC 
              LIMIT ? OFFSET ?
      `;
    dataParams.push(limit, offset);

    collectionofficer.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults.length > 0 ? countResults[0].total : 0;

      // Execute data query
      collectionofficer.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }

        resolve({ items: dataResults, total });
      });
    });
  });
};

exports.addCenterCropsDao = (companyCenterId, cropId) => {
  return new Promise((resolve, reject) => {
    let dataSql = `
          INSERT INTO centercrops (companyCenterId, varietyId)
          VALUES (?, ?)
      `;
    const dataParams = [companyCenterId, cropId];
    collectionofficer.query(dataSql, dataParams, (err, results) => {
      if (err) {
        return reject(err);
      }

      resolve(results);
    });
  });
};

exports.removeCenterCropsDao = (companyCenterId, cropId) => {
  return new Promise((resolve, reject) => {
    let dataSql = `
         DELETE FROM centercrops
         WHERE companyCenterId = ? AND varietyId = ?
      `;
    const dataParams = [companyCenterId, cropId];
    collectionofficer.query(dataSql, dataParams, (err, results) => {
      if (err) {
        return reject(err);
      }

      resolve(results);
    });
  });
};

exports.getOfficerData = (assignBy) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT firstNameEnglish, lastNameEnglish 
            FROM collection_officer.collectionofficer
            WHERE id = ? 
        `;
    const values = [assignBy];

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};


exports.getOfficerTargetDao = (userId, status, search) => {
    return new Promise((resolve, reject) => {
        let sql =
            `SELECT 
            OFT.id, 
            OFT.dailyTargetId, 
            DT.varietyId, 
            CV.varietyNameEnglish, 
            CG.cropNameEnglish, 
            OFT.target, 
            DT.grade, 
            OFT.complete, 
            CO.empId,
            DT.date AS toDate,
            CASE 
                WHEN OFT.target > OFT.complete THEN 'Pending'
                WHEN OFT.target < OFT.complete THEN 'Exceeded'
                WHEN OFT.target = OFT.complete THEN 'Completed'
            END AS status,
            CASE 
                WHEN OFT.complete > OFT.target THEN 0.00
                ELSE OFT.target - OFT.complete
            END AS remaining
        FROM dailytarget DT, officertarget OFT, plant_care.cropgroup CG, plant_care.cropvariety CV, collectionofficer CO
        WHERE OFT.officerId = ? AND OFT.dailyTargetId = DT.id AND DT.varietyId = CV.id AND CV.cropGroupId = CG.id AND OFT.officerId = CO.id
    `;

        const params = [userId];

        if (status) {
            sql += ` AND (
                CASE 
                    WHEN OFT.target > OFT.complete THEN 'Pending'
                    WHEN OFT.target < OFT.complete THEN 'Exceeded'
                    WHEN OFT.target = OFT.complete THEN 'Completed'
                END
            ) = ?`;
            params.push(status);
        }

        if (search) {
            sql += ` AND (CV.varietyNameEnglish LIKE ? OR CG.cropNameEnglish LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        collectionofficer.query(sql, params, (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};


exports.getCenterCropsDao = (id) => {
    return new Promise((resolve, reject) => {
        const sql = `

                SELECT cv.id, cv.varietyNameEnglish
                FROM collection_officer.centercrops cc
                INNER JOIN plant_care.cropvariety cv
                    ON cc.varietyId = cv.id
                WHERE cc.companyCenterId = ?

        `;

        collectionofficer.query(sql, [id], (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};

// Aggregates yesterday's dailytarget across ALL company centers, per varietyId,
// so the caller can work out what was left unassigned/uncompleted from that day.
exports.getVarietyTargetBacklogDao = (date) => {
    return new Promise((resolve, reject) => {
        const dateParam = new Date(date).toISOString().split('T')[0];
        const sql = `
                SELECT
                    varietyId,
                    SUM(target) AS assignedTarget,
                    SUM(complete) AS completedAmount
                FROM dailytarget
                WHERE DATE(date) = ?
                GROUP BY varietyId
        `;

        collectionofficer.query(sql, [dateParam], (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};

// This center's own dailytarget rows for the exact date, grouped by variety
// into per-grade targets/ids so the frontend can edit what's already assigned.
exports.getCenterAssignedTargetsDao = (companyCenterId, date) => {
    return new Promise((resolve, reject) => {
        const dateParam = new Date(date).toISOString().split('T')[0];
        const sql = `
                SELECT dt.id, dt.grade, dt.target, dt.varietyId, co.firstNameEnglish, co.lastNameEnglish
                FROM dailytarget dt
                LEFT JOIN collectionofficer co ON dt.assignBy = co.id
                WHERE companyCenterId = ? AND DATE(date) = ?
        `;

        collectionofficer.query(sql, [companyCenterId, dateParam], (err, results) => {
            if (err) {
                return reject(err);
            }

            const grouped = {};
            results.forEach(row => {
                if (!grouped[row.varietyId]) {
                    grouped[row.varietyId] = {
                        varietyId: row.varietyId,
                        targetA: 0,
                        targetB: 0,
                        targetC: 0,
                        idA: null,
                        idB: null,
                        idC: null
                    };
                }

                if (row.grade === 'A') {
                    grouped[row.varietyId].targetA = parseFloat(row.target);
                    grouped[row.varietyId].idA = row.id;
                } else if (row.grade === 'B') {
                    grouped[row.varietyId].targetB = parseFloat(row.target);
                    grouped[row.varietyId].idB = row.id;
                } else if (row.grade === 'C') {
                    grouped[row.varietyId].targetC = parseFloat(row.target);
                    grouped[row.varietyId].idC = row.id;
                }
            });

            // The assigning officer is the same for every row assigned in one batch, so just take it from the first row.
            const officerName = results.length > 0
                ? [results[0].firstNameEnglish, results[0].lastNameEnglish].filter(Boolean).join(' ') || null
                : null;

            resolve({ grouped, officerName });
        });
    });
};

exports.getAllRequestedItemsDao = (date) => {
    console.log('date', date)
  return new Promise((resolve, reject) => {
    const queryParams = [];

    let whereClause = ` 
    WHERE po.status = 'Processing' 
    AND (op.id IS NOT NULL OR oai.id IS NOT NULL)
    `;

    // Add conditions for district if provided
    if (date) {
      whereClause += ` AND DATE(o.sheduleDate) = ?`;
      queryParams.push(date);
    }

    let dataSql = `
      SELECT
      po.id AS processOrderId,
      po.invNo,
      po.status,
      o.id AS orderId,
      o.centerId,
      o.isPackage,
      o.sheduleDate,
      oh.city AS houseCity,
      oa.city AS apartmentCity,
      -- Package-level grouping (when packages exist)
      CASE
          WHEN COUNT(DISTINCT op.id) > 0 THEN (
              SELECT JSON_ARRAYAGG(
                  JSON_OBJECT(
                      'orderPackageId', op2.id,
                      'packageId', op2.packageId,
                      'packingStatus', op2.packingStatus,
                      'packageQty', op2.qty,
                      'items', (
                          SELECT JSON_ARRAYAGG(
                              JSON_OBJECT(
                                  'productId', opi2.productId,
                                  'varietyId', cv1.id,
                                  'qty', opi2.qty,
                                  'productName', mpi1.displayName,
                                  'unitType','Kg',
                                  'varietyNameEnglish', cv1.varietyNameEnglish,
                                  'cropNameEnglish', cg1.cropNameEnglish
                              )
                          )
                          FROM market_place.orderpackageitems opi2 
                          LEFT JOIN market_place.marketplaceitems mpi1 ON opi2.productId = mpi1.id 
                          LEFT JOIN plant_care.cropvariety cv1 ON mpi1.varietyId = cv1.id 
                          LEFT JOIN plant_care.cropgroup cg1 ON cv1.cropGroupId = cg1.id 
                          WHERE opi2.orderPackageId = op2.id
                      )
                  )
              )
              FROM market_place.orderpackage op2
              WHERE op2.orderId = po.id AND op2.packingStatus = 'Dispatch'
          )
          ELSE NULL
      END AS packageDetails,
      -- Additional items (aggregated by order)
      CASE
          WHEN COUNT(DISTINCT oai.id) > 0 THEN (
              SELECT JSON_ARRAYAGG(
                  JSON_OBJECT(
                      'productId', oai2.productId,
                      'varietyId', cv2.id,
                      'qty', oai2.qty,
                      'productName', mpi2.displayName,
                      'unitType', oai2.unit,
                      'varietyNameEnglish', cv2.varietyNameEnglish,
                      'cropNameEnglish', cg2.cropNameEnglish
                  )
              )
              FROM market_place.orderadditionalitems oai2
              LEFT JOIN market_place.marketplaceitems mpi2 ON oai2.productId = mpi2.id 
              LEFT JOIN plant_care.cropvariety cv2 ON mpi2.varietyId = cv2.id
              LEFT JOIN plant_care.cropgroup cg2 ON cv2.cropGroupId = cg2.id 
              WHERE oai2.orderId = o.id
          )
          ELSE NULL
      END AS additionalItems
  FROM market_place.processorders po
  LEFT JOIN market_place.orders o ON po.orderId = o.id
  LEFT JOIN market_place.orderpackage op ON op.orderId = po.id AND op.packingStatus = 'Dispatch'
  LEFT JOIN market_place.orderadditionalitems oai ON oai.orderId = o.id
  LEFT JOIN market_place.orderhouse oh ON oh.orderId = o.id
  LEFT JOIN market_place.orderapartment oa ON oa.orderId = o.id
  ${whereClause}
  GROUP BY po.id, po.invNo, po.status, o.id, o.centerId, o.isPackage, o.sheduleDate, oh.city, oa.city
      `;

    collectionofficer.query(dataSql, queryParams, (dataErr, dataResults) => {
      if (dataErr) {
        console.error('Error in data query:', dataErr);
        return reject(dataErr);
      }
      resolve(dataResults);
    });
  });
};