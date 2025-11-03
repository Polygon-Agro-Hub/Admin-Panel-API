const { json } = require("body-parser");
const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
  dash,
} = require("../startup/database");

// exports.getRecievedOrdersQuantity = (page, limit, filterType, date, search) => {
//   return new Promise((resolve, reject) => {
//     const offset = (page - 1) * limit;

//     // Base query
//     let baseJoinSql = `
//       FROM market_place.processorders po
//       JOIN market_place.orders o ON po.orderId = o.id
//       JOIN market_place.orderpackage op ON op.orderId = po.id
//       JOIN market_place.orderadditionalitems oai ON oai.orderId = o.id
//       JOIN market_place.marketplaceitems mpi ON oai.productId = mpi.id
//       JOIN plant_care.cropvariety cv ON mpi.varietyId = cv.id
//       JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
//     `;

//     let whereSql = ` WHERE 1=1 `;
//     const queryParams = [];

//     // Apply filterType + date
//     if (filterType && date) {
//       switch (filterType) {
//         case "OrderDate":
//           whereSql += ` AND DATE(o.createdAt) = ?`;
//           queryParams.push(date);
//           break;
//         case "scheduleDate":
//           whereSql += ` AND DATE(o.sheduleDate) = ?`;
//           queryParams.push(date);
//           break;
//         case "toCollectionCenter":
//           whereSql += ` AND DATE(DATE_SUB(o.sheduleDate, INTERVAL 2 DAY)) = ?`;
//           queryParams.push(date);
//           break;
//         case "toDispatchCenter":
//           whereSql += ` AND DATE(DATE_SUB(o.sheduleDate, INTERVAL 1 DAY)) = ?`;
//           queryParams.push(date);
//           break;
//       }
//     }

//     // Apply search on crop and variety name
//     if (search) {
//       whereSql += ` AND (cv.varietyNameEnglish LIKE ? OR cg.cropNameEnglish LIKE ?)`;
//       const likeSearch = `%${search}%`;
//       queryParams.push(likeSearch, likeSearch);
//     }

//     // Count Query
//     const countSql = `SELECT COUNT(DISTINCT CONCAT(cg.cropNameEnglish, cv.varietyNameEnglish)) AS total ${baseJoinSql} ${whereSql}`;

//     // Data Query - Modified to properly handle GROUP BY
//     let dataSql = `
//       SELECT 
//         po.createdAt,
//         o.sheduleDate,
//         ROUND(
//           SUM(
//             CASE 
//               WHEN oai.unit = 'g' THEN oai.qty / 1000
//               ELSE oai.qty 
//             END
//           ), 3
//         ) AS quantity,
//         cg.cropNameEnglish, 
//         cv.varietyNameEnglish,
//         MAX(DATE_SUB(o.sheduleDate, INTERVAL 2 DAY)) AS toCollectionCentre,
//         MAX(DATE_SUB(o.sheduleDate, INTERVAL 1 DAY)) AS toDispatchCenter
//       ${baseJoinSql}
//       ${whereSql}
//       GROUP BY cg.cropNameEnglish, cv.varietyNameEnglish, po.createdAt, o.sheduleDate
//       ORDER BY MAX(o.createdAt) DESC, cg.cropNameEnglish ASC, cv.varietyNameEnglish ASC
//       LIMIT ? OFFSET ?
//     `;

//     const dataParams = [...queryParams, Number(limit), Number(offset)];

//     // Execute count query
//     marketPlace.query(countSql, queryParams, (countErr, countResults) => {
//       if (countErr) {
//         console.error("Error in count query:", countErr);
//         return reject(countErr);
//       }

//       const total = countResults[0].total;

//       // Execute data query
//       marketPlace.query(dataSql, dataParams, (dataErr, dataResults) => {
//         if (dataErr) {
//           console.error("Error in data query:", dataErr);
//           return reject(dataErr);
//         }

//         // Process results
//         const processedResults = dataResults.map(item => ({
//           ...item,
//           quantity: parseFloat(item.quantity),
//           orderIds: item.orderIds ? item.orderIds.split(',') : [],
//           productIds: item.productIds ? item.productIds.split(',') : []
//         }));

//         resolve({ items: processedResults, total });
//       });
//     });
//   });
// };

exports.getRecievedOrdersQuantity = (page, limit, filterType, date, search) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let baseJoinSql = `
      FROM market_place.processorders po
      JOIN market_place.orders o ON po.orderId = o.id
      JOIN market_place.orderpackage op ON op.orderId = po.id
      JOIN market_place.orderadditionalitems oai ON oai.orderId = o.id
      JOIN market_place.marketplaceitems mpi ON oai.productId = mpi.id
      JOIN plant_care.cropvariety cv ON mpi.varietyId = cv.id
      JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
    `;

    let whereSql = ` WHERE 1=1 `;

    // ✅ Correct filter: only processing orders from `processorders` table
    whereSql += ` AND po.status = 'processing'`;

    const queryParams = [];

    if (filterType && date) {
      switch (filterType) {
        case "OrderDate":
          whereSql += ` AND DATE(o.createdAt) = ?`;
          queryParams.push(date);
          break;
        case "scheduleDate":
          whereSql += ` AND DATE(o.sheduleDate) = ?`;
          queryParams.push(date);
          break;
        case "toCollectionCenter":
          whereSql += ` AND DATE(DATE_SUB(o.sheduleDate, INTERVAL 2 DAY)) = ?`;
          queryParams.push(date);
          break;
        case "toDispatchCenter":
          whereSql += ` AND DATE(DATE_SUB(o.sheduleDate, INTERVAL 1 DAY)) = ?`;
          queryParams.push(date);
          break;
      }
    }

    if (search) {
      whereSql += ` AND (cv.varietyNameEnglish LIKE ? OR cg.cropNameEnglish LIKE ?)`;
      const likeSearch = `%${search}%`;
      queryParams.push(likeSearch, likeSearch);
    }

    // Count Query
    const countSql = `
      SELECT COUNT(*) AS total FROM (
        SELECT 1
        ${baseJoinSql}
        ${whereSql}
        GROUP BY 
          cg.cropNameEnglish, 
          cv.varietyNameEnglish, 
          DATE(po.createdAt), 
          DATE(o.sheduleDate)
      ) AS grouped
    `;

    // Data Query
    const dataSql = `
      SELECT 
        DATE(po.createdAt) AS createdAt,
        DATE(o.sheduleDate) AS sheduleDate,
        ROUND(
          SUM(
            CASE 
              WHEN oai.unit = 'g' THEN oai.qty / 1000
              ELSE oai.qty 
            END
          ), 3
        ) AS quantity,
        cg.cropNameEnglish, 
        cv.varietyNameEnglish,
        MAX(DATE_SUB(o.sheduleDate, INTERVAL 2 DAY)) AS toCollectionCentre,
        MAX(DATE_SUB(o.sheduleDate, INTERVAL 1 DAY)) AS toDispatchCenter
      ${baseJoinSql}
      ${whereSql}
      GROUP BY 
        cg.cropNameEnglish, 
        cv.varietyNameEnglish, 
        DATE(po.createdAt), 
        DATE(o.sheduleDate)
      ORDER BY 
        MAX(o.createdAt) DESC, 
        cg.cropNameEnglish ASC, 
        cv.varietyNameEnglish ASC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...queryParams, Number(limit), Number(offset)];

    marketPlace.query(countSql, queryParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      marketPlace.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }

        const processedResults = dataResults.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity),
        }));

        resolve({ items: processedResults, total });
      });
    });
  });
};


exports.DownloadRecievedOrdersQuantity = (filterType, date, search) => {
  return new Promise((resolve, reject) => {
    // Base join SQL
    let baseJoinSql = `
      FROM market_place.orderpackage op 
      JOIN market_place.orders o ON op.orderId = o.id
      JOIN market_place.orderadditionalitems oai ON oai.orderId = o.id
      JOIN market_place.marketplaceitems mpi ON oai.productId = mpi.id
      JOIN plant_care.cropvariety cv ON mpi.varietyId = cv.id
      JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
    `;

    // Where clause
    let whereSql = ` WHERE 1=1 `;
    const queryParams = [];

    // Apply date filters
    if (filterType && date) {
      switch (filterType) {
        case "OrderDate":
          whereSql += ` AND DATE(o.createdAt) = ?`;
          queryParams.push(date);
          break;
        case "scheduleDate":
          whereSql += ` AND DATE(o.sheduleDate) = ?`;
          queryParams.push(date);
          break;
        case "toCollectionCenter":
          whereSql += ` AND DATE(DATE_SUB(o.sheduleDate, INTERVAL 2 DAY)) = ?`;
          queryParams.push(date);
          break;
        case "toDispatchCenter":
          whereSql += ` AND DATE(DATE_SUB(o.sheduleDate, INTERVAL 1 DAY)) = ?`;
          queryParams.push(date);
          break;
      }
    }

    // Apply search
    if (search) {
      whereSql += ` AND (cv.varietyNameEnglish LIKE ? OR cg.cropNameEnglish LIKE ?)`;
      const likeSearch = `%${search}%`;
      queryParams.push(likeSearch, likeSearch);
    }

    // Final data query without LIMIT/OFFSET and with ORDER BY
    const dataSql = `
      SELECT 
        o.createdAt, 
        o.sheduleDate AS scheduleDate,
        oai.productId, 
        ROUND(
          CASE 
            WHEN oai.unit = 'g' THEN oai.qty / 1000
            ELSE oai.qty 
          END, 3
        ) AS quantity,
        oai.unit,
        cg.cropNameEnglish, 
        cv.varietyNameEnglish,
        DATE_SUB(o.sheduleDate, INTERVAL 2 DAY) AS toCollectionCenter,
        DATE_SUB(o.sheduleDate, INTERVAL 1 DAY) AS toDispatchCenter
      ${baseJoinSql}
      ${whereSql}
      ORDER BY o.createdAt DESC, cg.cropNameEnglish ASC, cv.varietyNameEnglish ASC
    `;

    // Execute query
    marketPlace.query(dataSql, queryParams, (err, results) => {
      if (err) {
        console.error("Error fetching data for Excel:", err);
        return reject(err);
      }

      results.forEach((item) => {
        item.quantity = parseFloat(item.quantity.toString()); // This removes trailing zeros
      });

      resolve({ items: results });
    });
  });
};


// exports.getAllOrdersWithProcessInfo = (
//   page,
//   limit,
//   statusFilter,
//   dateFilter,
//   dateFilter1,
//   searchText
// ) => {
//   return new Promise((resolve, reject) => {
//     const offset = (page - 1) * limit;
//     const params = [];
//     const countParams = [];

//     let dataSql = `
//          SELECT 
//           o.fullTotal AS total,
//           o.sheduleDate,
//           o.orderApp,
//           po.id AS processOrderId,
//           po.invNo,
//           po.status,
//           po.createdAt,
//           op.packingStatus,
//           op.createdAt AS packageCreatedAt
//         FROM processorders po, orders o, orderpackage op
//         WHERE op.packingStatus = 'Todo' AND po.status = 'Processing' AND po.orderId = o.id AND po.id = op.orderId 
//       `;

//     let countSql = `
//       SELECT COUNT(DISTINCT po.id) AS total
//       FROM processorders po, orders o, orderpackage op
//       WHERE op.packingStatus = 'Todo' AND po.status = 'Processing' AND po.orderId = o.id AND po.id = op.orderId
//     `;

//     // Apply filters to both queries
//     if (statusFilter) {
//       if (statusFilter === "Paid") {
//         dataSql += ` AND po.isPaid = 1 `;
//         countSql += ` AND po.isPaid = 1 `;
//       } else if (statusFilter === "Pending") {
//         dataSql += ` AND po.isPaid = 0 `;
//         countSql += ` AND po.isPaid = 0 `;
//       } else if (statusFilter === "Cancelled") {
//         dataSql += ` AND po.status = 'Cancelled' `;
//         countSql += ` AND po.status = 'Cancelled' `;
//       }
//     }

//     if (dateFilter) {
//       dataSql += ` AND DATE(o.sheduleDate) = ? `;
//       countSql += ` AND DATE(o.sheduleDate) = ? `;
//       params.push(dateFilter);
//       countParams.push(dateFilter);
//     }

//     if (dateFilter1) {
//       dataSql += ` AND DATE(po.createdAt) = ? `;
//       countSql += ` AND DATE(po.createdAt) = ? `;
//       params.push(dateFilter1);
//       countParams.push(dateFilter1);
//     }

//     if (searchText) {
//       dataSql += ` AND po.invNo LIKE ? `;
//       countSql += ` AND po.invNo LIKE ? `;
//       params.push(`%${searchText}%`);
//       countParams.push(`%${searchText}%`);
//     }

//     // Add GROUP BY and ORDER BY only to data query
//     dataSql += ` GROUP BY
//                   o.fullTotal,
//                   o.sheduleDate,
//                   o.orderApp,
//                   po.id,
//                   po.invNo,
//                   po.status,
//                   op.packingStatus,
//                   op.createdAt
//                  ORDER BY op.createdAt DESC
//                  LIMIT ? OFFSET ?
//                 `;

//     params.push(parseInt(limit), parseInt(offset));


//     marketPlace.query(countSql, countParams, (countErr, countResults) => {
//       if (countErr) {
//         console.error("Count query error:", countErr);
//         return reject(countErr);
//       }

//       const total = countResults[0]?.total || 0;

//       marketPlace.query(dataSql, params, (dataErr, dataResults) => {
//         if (dataErr) {
//           console.error("Data query error:", dataErr);
//           return reject(dataErr);
//         }

//         resolve({
//           items: dataResults,
//           total,
//         });
//       });
//     });
//   });
// };


exports.getAllOrdersWithProcessInfo = (
  page,
  limit,
  statusFilter,
  dateFilter,
  dateFilter1,
  searchText
) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;
    const params = [];
    const countParams = [];

    // Get only the latest orderpackage for each processorder
    const dataSql = `
      SELECT 
        (SELECT SUM(mp.productPrice * op2.qty)
         FROM orderpackage op2
         JOIN marketplacepackages mp ON op2.packageId = mp.id
         WHERE op2.orderId = po.id) AS total,
        o.sheduleDate,
        o.orderApp,
        po.id AS processOrderId,
        po.invNo,
        po.status,
        po.createdAt,
        op.packingStatus,
        op.createdAt AS packageCreatedAt
      FROM processorders po
      INNER JOIN orders o ON po.orderId = o.id
      INNER JOIN (
        SELECT op1.* 
        FROM orderpackage op1
        INNER JOIN (
          SELECT orderId, MAX(createdAt) as maxCreatedAt
          FROM orderpackage 
          WHERE packingStatus = 'Todo'
          GROUP BY orderId
        ) op2 ON op1.orderId = op2.orderId AND op1.createdAt = op2.maxCreatedAt
        WHERE op1.packingStatus = 'Todo'
      ) op ON po.id = op.orderId
      WHERE po.status = 'Processing'
        ${statusFilter ? 
          (statusFilter === "Paid" ? " AND po.isPaid = 1 " : 
           statusFilter === "Pending" ? " AND po.isPaid = 0 " : 
           statusFilter === "Cancelled" ? " AND po.status = 'Cancelled' " : "") 
          : ""}
        ${dateFilter ? " AND DATE(o.sheduleDate) = ? " : ""}
        ${dateFilter1 ? " AND DATE(po.createdAt) = ? " : ""}
        ${searchText ? " AND po.invNo LIKE ? " : ""}
      ORDER BY op.createdAt DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(DISTINCT po.id) AS total
      FROM processorders po
      INNER JOIN orders o ON po.orderId = o.id
      INNER JOIN orderpackage op ON po.id = op.orderId
      WHERE op.packingStatus = 'Todo' 
        AND po.status = 'Processing'
        ${statusFilter ? 
          (statusFilter === "Paid" ? " AND po.isPaid = 1 " : 
           statusFilter === "Pending" ? " AND po.isPaid = 0 " : 
           statusFilter === "Cancelled" ? " AND po.status = 'Cancelled' " : "") 
          : ""}
        ${dateFilter ? " AND DATE(o.sheduleDate) = ? " : ""}
        ${dateFilter1 ? " AND DATE(po.createdAt) = ? " : ""}
        ${searchText ? " AND po.invNo LIKE ? " : ""}
    `;

    // Build parameters for both queries
    if (dateFilter) {
      params.push(dateFilter);
      countParams.push(dateFilter);
    }
    if (dateFilter1) {
      params.push(dateFilter1);
      countParams.push(dateFilter1);
    }
    if (searchText) {
      params.push(`%${searchText}%`);
      countParams.push(`%${searchText}%`);
    }

    // Add limit and offset only to data query
    params.push(parseInt(limit), parseInt(offset));

    marketPlace.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Count query error:", countErr);
        return reject(countErr);
      }

      const total = countResults[0]?.total || 0;

      marketPlace.query(dataSql, params, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Data query error:", dataErr);
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

exports.getAllProductTypes = () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT typeName, shortCode FROM producttypes";

    marketPlace.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getOrderDetailsById = (orderId) => {
  console.log(`[getOrderDetailsById] Fetching details for orderId: ${orderId}`);

  return new Promise((resolve, reject) => {
    //     const sql = `

    //     SELECT 
    //     po.invNo,
    //     po.id AS processOrderId,
    //     o.id AS orderId,
    //     mpp.id AS packageId,
    //     op.id AS orderpkgId,
    //     mpp.displayName,
    //     CAST(mpp.productPrice AS DECIMAL(10,2)) AS productPrice,
    //     df.id AS definePkgId,
    //     CAST(df.price AS DECIMAL(10,2)) AS definePkgPrice,
    //     JSON_ARRAYAGG(
    //         JSON_OBJECT(
    //             'itemId', dfi.id,
    //             'productTypeId', dfi.productType,
    //             'productTypeShortCode', pt.shortCode,
    //             'productId', dfi.productId,
    //             'productName', mpi.displayName,
    //             'qty', dfi.qty,
    //             'price', dfi.price,
    //             'dicountedPrice', mpi.discountedPrice 
    //         )
    //     ) AS items
    // FROM 
    //     market_place.processorders po
    // JOIN 
    //     market_place.orders o ON po.orderId = o.id
    // LEFT JOIN 
    //     market_place.orderpackage op ON po.id = op.orderId
    // LEFT JOIN 
    //     market_place.marketplacepackages mpp ON op.packageId = mpp.id
    // LEFT JOIN 
    //     market_place.definepackage df ON mpp.id = df.packageId
    // LEFT JOIN
    //     market_place.definepackageitems dfi ON df.id = dfi.definePackageId
    // JOIN 
    //     market_place.producttypes pt ON pt.id = dfi.productType
    // JOIN 
    //     market_place.marketplaceitems mpi ON mpi.id = dfi.productId
    // WHERE 
    //     po.id = ?
    // GROUP BY 
    //     po.invNo, po.id, o.id, op.id, mpp.id, mpp.displayName, mpp.productPrice, df.id


    //     `;

    const sql = `
SELECT 
    po.invNo,
    po.id AS processOrderId,
    o.id AS orderId,
    mpp.id AS packageId,
    op.id AS orderpkgId,
    op.qty AS packageQty,
    mpp.displayName,
    CAST(mpp.productPrice AS DECIMAL(10,2)) AS productPrice,
    df.id AS definePkgId,
    CAST(df.price AS DECIMAL(10,2)) AS definePkgPrice,
    JSON_ARRAYAGG(
        JSON_OBJECT(
            'itemId', dfi.id,
            'productTypeId', dfi.productType,
            'productTypeShortCode', pt.shortCode,
            'productId', dfi.productId,
            'productName', mpi.displayName,
            'qty', dfi.qty,
            'price', dfi.price,
            'dicountedPrice', mpi.discountedPrice 
        )
    ) AS items
FROM 
    market_place.processorders po
JOIN 
    market_place.orders o ON po.orderId = o.id
LEFT JOIN 
    market_place.orderpackage op ON po.id = op.orderId
LEFT JOIN 
    market_place.marketplacepackages mpp ON op.packageId = mpp.id
LEFT JOIN (
    SELECT dp1.*
    FROM market_place.definepackage dp1
    INNER JOIN (
        SELECT packageId, MAX(createdAt) AS max_createdAt
        FROM market_place.definepackage
        GROUP BY packageId
    ) dp2 ON dp1.packageId = dp2.packageId AND dp1.createdAt = dp2.max_createdAt
) df ON mpp.id = df.packageId
LEFT JOIN
    market_place.definepackageitems dfi ON df.id = dfi.definePackageId
JOIN 
    market_place.producttypes pt ON pt.id = dfi.productType
JOIN 
    market_place.marketplaceitems mpi ON mpi.id = dfi.productId
WHERE 
    po.id = ?
GROUP BY 
    po.invNo, po.id, o.id, op.id, mpp.id, mpp.displayName, mpp.productPrice, df.id
`;

    try {
      marketPlace.query(sql, [orderId], (err, results) => {
        if (err) {
          console.log("Database error:", err);
          return reject(err);
        }

        // Convert string to float for both prices
        const parsedResults = results.map(row => ({
          ...row,
          productPrice: parseFloat(row.productPrice),
          definePkgPrice: parseFloat(row.definePkgPrice)
        }));

        resolve(parsedResults);
      });

    } catch (error) {
      console.log("Error in createOrderPackageItemDao:", error);
      reject(error);
    }

  });
};

// exports.getOrderDetailsById = (orderId) => {
//   console.log(`[getOrderDetailsById] Fetching details for orderId: ${orderId}`);

//   return new Promise((resolve, reject) => {
//     const sql = `
//       SELECT 
//         po.invNo,
//         op.id AS packageId,
//         mpp.displayName,
//         mpp.productPrice,
//         pt.id AS productTypeId,
//         pt.typeName,
//         pt.shortCode
//       FROM 
//         processorders po
//       JOIN 
//         orders o ON po.orderId = o.id
//       LEFT JOIN 
//         orderpackage op ON po.id = op.orderId
//       LEFT JOIN 
//         marketplacepackages mp ON op.packageId = mp.id
//       LEFT JOIN 
//         packagedetails pd ON mp.id = pd.packageId
//       LEFT JOIN 
//         producttypes pt ON pd.productTypeId = pt.id
//       WHERE 
//         po.orderId = ?
//       ORDER BY
//         op.id, pt.id


//     `;

//     // LEFT JOIN 
//       //   orderpackage op ON po.id = op.orderId
//       // LEFT JOIN 
//       //   marketplacepackages mpp ON op.packageId = mpp.id
//       // LEFT JOIN 
//       //   definepackage df ON mpp.id = df.packageId
//       // LEFT JOIN
//       //   definepackageitems dfi ON df.id = dfi.definePackageId
//       // LEFT JOIN 
//       //   producttype pt ON pd.productTypeId = pt.id
//       // WHERE po.id = ?


//     console.log(
//       `[getOrderDetailsById] SQL Query:`,
//       sql.replace(/\s+/g, " ").trim()
//     );

//     marketPlace.query(sql, [orderId], (err, results) => {
//       if (err) {
//         console.error(`[getOrderDetailsById] Database error:`, err);
//         return reject(err);
//       }

//       // console.log(`[getOrderDetailsById] Raw results:`, results);

//       if (results.length === 0) {
//         // console.log(
//         //   `[getOrderDetailsById] No data found for orderId: ${orderId}`
//         // );
//         return resolve(null);
//       }

//       const invNo = results[0].invNo;
//       const packagesMap = new Map();

//       results.forEach((row) => {
//         if (!row.packageId) return;

//         if (!packagesMap.has(row.packageId)) {
//           packagesMap.set(row.packageId, {
//             packageId: row.packageId,
//             displayName: row.displayName,
//             productPrice: row.productPrice,
//             productTypes: [],
//           });
//         }

//         // Add productType if it exists
//         if (row.productTypeId) {
//           const packageEntry = packagesMap.get(row.packageId);
//           packageEntry.productTypes.push({
//             id: row.productTypeId,
//             typeName: row.typeName,
//             shortCode: row.shortCode,
//           });
//         }
//       });

//       // Convert to final structure
//       const response = {
//         invNo: invNo,
//         packages: Array.from(packagesMap.values()),
//       };

//       // console.log(
//       //   `[getOrderDetailsById] Final structured data:`,
//       //   JSON.stringify(response, null, 2)
//       // );
//       resolve(response);
//     });
//   });
// };

exports.createOrderPackageItemDao = (orderPackageId, products) => {
  return new Promise((resolve, reject) => {
    try {
      // Validate inputs
      if (!orderPackageId || !products || !Array.isArray(products)) {
        throw new Error("Invalid input parameters");
      }

      // Create an array of value arrays for the batch insert
      const values = products.map((product) => [
        orderPackageId,
        product.productType,
        product.productId,
        product.qty,
        parseFloat(product.price),
      ]);

      const sql = `
        INSERT INTO orderpackageitems (
          orderPackageId, productType, productId, qty, price
        ) VALUES ?
      `;

      // Database query with batch insert
      marketPlace.query(sql, [values], (err, results) => {
        if (err) {
          console.log("Database error:", err);
          return reject(err);
        }
        resolve(results);
      });
    } catch (error) {
      console.log("Error in createOrderPackageItemDao:", error);
      reject(error);
    }
  });
};

exports.getAllMarketplaceItems = (category, userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        MPI.id,
        MPI.varietyId,
        MPI.displayName,
        MPI.category,
        MPI.normalPrice,
        MPI.discountedPrice,
        MPI.discount,
        MPI.unitType,
        MPI.startValue,
        MPI.changeby,
        XL.id AS isExcluded
      FROM marketplaceitems MPI
      LEFT JOIN excludelist XL ON XL.mpItemId =  MPI.id AND XL.userId = ?
      WHERE category = 'Retail'
      ORDER BY 
        MPI.displayName
    `;


    marketPlace.query(sql, [userId], (err, results) => {
      if (err) {
        console.error(
          "[getAllMarketplaceItems] Error fetching all marketplace items:",
          err
        );
        return reject(err);
      }

      console.log('--------------------results-------------------');
      console.log(results);
      console.log('--------------------results-------------------');

      

      // Structure the data
      const items = results.map((row) => ({
        id: row.id,
        varietyId: row.varietyId,
        displayName: row.displayName,
        category: row.category,
        normalPrice: row.normalPrice,
        discountedPrice: row.discountedPrice,
        discount: row.discount,
        promo: row.promo,
        unitType: row.unitType,
        startValue: row.startValue,
        changeby: row.changeby,
        isExcluded: row.isExcluded === null ? false : true,

      }));

      // console.log(items);

      resolve(items);
    });
  });
};
exports.getOrderTypeDao = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT O.userId, U.buyerType
      FROM processorders POR, orders O, marketplaceusers U
      WHERE POR.id = ? AND POR.orderId = O.id AND O.userId = U.id
    `;
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        console.log("Erro", err);

        reject(err);
      } else {
        console.log("``````````result``````````", results[0]);
        resolve(results[0]);
      }
    });
  });
};
exports.getAllOrdersWithProcessInfoCompleted = (page, limit, dateFilter, searchTerm) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;
    const params = [];
    const countParams = [];

    let dataSql = `
         SELECT 
        o.*,
        po.id AS processOrderId,
        po.invNo,
        po.transactionId,
        po.paymentMethod,
        po.isPaid,
        po.amount,
        po.status,
        po.reportStatus,
        po.createdAt AS processCreatedAt,
        op.packingStatus
        FROM processorders po, orders o, orderpackage op
        WHERE packingStatus = 'Completed' AND po.status = 'Processing' AND po.orderId = o.id AND po.id = op.orderId 
      `;
    countSql = `
      SELECT 
        COUNT(po.id) AS total
        FROM processorders po, orders o, orderpackage op
        WHERE packingStatus = 'Completed' AND po.status = 'Processing' AND po.orderId = o.id AND po.id = op.orderId
      `;

    if (dateFilter) {
      console.log("Date Filter:", dateFilter);

      dataSql += ` AND DATE(o.sheduleDate) = ? `;
      countSql += ` AND DATE(o.sheduleDate) = ? `;
      params.push(dateFilter);
      countParams.push(dateFilter);
    }

    if (searchTerm) {
      dataSql += ` AND (po.invNo LIKE ? OR o.orderApp LIKE ?)`;
      countSql += ` AND (po.invNo LIKE ? OR o.orderApp LIKE ?)`;
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    dataSql += ` 
                 ORDER BY op.createdAt DESC
                 LIMIT ? OFFSET ?
                `;

    params.push(parseInt(limit), parseInt(offset));

    console.log("Executing Count Query...");
    // console.log(dataSql);

    marketPlace.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Count query error:", countErr);
        return reject(countErr);
      }

      const total = countResults[0]?.total || 0;

      console.log("Executing Data Query...");
      marketPlace.query(dataSql, params, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Data query error:", dataErr);
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

// In your DAO file (procumentDao.js or similar)
exports.updateOrderPackagePackingStatusDao = (orderPackageId, orderId, status) => {
  console.log('status', status, 'orderPackageId', orderPackageId, 'orderId', orderId)
  return new Promise((resolve, reject) => {
    try {
      const sql = `
      UPDATE orderpackage 
      SET packingStatus = ?
      WHERE orderId = ?;
      `;

      marketPlace.query(sql, [status, orderId], (err, results) => {
        if (err) {
          console.log("Database error:", err);
          return reject(err);
        }
        resolve(results);
      });
    } catch (error) {
      console.log("Error in updateOrderPackagePackingStatusDao:", error);
      reject(error);
    }
  });
};

exports.getAllOrderAdditionalItemsDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        ORAD.id,
        ORAD.unit,
        ORAD.qty,
        MPI.displayName
      FROM processorders PO, orders ORD, orderadditionalitems ORAD, marketplaceitems MPI
      WHERE PO.id = ? AND PO.orderId = ORD.id AND ORAD.orderId = ORD.id AND ORAD.productId = MPI.id
    `;

    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getOrderPackagesByOrderId = (orderId) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Validate input
      if (!orderId) {
        throw new Error("Invalid orderId parameter");
      }

      const sql = `
        SELECT 
          po.invNo,
          op.packageId,
          mp.displayName,
          mp.productPrice,
          opi.id as itemId,
          opi.productType,
          opi.productId,
          opi.qty,
          opi.price,
          m.discountedPrice,
          m.displayName as productDisplayName,
          pt.id as productTypeId,
          pt.typeName,
          pt.shortCode,
          op.qty AS packageQty
        FROM 
          processorders po
        JOIN 
          orderpackage op ON po.id = op.orderId
        JOIN 
          orders o ON o.id = po.orderId
        JOIN 
          marketplacepackages mp ON op.packageId = mp.id
        LEFT JOIN 
          orderpackageitems opi ON opi.orderPackageId = op.id
        LEFT JOIN 
          marketplaceitems m ON opi.productId = m.id
        LEFT JOIN
          producttypes pt ON opi.productType = pt.id
        WHERE 
          po.id = ?
        ORDER BY
          op.packageId, opi.id
      `;

      marketPlace.query(sql, [orderId], (err, results) => {
        if (err) {
          console.log("Database error:", err);
          return reject(err);
        }

        if (results.length === 0) {
          return resolve(null);
        }

        console.log('results', results)

        // Transform the flat results into the nested structure
        const response = {
          invNo: results[0].invNo,
          packages: [],
        };

        let currentPackage = null;

        for (const row of results) {
          // If we encounter a new package, create a new package entry
          if (!currentPackage || currentPackage.packageId !== row.packageId) {
            currentPackage = {
              packageId: row.packageId,
              displayName: row.displayName,
              productPrice: row.productPrice,
              packageQty: row.packageQty,
              productTypes: [],
            };
            response.packages.push(currentPackage);
          }

          // Add product type information if it exists
          if (row.itemId) {
            currentPackage.productTypes.push({
              id: row.itemId,
              productTypeId: row.productTypeId, // Added productTypeId here
              typeName: row.typeName,
              shortCode: row.shortCode,
              displayName: row.productDisplayName,
              productId: row.productId,
              qty: row.qty,
              price: row.discountedPrice,
            });
          }
        }

        resolve(response);
      });
    } catch (error) {
      console.log("Error in getOrderPackagesByOrderId:", error);
      reject(error);
    }
  });
};

exports.updateOrderPackageItemsDao = async (product) => {
  return new Promise((resolve, reject) => {
    const sql = `
        UPDATE orderpackageitems
        SET 
             productId = ?,
            qty = ?,
            price = ?
        WHERE id = ?
      `;
    marketPlace.query(
      sql,
      [product.productId, product.qty, product.price, product.id],
      (err, results) => {
        if (err) {
          console.log("Erro", err);

          reject(err);
        } else {
          resolve(results[0]);
          console.log("``````````result``````````", results[0]);
        }
      }
    );
  });
};

// exports.getAllOrdersWithProcessInfoDispatched = (page, limit, dateFilter, searchTerm) => {
//   return new Promise((resolve, reject) => {
//     const offset = (page - 1) * limit;
//     const params = [];
//     const countParams = [];

//     let dataSql = `
//         SELECT 
//         o.fullTotal AS total,
//         o.sheduleDate,
//         o.orderApp,
//         po.id AS processOrderId,
//         po.invNo,
//         po.status,
//         po.createdAt,
//         po.createdAt AS processCreatedAt,
//         op.packingStatus,
//         au.userName
//         FROM processorders po
//         JOIN orders o  ON po.orderId = o.id
//         JOIN orderpackage op ON op.orderId = po.id
//         LEFT JOIN agro_world_admin.adminusers au ON po.dispatchOfficer = au.id
//         WHERE op.packingStatus = 'Dispatch' AND po.status = 'Processing'
//       `;
//     countSql = `
//       SELECT 
//         COUNT(DISTINCT po.id) AS total
//         FROM processorders po
//         JOIN orders o  ON po.orderId = o.id
//         JOIN orderpackage op ON op.orderId = po.id
//         WHERE op.packingStatus = 'Dispatch' AND po.status = 'Processing'
//       `;

//     if (dateFilter) {
//       console.log("Date Filter:", dateFilter);

//       dataSql += ` AND DATE(o.sheduleDate) = ? `;
//       countSql += ` AND DATE(o.sheduleDate) = ? `;
//       params.push(dateFilter);
//       countParams.push(dateFilter);
//     }

//     if (searchTerm) {
//       dataSql += ` AND (po.invNo LIKE ? OR o.orderApp LIKE ? OR mu.firstName LIKE ? OR mu.lastName LIKE ?)`;
//       countSql += ` AND (po.invNo LIKE ? OR o.orderApp LIKE ? OR mu.firstName LIKE ? OR mu.lastName LIKE ?)`;
//       const searchPattern = `%${searchTerm}%`;
//       params.push(searchPattern, searchPattern, searchPattern, searchPattern);
//       countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
//     }

//     dataSql += ` 
//                 GROUP BY
//                   o.fullTotal,
//                   o.sheduleDate,
//                   o.orderApp,
//                   po.id,
//                   po.invNo,
//                   po.status,
//                   op.packingStatus,
//                   op.createdAt,
//                   au.userName
//                  ORDER BY op.createdAt DESC
//                  LIMIT ? OFFSET ?
//                 `;

//     params.push(parseInt(limit), parseInt(offset));

//     console.log("Executing Count Query...");
//     // console.log(dataSql);

//     marketPlace.query(countSql, countParams, (countErr, countResults) => {
//       if (countErr) {
//         console.error("Count query error:", countErr);
//         return reject(countErr);
//       }

//       console.log(countResults);

//       const total = countResults[0]?.total || 0;

//       console.log("Executing Data Query...");
//       marketPlace.query(dataSql, params, (dataErr, dataResults) => {
//         if (dataErr) {
//           console.error("Data query error:", dataErr);
//           return reject(dataErr);
//         }
//         console.log(dataResults);

//         resolve({
//           items: dataResults,
//           total,
//         });
//       });
//     });
//   });
// };

exports.getAllOrdersWithProcessInfoDispatched = (page, limit, dateFilter, searchTerm) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;
    const params = [];
    const countParams = [];

    let dataSql = `
        SELECT DISTINCT
          po.id AS processOrderId,
          (SELECT SUM(mp.productPrice * op2.qty)
           FROM orderpackage op2
           JOIN marketplacepackages mp ON op2.packageId = mp.id
           WHERE op2.orderId = po.id) AS total,
          o.sheduleDate,
          o.orderApp,
          po.invNo,
          po.status,
          po.createdAt,
          po.createdAt AS processCreatedAt,
          op.packingStatus,
          au.userName
        FROM processorders po
        JOIN orders o ON po.orderId = o.id
        JOIN orderpackage op ON op.orderId = po.id
        LEFT JOIN agro_world_admin.adminusers au ON po.dispatchOfficer = au.id
        WHERE op.packingStatus = 'Dispatch' AND po.status = 'Processing'
      `;
      
    let countSql = `
      SELECT COUNT(DISTINCT po.id) AS total
      FROM processorders po
      JOIN orders o ON po.orderId = o.id
      JOIN orderpackage op ON op.orderId = po.id
      WHERE op.packingStatus = 'Dispatch' AND po.status = 'Processing'
      `;

    if (dateFilter) {
      dataSql += ` AND DATE(o.sheduleDate) = ? `;
      countSql += ` AND DATE(o.sheduleDate) = ? `;
      params.push(dateFilter);
      countParams.push(dateFilter);
    }

    if (searchTerm) {
      dataSql += ` AND (po.invNo LIKE ? OR o.orderApp LIKE ?)`;
      countSql += ` AND (po.invNo LIKE ? OR o.orderApp LIKE ?)`;
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    dataSql += ` ORDER BY po.createdAt DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    console.log("Executing Count Query...");

    marketPlace.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Count query error:", countErr);
        return reject(countErr);
      }

      const total = countResults[0]?.total || 0;

      console.log("Executing Data Query...");
      marketPlace.query(dataSql, params, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Data query error:", dataErr);
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

exports.updateDefinePackageItemData = (formattedData) => {
  return new Promise((resolve, reject) => {
    const { processOrderId, packages } = formattedData;

    console.log('packages', packages)

    if (!Array.isArray(packages) || packages.length === 0) {
      return reject("No packages to process");
    }

    const updatePromises = [];

    packages.forEach(pkg => {
      const { orderpkgId, packageId, items } = pkg;

      // 1. Update packagingStatus to 'Completed'
      const updateStatusSQL = `
        UPDATE market_place.orderpackage
        SET packingStatus = 'Dispatch'
        WHERE packageId = ? AND orderId = ?
      `;
      updatePromises.push(new Promise((resolveInner, rejectInner) => {
        marketPlace.query(updateStatusSQL, [packageId, processOrderId], (err, result) => {
          if (err) {
            console.error(`Error updating packagingStatus for packageId ${packageId}:`, err);
            return rejectInner(err);
          }
          resolveInner(result);
        });
      }));

      // 2. Insert items
      items.forEach(item => {
        const insertItemSQL = `
          INSERT INTO market_place.orderpackageitems (orderPackageId, productType, productId, qty, price)
          VALUES (?, ?, ?, ?, ?)
        `;
        const itemParams = [
          orderpkgId,
          item.productTypeId,
          item.productId,
          item.qty,
          item.price,
        ];

        updatePromises.push(new Promise((resolveInner, rejectInner) => {
          marketPlace.query(insertItemSQL, itemParams, (err, result) => {
            if (err) {
              console.error(`Error inserting item into packageId ${packageId}:`, err);
              return rejectInner(err);
            }
            resolveInner(result);
          });
        }));
      });
    });


    Promise.all(updatePromises)
      .then(results => {
        resolve({
          message: 'Packaging status updated and items inserted successfully',
          affectedRows: results.reduce((total, result) => total + (result.affectedRows || 0), 0)
        });
      })
      .catch(error => {
        reject({
          message: 'One or more updates/inserts failed',
          error
        });
      });
  });
};



exports.getExcludeListDao = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        MPI.id,
        MPI.displayName
      FROM excludelist XL, marketplaceitems MPI
      WHERE XL.userId = ? AND XL.mpItemId = MPI.id
    `;
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        console.log("Erro", err);

        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.productCategoryDao = async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM producttypes ORDER BY typeName";
    marketPlace.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};


exports.trackDispatchOfficerDao = async (userId, orderId) => {
  return new Promise((resolve, reject) => {
    const sql = `
        UPDATE processorders
        SET 
          dispatchOfficer = ?
        WHERE 
          id = ?
      `;
    marketPlace.query( sql, [userId, orderId], (err, results) => {
        if (err) {
          console.log("Erro", err);
          reject(err);
        } else {
          resolve(results);
        }
      }
    );
  });
};


exports.testFuncDao = async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT GetProcessOrderPackageDetails() AS process_order_data;
    `;
    marketPlace.query(sql, (err, results) => {
      if (err) {
        console.log("Error", err);
        reject(err);
      } else {
        console.log("Function result", results[0]);
        // The result will be in JSON format
        const jsonData = JSON.parse(results[0].process_order_data || '[]');
        resolve(jsonData);
      }
    });
  });
};

exports.getDistributionOrders = (page, limit, centerId, deliveryDate, search) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let baseJoinSql = `
      FROM market_place.processorders po
      JOIN market_place.orders o ON po.orderId = o.id
      JOIN collection_officer.distributedcenter dc ON o.centerId = dc.id
      LEFT JOIN market_place.orderpackage op ON op.orderId = po.id
      LEFT JOIN market_place.orderpackageitems opi ON opi.orderPackageId = op.id
      LEFT JOIN market_place.orderadditionalitems oai ON oai.orderId = o.id
    `;

    let whereSql = ` WHERE po.status = 'processing' `;
    const queryParams = [];

    // Filter by center
    if (centerId) {
      whereSql += ` AND o.centerId = ?`;
      queryParams.push(centerId);
    }

    // Filter by delivery date (schedule date)
    if (deliveryDate) {
      whereSql += ` AND DATE(o.sheduleDate) = ?`;
      queryParams.push(deliveryDate);
    }

    // Subquery to get all items with their product details
    const itemsSubquery = `
      SELECT 
        po.id AS processOrderId,
        o.id AS orderId,
        o.centerId,
        DATE(o.sheduleDate) AS sheduleDate,
        mpi.varietyId,
        CASE 
          WHEN opi.id IS NOT NULL THEN 
            CASE 
              WHEN opi.qty < 1 THEN opi.qty * 1000
              ELSE opi.qty 
            END
          WHEN oai.id IS NOT NULL THEN 
            CASE 
              WHEN oai.unit = 'g' THEN oai.qty / 1000
              ELSE oai.qty 
            END
        END AS quantity
      ${baseJoinSql}
      LEFT JOIN market_place.marketplaceitems mpi ON (opi.productId = mpi.id OR oai.productId = mpi.id)
      ${whereSql}
        AND (opi.id IS NOT NULL OR oai.id IS NOT NULL)
        AND mpi.varietyId IS NOT NULL
    `;

    // Add search filter for the grouped query
    let havingSql = '';
    const searchParams = [];
    
    if (search) {
      havingSql = ` HAVING 
        cg.cropNameEnglish LIKE ? OR 
        cv.varietyNameEnglish LIKE ? OR 
        dc.regCode LIKE ? OR 
        dc.centerName LIKE ? OR
        CAST(ROUND(SUM(items.quantity), 3) AS CHAR) LIKE ? OR
        DATE_FORMAT(MAX(items.sheduleDate), '%Y-%m-%d') LIKE ?
      `;
      const likeSearch = `%${search}%`;
      searchParams.push(likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch);
    }

    // Count Query - Fixed to include sheduleDate in SELECT
    const countSql = `
      SELECT COUNT(*) AS total FROM (
        SELECT 1
        FROM (${itemsSubquery}) items
        JOIN plant_care.cropvariety cv ON items.varietyId = cv.id
        JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
        JOIN collection_officer.distributedcenter dc ON items.centerId = dc.id
        GROUP BY 
          cg.cropNameEnglish,
          cv.varietyNameEnglish,
          dc.regCode,
          dc.centerName,
          items.sheduleDate
        ${havingSql}
      ) AS grouped
    `;

    // Data Query
    const dataSql = `
      SELECT 
        cg.cropNameEnglish,
        cv.varietyNameEnglish,
        ROUND(SUM(items.quantity), 3) AS quantity,
        items.sheduleDate,
        dc.regCode,
        dc.centerName
      FROM (${itemsSubquery}) items
      JOIN plant_care.cropvariety cv ON items.varietyId = cv.id
      JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      JOIN collection_officer.distributedcenter dc ON items.centerId = dc.id
      GROUP BY 
        cg.cropNameEnglish,
        cv.varietyNameEnglish,
        dc.regCode,
        dc.centerName,
        items.sheduleDate
      ${havingSql}
      ORDER BY 
        items.sheduleDate DESC,
        dc.centerName ASC,
        cg.cropNameEnglish ASC,
        cv.varietyNameEnglish ASC
      LIMIT ? OFFSET ?
    `;

    const countParams = [...queryParams, ...searchParams];
    const dataParams = [...queryParams, ...searchParams, Number(limit), Number(offset)];

    marketPlace.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      marketPlace.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }

        const processedResults = dataResults.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity),
        }));

        resolve({ items: processedResults, total });
      });
    });
  });
};

exports.getAllDistributionCenters = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        id,
        CONCAT(regCode, ' - ', centerName) AS centerName
      FROM collection_officer.distributedcenter
      ORDER BY centerName ASC
    `;

    collectionofficer.query(sql, (err, results) => {
      if (err) {
        console.error("Error fetching distribution centers:", err);
        return reject(err);
      }

      resolve(results);
    });
  });
};