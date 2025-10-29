const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
  dash,
} = require("../startup/database");



exports.getPreMadePackages = (page, limit, packageStatus, date, search) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let whereClause = ` WHERE o.orderApp = 'Dash' AND op.packingStatus = 'Dispatch' AND o.isPackage = 1 `;
    const params = [];
    const countParams = [];

    if (packageStatus) {
      if (packageStatus === 'Pending') {
        whereClause += ` 
      AND (
        (pc.packedItems = 0 AND pc.totalItems > 0) 
        OR 
        (COALESCE(aic.packedAdditionalItems, 0) = 0 AND COALESCE(aic.totalAdditionalItems, 0) > 0)
      )
    `;
      } else if (packageStatus === 'Completed') {
        whereClause += ` 
      AND (
        (pc.totalItems > 0 AND pc.packedItems = pc.totalItems) 
        OR 
        (COALESCE(aic.totalAdditionalItems, 0) > 0 AND COALESCE(aic.packedAdditionalItems, 0) = COALESCE(aic.totalAdditionalItems, 0))
      )
    `;
      } else if (packageStatus === 'Opened') {
        whereClause += ` 
      AND (
        (pc.packedItems > 0 AND pc.totalItems > pc.packedItems) 
        OR 
        (COALESCE(aic.packedAdditionalItems, 0) > 0 AND COALESCE(aic.totalAdditionalItems, 0) > COALESCE(aic.packedAdditionalItems, 0))
      )
    `;
      }
    }

    if (date) {
      whereClause += " AND DATE(o.sheduleDate) = ?";
      params.push(date);
      countParams.push(date);
    }

    if (search) {
      whereClause += ` AND (po.invNo LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern);
      countParams.push(searchPattern);
    }

    const countSql = `
    WITH package_counts AS (
          SELECT 
              op.id AS orderPackageId,
              COUNT(*) AS totalItems,
              SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) AS packedItems
          FROM orderpackageitems opi
          JOIN orderpackage op ON op.id = opi.orderPackageId
          GROUP BY op.id
      ),
      additional_items_counts AS (
          SELECT 
              orderId,
              COUNT(*) AS totalAdditionalItems,
              SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) AS packedAdditionalItems
          FROM orderadditionalitems
          GROUP BY orderId
      )

      SELECT COUNT(*) as total
      FROM processorders po
      LEFT JOIN orders o ON po.orderId = o.id
      LEFT JOIN orderpackage op ON po.id = op.orderId
      LEFT JOIN marketplacepackages mpi ON op.packageId = mpi.id
      LEFT JOIN package_counts pc ON pc.orderPackageId = op.id
      LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
      ${whereClause}
      
    `;
    const dataSql = `
      WITH package_counts AS (
          SELECT 
              op.id AS orderPackageId,
              COUNT(*) AS totalItems,
              SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) AS packedItems
          FROM orderpackageitems opi
          JOIN orderpackage op ON op.id = opi.orderPackageId
          GROUP BY op.id
      ),
      additional_items_counts AS (
          SELECT 
              orderId,
              COUNT(*) AS totalAdditionalItems,
              SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) AS packedAdditionalItems
          FROM orderadditionalitems
          GROUP BY orderId
      )
        
      SELECT 
          o.id,
          po.id AS processOrderId,
          op.id AS orderPackageId,
          po.invNo,
          mpi.displayName,
          mpi.productPrice,
          o.sheduleDate,
          pc.totalItems AS totcount,
          pc.packedItems AS packCount,
          au.userName,
          CONCAT(coff.firstNameEnglish , '' , coff.lastNameEnglish) AS packOfficer,
          COALESCE(aic.totalAdditionalItems, 0) AS orderAdditionalCount,
          COALESCE(
              (SELECT SUM(price)
              FROM orderadditionalitems
              WHERE orderId = o.id),
              0
          ) AS additionalPrice,
          CASE
              WHEN pc.packedItems > 0 AND pc.totalItems > pc.packedItems THEN 'Opened'
              WHEN pc.packedItems = 0 AND pc.totalItems > 0 THEN 'Pending'
              WHEN pc.totalItems > 0 AND pc.packedItems = pc.totalItems THEN 'Completed'
              ELSE 'Unknown'
          END AS packageStatus,
          COALESCE(aic.totalAdditionalItems, 0) AS totalAdditionalItems,
          COALESCE(aic.packedAdditionalItems, 0) AS packedAdditionalItems,
          CASE
              WHEN COALESCE(aic.packedAdditionalItems, 0) > 0 AND COALESCE(aic.totalAdditionalItems, 0) > COALESCE(aic.packedAdditionalItems, 0) THEN 'Opened'
              WHEN COALESCE(aic.packedAdditionalItems, 0) = 0 AND COALESCE(aic.totalAdditionalItems, 0) > 0 THEN 'Pending'
              WHEN COALESCE(aic.totalAdditionalItems, 0) > 0 AND COALESCE(aic.packedAdditionalItems, 0) = COALESCE(aic.totalAdditionalItems, 0) THEN 'Completed'
              ELSE 'Unknown'
          END AS additionalItemsStatus
      FROM processorders po
      LEFT JOIN orders o ON po.orderId = o.id
      LEFT JOIN orderpackage op ON po.id = op.orderId
      LEFT JOIN marketplacepackages mpi ON op.packageId = mpi.id
      LEFT JOIN package_counts pc ON pc.orderPackageId = op.id
      LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
      LEFT JOIN agro_world_admin.adminusers au ON po.adminPackby = au.id
      LEFT JOIN collection_officer.collectionofficer coff ON po.packby = coff.id
      ${whereClause}
      ORDER BY po.createdAt DESC
      LIMIT ? OFFSET ?
      `;

    params.push(parseInt(limit), parseInt(offset));

    console.log('Executing Count Query...');
    marketPlace.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0]?.total || 0;

      console.log('Executing Data Query...');
      marketPlace.query(dataSql, params, (dataErr, dataResults) => {
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



exports.getSelectedPackages = (page, limit, Status, date, search) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let whereClause = ` WHERE o.orderApp = 'Dash' AND o.isPackage = 0 `;
    const params = [];
    const countParams = [];

    if (Status) {
      if (Status === 'Pending') {
        whereClause += ` 
      AND (COALESCE(aic.packedAdditionalItems, 0) = 0 AND COALESCE(aic.totalAdditionalItems, 0) > 0)
    `;
      } else if (Status === 'Completed') {
        whereClause += ` 
      AND (COALESCE(aic.totalAdditionalItems, 0) > 0 AND COALESCE(aic.packedAdditionalItems, 0) = COALESCE(aic.totalAdditionalItems, 0))
    `;
      } else if (Status === 'Opened') {
        whereClause += ` 
      AND (COALESCE(aic.packedAdditionalItems, 0) > 0 AND COALESCE(aic.totalAdditionalItems, 0) > COALESCE(aic.packedAdditionalItems, 0))
    `;
      }
    }

    if (date) {
      whereClause += " AND DATE(o.sheduleDate) = ?";
      params.push(date);
      countParams.push(date);
    }

    if (search) {
      whereClause += ` AND (po.invNo LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern);
      countParams.push(searchPattern);
    }

    const countSql = `
    WITH additional_items_counts AS (
          SELECT 
              orderId,
              COUNT(*) AS totalAdditionalItems,
              SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) AS packedAdditionalItems
          FROM orderadditionalitems
          GROUP BY orderId
      )

      SELECT COUNT(*) as total
      FROM processorders po
      LEFT JOIN orders o ON po.orderId = o.id
      LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
      ${whereClause}
      
    `;
    const dataSql = `
      WITH additional_items_counts AS (
          SELECT 
              orderId,
              COUNT(*) AS totalAdditionalItems,
              SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) AS packedAdditionalItems
          FROM orderadditionalitems
          GROUP BY orderId
      )
        
      SELECT 
          o.id,
          po.id AS processOrderId,
          po.invNo,
          o.sheduleDate,
          au.userName,
          CONCAT(coff.firstNameEnglish , '' , coff.lastNameEnglish) AS packOfficer,
          COALESCE(aic.totalAdditionalItems, 0) AS orderAdditionalCount,
          COALESCE(
              (SELECT SUM(price)
              FROM orderadditionalitems
              WHERE orderId = o.id),
              0
          ) AS additionalPrice,
          COALESCE(aic.totalAdditionalItems, 0) AS totalAdditionalItems,
          COALESCE(aic.packedAdditionalItems, 0) AS packedAdditionalItems,
          CASE
              WHEN COALESCE(aic.packedAdditionalItems, 0) > 0 AND COALESCE(aic.totalAdditionalItems, 0) > COALESCE(aic.packedAdditionalItems, 0) THEN 'Opened'
              WHEN COALESCE(aic.packedAdditionalItems, 0) = 0 AND COALESCE(aic.totalAdditionalItems, 0) > 0 THEN 'Pending'
              WHEN COALESCE(aic.totalAdditionalItems, 0) > 0 AND COALESCE(aic.packedAdditionalItems, 0) = COALESCE(aic.totalAdditionalItems, 0) THEN 'Completed'
              ELSE 'Unknown'
          END AS additionalItemsStatus
      FROM processorders po
      LEFT JOIN orders o ON po.orderId = o.id
      LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
      LEFT JOIN agro_world_admin.adminusers au ON po.adminPackby = au.id
      LEFT JOIN collection_officer.collectionofficer coff ON po.packby = coff.id
      ${whereClause}
      ORDER BY po.createdAt DESC
      LIMIT ? OFFSET ?
      `;

    params.push(parseInt(limit), parseInt(offset));

    console.log('Executing Count Query...');
    marketPlace.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0]?.total || 0;

      console.log('Executing Data Query...');
      marketPlace.query(dataSql, params, (dataErr, dataResults) => {
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



exports.getPackageItems = (id) => {
  return new Promise((resolve, reject) => {

    const params = [id];

    const dataSql = `
  SELECT 
    po.id AS processOrderId,
    o.id AS orderId,
    o.isPackage,
    op.id AS orderPackageId,
    opi.productId,
    CAST(opi.qty AS DECIMAL(10,2)) AS quantity,
    CAST(opi.price AS DECIMAL(10,2)) AS price,
    opi.isPacked AS packedStatus,
    mpi.displayName,
    mpi.unitType,
    CAST(mpi.discountedPrice AS DECIMAL(10,2)) AS discountedPrice,
    po.invNo
  FROM market_place.processorders po
  JOIN market_place.orders o ON o.id = po.orderId 
  JOIN market_place.orderpackage op ON op.orderId = po.id 
  JOIN market_place.orderpackageitems opi ON opi.orderPackageId = op.id 
  JOIN market_place.marketplaceitems mpi ON opi.productId = mpi.id 
  WHERE po.id = ?
`;



    console.log('Executing Count Query...');

    marketPlace.query(dataSql, params, (dataErr, dataResults) => {
      if (dataErr) {
        console.error("Error in data query:", dataErr);
        return reject(dataErr);
      }

      resolve({
        items: dataResults,
        total: dataResults.length,
      });
    });
  });
};



exports.updatePackageItemData = (packedItems, id) => {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(packedItems) || packedItems.length === 0) {
      return reject("No items to update");
    }

    const updatePromises = packedItems.map(item => {
      const updateSql = `
        UPDATE market_place.orderpackageitems opi
        JOIN market_place.orderpackage op ON op.id = opi.orderPackageId
        JOIN market_place.processorders po ON op.orderId = po.id
        JOIN market_place.orders o ON o.id = po.orderId

        SET 
          opi.qty = ?,
          opi.price = ?,
          opi.isPacked = ?
        WHERE 
          po.id = ? AND opi.productId = ?
      `;

      const params = [item.quantity, item.price, item.packedStatus, id, item.productId];

      return new Promise((resolveInner, rejectInner) => {
        marketPlace.query(updateSql, params, (err, result) => {
          if (err) {
            console.error('Error updating item:', err);
            return rejectInner(err);
          }
          resolveInner(result);
        });
      });
    });

    Promise.all(updatePromises)
      .then(results => {
        resolve({ message: 'All items updated successfully', results });
      })
      .catch(error => {
        reject({ message: 'Error updating items', error });
      });
  });
};

exports.getAllProductsDao = () => {
  return new Promise((resolve, reject) => {

    const dataSql = `
    SELECT mpi.id, mpi.displayName AS productName, mpi.discountedPrice FROM market_place.marketplaceitems mpi
`;

    marketPlace.query(dataSql, (dataErr, dataResults) => {
      if (dataErr) {
        console.error("Error in data query:", dataErr);
        return reject(dataErr);
      }

      resolve({
        items: dataResults,
        total: dataResults.length,
      });
    });
  });
};


exports.replaceProductDataDao = (productId, quantity, totalPrice, id, previousProductId) => {
  return new Promise((resolve, reject) => {
    const updateSql = `
      UPDATE market_place.orderpackageitems opi
      JOIN market_place.orderpackage op ON opi.orderPackageId = op.id
      JOIN market_place.processorders po ON op.orderId = po.id
      JOIN market_place.orders o ON po.orderId = o.id
      
      SET 
        opi.productId = ?, 
        opi.qty = ?, 
        opi.price = ?
      WHERE 
        po.id = ? AND opi.productId = ?
    `;

    const params = [productId, quantity, totalPrice, id, previousProductId];

    marketPlace.query(updateSql, params, (err, result) => {
      if (err) {
        console.error('Error updating item:', err);
        return reject({ message: 'Error updating item', error: err });
      }
      resolve({ message: 'Item updated successfully', result });
    });
  });
};

exports.getAdditionalItems = (id) => {
  return new Promise((resolve, reject) => {

    const params = [id];

    const dataSql = `
    SELECT
        po.id AS processOrderId,
        o.id AS orderId,
        o.isPackage,
        oai.productId,
        CAST(oai.qty AS DECIMAL(10,2)) AS quantity,
        CAST(oai.price AS DECIMAL(10,2)) AS price,
        oai.isPacked AS packedStatus,
        mpi.displayName AS productName,
        oai.unit AS unitType,
        CAST(mpi.discountedPrice AS DECIMAL(10,2)) AS discountedPrice,
        po.invNo
      FROM market_place.processorders po
      JOIN market_place.orders o ON o.id = po.orderId 

      JOIN market_place.orderadditionalitems oai ON oai.orderId = o.id 
      JOIN market_place.marketplaceitems mpi ON oai.productId = mpi.id 
    WHERE po.id = ?
`;



    console.log('Executing Count Query...');

    marketPlace.query(dataSql, params, (dataErr, dataResults) => {
      if (dataErr) {
        console.error("Error in data query:", dataErr);
        return reject(dataErr);
      }

      resolve({
        items: dataResults,
        total: dataResults.length,
      });
    });
  });
};

exports.updateAdditionalItemData = (additionalItems, id) => {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(additionalItems) || additionalItems.length === 0) {
      return reject("No items to update");
    }

    const updatePromises = additionalItems.map(item => {
      const updateSql = `
        UPDATE market_place.orderadditionalitems oai
        JOIN market_place.orders o ON o.id = oai.orderId
        JOIN market_place.processorders po ON po.orderId = o.id
        SET 
          oai.isPacked = ?
        WHERE 
          po.id = ? AND oai.productId = ?
      `;

      const params = [item.packedStatus, id, item.productId];

      return new Promise((resolveInner, rejectInner) => {
        marketPlace.query(updateSql, params, (err, result) => {
          if (err) {
            console.error('Error updating item:', err);
            return rejectInner(err);
          }
          resolveInner(result);
        });
      });
    });

    Promise.all(updatePromises)
      .then(results => {
        resolve({ message: 'All items updated successfully', results });
      })
      .catch(error => {
        reject({ message: 'Error updating items', error });
      });
  });
};


exports.getCustomAdditionalItems = (id) => {
  return new Promise((resolve, reject) => {

    const params = [id];

    const dataSql = `
    SELECT 
    po.id, 
    po.invNo,
    o.isPackage, 
    oai.productId,
    mpi.displayName AS productName,
    mpi.discountedPrice,
    CAST(oai.qty AS DECIMAL(10,2)) AS quantity,
    CAST(oai.price AS DECIMAL(10,2)) AS price,
    oai.unit AS unitType,
    oai.isPacked AS packedStatus
  FROM market_place.processorders po
  JOIN market_place.orders o ON po.orderId = o.id
  LEFT JOIN market_place.orderadditionalitems oai ON oai.orderId = o.id
  JOIN market_place.marketplaceitems mpi ON oai.productId = mpi.id 
  WHERE po.id = ? AND o.isPackage = 0
`;



    console.log('Executing Count Query...');

    marketPlace.query(dataSql, params, (dataErr, dataResults) => {
      if (dataErr) {
        console.error("Error in data query:", dataErr);
        return reject(dataErr);
      }

      resolve({
        items: dataResults,
        total: dataResults.length,
      });
    });
  });
};

exports.updateCustomAdditionalItemData = (customAdditionalItems, id) => {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(customAdditionalItems) || customAdditionalItems.length === 0) {
      return reject("No items to update");
    }

    const updatePromises = customAdditionalItems.map(item => {
      const updateSql = `
        UPDATE market_place.orderadditionalitems oai
        JOIN market_place.orders o ON o.id = oai.orderId
        JOIN market_place.processorders po ON po.orderId = o.id
        SET 
          oai.isPacked = ?
        WHERE 
          po.id = ? AND oai.productId = ?
      `;

      const params = [item.packedStatus, id, item.productId];

      return new Promise((resolveInner, rejectInner) => {
        marketPlace.query(updateSql, params, (err, result) => {
          if (err) {
            console.error('Error updating item:', err);
            return rejectInner(err);
          }
          resolveInner(result);
        });
      });
    });

    Promise.all(updatePromises)
      .then(results => {
        resolve({ message: 'All items updated successfully', results });
      })
      .catch(error => {
        reject({ message: 'Error updating items', error });
      });
  });
};




exports.updateIsPackedStatus = (packedItems) => {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(packedItems)) {
      return reject(new Error('packedItems must be an array'));
    }

    if (packedItems.length === 0) {
      return resolve({ affectedRows: 0, message: 'No items to update' });
    }

    const updateSql = `
      UPDATE finalorderpackagelist 
      SET isPacking = ? 
      WHERE id = ?
    `;

    // Get all unique orderIds related to the items we're updating
    const itemIds = packedItems.map(item => item.id);
    const getOrderIdsSql = `
      SELECT DISTINCT orderId 
      FROM finalorderpackagelist 
      WHERE id IN (?)
    `;

    marketPlace.query(getOrderIdsSql, [itemIds], (err, orderResults) => {
      if (err) {
        return reject(new Error(`Error fetching order IDs: ${err.message}`));
      }

      const orderIds = orderResults.map(row => row.orderId);
      if (orderIds.length === 0) {
        return reject(new Error('No related orders found for the given items'));
      }

      let completed = 0;
      let totalUpdated = 0;
      let failedUpdates = [];

      // First update all items in finalorderpackagelist
      packedItems.forEach(({ id, isPacked }) => {
        marketPlace.query(updateSql, [isPacked, id], (err, result) => {
          completed++;

          if (err) {
            console.error(`Error updating item with ID ${id}:`, err);
            failedUpdates.push(id);
          } else {
            console.log(`Updated item ID ${id} to isPacking = ${isPacked}`);
            totalUpdated += result.affectedRows;
          }

          // When all item updates are done
          if (completed === packedItems.length) {
            // Get all orders info and all items for those orders in a single step
            const getOrdersInfoSql = `
              SELECT id, addItemStatus 
              FROM orders 
              WHERE id IN (?)
            `;

            // Add query to get isAdditionalItems status for each order
            const getAdditionalItemStatusSql = `
              SELECT orderId, isAdditionalItems 
              FROM orderpackageitems 
              WHERE orderId IN (?)
            `;

            marketPlace.query(getOrdersInfoSql, [orderIds], (err, ordersInfoResults) => {
              if (err) {
                console.error('Error fetching orders information:', err);
                // Still resolve with the item update results
                return resolve({
                  success: true,
                  affectedRows: totalUpdated,
                  failedUpdates,
                  message: `${totalUpdated} items updated. ${failedUpdates.length ? failedUpdates.length + ' failed.' : 'All successful.'}`
                });
              }

              // Get the isAdditionalItems status for each order
              marketPlace.query(getAdditionalItemStatusSql, [orderIds], (err, additionalItemsResults) => {
                if (err) {
                  console.error('Error fetching additional items status:', err);
                  return resolve({
                    success: true,
                    affectedRows: totalUpdated,
                    failedUpdates,
                    message: `${totalUpdated} items updated. ${failedUpdates.length ? failedUpdates.length + ' failed.' : 'All successful.'}`
                  });
                }

                // Create a map of orderId to isAdditionalItems value
                const additionalItemsMap = {};
                additionalItemsResults.forEach(item => {
                  additionalItemsMap[item.orderId] = item.isAdditionalItems;
                });

                // Get the current status of all items for the affected orders
                const getItemsForOrdersSql = `
                  SELECT orderId, isPacking 
                  FROM finalorderpackagelist 
                  WHERE orderId IN (?)
                `;

                marketPlace.query(getItemsForOrdersSql, [orderIds], (err, allItemsResults) => {
                  if (err) {
                    console.error('Error fetching items for orders:', err);
                    // Still resolve with the item update results
                    return resolve({
                      success: true,
                      affectedRows: totalUpdated,
                      failedUpdates,
                      message: `${totalUpdated} items updated. ${failedUpdates.length ? failedUpdates.length + ' failed.' : 'All successful.'}`
                    });
                  }

                  // Group items by orderId
                  const itemsByOrder = {};
                  allItemsResults.forEach(item => {
                    if (!itemsByOrder[item.orderId]) {
                      itemsByOrder[item.orderId] = [];
                    }
                    itemsByOrder[item.orderId].push(item.isPacking);
                  });

                  // Create a mapping of orders with their addItemStatus
                  const orderInfoMap = {};
                  ordersInfoResults.forEach(order => {
                    orderInfoMap[order.id] = {
                      addItemStatus: order.addItemStatus
                    };
                  });

                  // Process each order to determine both new packItemStatus and packageStatus
                  const orderUpdates = [];

                  for (const orderId in itemsByOrder) {
                    const itemStatuses = itemsByOrder[orderId];
                    const allPacked = itemStatuses.every(status => status === 1);
                    const nonePacked = itemStatuses.every(status => status === 0);

                    // First calculate the new packItemStatus
                    let newPackItemStatus;
                    if (allPacked) {
                      newPackItemStatus = 'Completed';
                    } else if (nonePacked) {
                      newPackItemStatus = 'Pending';
                    } else {
                      newPackItemStatus = 'Opened';
                    }

                    // Get addItemStatus for this order
                    const orderInfo = orderInfoMap[orderId];
                    if (!orderInfo) continue;

                    const addItemStatus = orderInfo.addItemStatus;

                    // Check if this order has isAdditionalItems set to 1
                    const hasAdditionalItems = additionalItemsMap[orderId] === 1;

                    // Now determine packageStatus differently based on isAdditionalItems
                    let packageStatus;

                    if (!hasAdditionalItems) {
                      // If isAdditionalItems is 0, only consider packItemStatus
                      packageStatus = newPackItemStatus;
                    } else {
                      // If isAdditionalItems is 1, use the original logic
                      if (newPackItemStatus === 'Pending' && addItemStatus === 'Pending') {
                        packageStatus = 'Pending';
                      }
                      else if (newPackItemStatus === 'Pending' && addItemStatus === 'Opened') {
                        packageStatus = 'Pending';
                      }
                      else if (newPackItemStatus === 'Pending' && addItemStatus === 'Completed') {
                        packageStatus = 'Pending';
                      }
                      else if (newPackItemStatus === 'Opened' && addItemStatus === 'Pending') {
                        packageStatus = 'Pending';
                      }
                      else if (newPackItemStatus === 'Opened' && addItemStatus === 'Opened') {
                        packageStatus = 'Opened';
                      }
                      else if (newPackItemStatus === 'Opened' && addItemStatus === 'Completed') {
                        packageStatus = 'Opened';
                      }
                      else if (newPackItemStatus === 'Completed' && addItemStatus === 'Pending') {
                        packageStatus = 'Pending';
                      }
                      else if (newPackItemStatus === 'Completed' && addItemStatus === 'Opened') {
                        packageStatus = 'Opened';
                      }
                      else if (newPackItemStatus === 'Completed' && addItemStatus === 'Completed') {
                        packageStatus = 'Completed';
                      }
                      else {
                        // Default case (should theoretically never happen if data is clean)
                        packageStatus = 'Pending';
                        console.warn(`Unexpected status combination: packItemStatus=${newPackItemStatus}, addItemStatus=${addItemStatus}`);
                      }
                    }

                    orderUpdates.push({
                      orderId: orderId,
                      packItemStatus: newPackItemStatus,
                      packageStatus: packageStatus
                    });
                  }

                  // Update orders table with both packItemStatus and packageStatus
                  const updateOrderSql = `
                    UPDATE orders 
                    SET packItemStatus = ?, packageStatus = ?
                    WHERE id = ?
                  `;

                  let ordersCompleted = 0;
                  let ordersUpdated = 0;
                  let orderUpdateErrors = [];

                  if (orderUpdates.length === 0) {
                    return resolve({
                      success: true,
                      affectedRows: totalUpdated,
                      failedUpdates,
                      message: `${totalUpdated} items updated. ${failedUpdates.length ? failedUpdates.length + ' failed.' : 'All successful.'}`
                    });
                  }

                  // Update all orders with both statuses
                  orderUpdates.forEach(({ orderId, packItemStatus, packageStatus }) => {
                    marketPlace.query(updateOrderSql, [packItemStatus, packageStatus, orderId], (err, result) => {
                      ordersCompleted++;

                      if (err) {
                        console.error(`Error updating order ${orderId}:`, err);
                        orderUpdateErrors.push(orderId);
                      } else {
                        console.log(`Updated order ${orderId} to packItemStatus = ${packItemStatus} and packageStatus = ${packageStatus}`);
                        ordersUpdated += result.affectedRows;
                      }

                      if (ordersCompleted === orderUpdates.length) {
                        resolve({
                          success: true,
                          affectedRows: totalUpdated,
                          ordersUpdated,
                          failedUpdates,
                          orderUpdateErrors,
                          message: `${totalUpdated} items updated. ${ordersUpdated} orders updated. ${failedUpdates.length ? failedUpdates.length + ' item updates failed.' : ''} ${orderUpdateErrors.length ? orderUpdateErrors.length + ' order updates failed.' : ''}`
                        });
                      }
                    });
                  });
                });
              });
            });
          }
        });
      });
    });
  });
};






exports.getCustomOrderDetailsById = (id) => {
  return new Promise((resolve, reject) => {

    const sql = `SELECT 
                    osi.id AS id,
                    cv.varietyNameEnglish AS item,
                    osi.quantity AS quantity,
                    ROUND(mpi.discountedPrice / mpi.startValue, 2) AS UnitPrice,
                    osi.subtotal AS subtotal,
                    osi.isPacked AS isPacked
                   FROM orderselecteditems osi
                   JOIN market_place.marketplaceitems mpi ON osi.mpItemId = mpi.id
                   JOIN plant_care.cropvariety cv ON mpi.varietyId = cv.id
                   WHERE orderId = ?
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







exports.updateCustomPackItems = (items) => {
  return new Promise((resolve, reject) => {
    if (items.length === 0) {
      return resolve();
    }

    // First, update all the items' isPacked status
    const updates = items.map(item => {
      return new Promise((res, rej) => {
        const sql = `
            UPDATE orderselecteditems 
            SET isPacked = ? 
            WHERE id = ?
          `;
        marketPlace.query(sql, [item.isPacked, item.id], (err, result) => {
          if (err) {
            return rej(err);
          }
          res({ result, itemId: item.id });
        });
      });
    });

    Promise.all(updates)
      .then(() => {
        // Get all item IDs
        const itemIds = items.map(item => item.id);

        // Fetch the orderIds for these items
        const getOrderIdsSql = `
            SELECT id, orderId 
            FROM orderselecteditems 
            WHERE id IN (${itemIds.join(',')})
          `;

        return new Promise((res, rej) => {
          marketPlace.query(getOrderIdsSql, [], (err, results) => {
            if (err) {
              return rej(err);
            }
            res(results);
          });
        });
      })
      .then(itemsWithOrderIds => {
        // Extract the unique orderIds
        const orderIds = [...new Set(itemsWithOrderIds.map(item => item.orderId))];
        console.log('Order IDs to process:', orderIds);

        // For each affected order, check the packing status
        const orderUpdates = orderIds.map(orderId => {
          return new Promise((res, rej) => {
            // Query to count all items and packed items for this order
            const countSql = `
                SELECT 
                  COUNT(*) as totalItems,
                  SUM(IF(isPacked = 1, 1, 0)) as packedItems
                FROM orderselecteditems
                WHERE orderId = ?
              `;

            marketPlace.query(countSql, [orderId], (err, counts) => {
              if (err) {
                return rej(err);
              }

              const totalItems = parseInt(counts[0].totalItems, 10);
              const packedItems = parseInt(counts[0].packedItems, 10);

              console.log(`Order ${orderId}: Total items = ${totalItems}, Packed items = ${packedItems}`);

              // Determine new packageStatus based on counts
              let packageStatus = 'Pending';

              if (totalItems > 0) {
                if (packedItems > 0) {
                  // At least one item is packed
                  if (packedItems === totalItems) {
                    // All items are packed
                    packageStatus = 'Completed';
                    console.log(`Order ${orderId}: Setting status to Completed`);
                  } else {
                    // Some but not all items are packed
                    packageStatus = 'Opened';
                    console.log(`Order ${orderId}: Setting status to Opened`);
                  }
                } else {
                  console.log(`Order ${orderId}: Setting status to Pending (no packed items)`);
                }
              } else {
                console.log(`Order ${orderId}: No items found for this order`);
              }

              // Update the order's packageStatus
              const updateOrderSql = `
                  UPDATE orders
                  SET packageStatus = ?
                  WHERE id = ?
                `;

              marketPlace.query(updateOrderSql, [packageStatus, orderId], (err, result) => {
                if (err) {
                  console.error(`Failed to update order ${orderId}:`, err);
                  return rej(err);
                }
                console.log(`Successfully updated order ${orderId} to ${packageStatus}`);
                res(result);
              });
            });
          });
        });

        return Promise.all(orderUpdates);
      })
      .then(resolve)
      .catch(reject);
  });
};








exports.getPackageOrderDetailsById = (id) => {
  return new Promise((resolve, reject) => {

    const sql = `SELECT 
                    ai.id AS id,
                    cv.varietyNameEnglish AS item,
                    ai.quantity AS quantity,
                    ROUND(mpi.discountedPrice / mpi.startValue, 2) AS UnitPrice,
                    ai.subtotal AS subtotal,
                    ai.isPacked AS isPacked
                   FROM additionalitem ai
                   JOIN market_place.marketplaceitems mpi ON ai.mpItemId = mpi.id
                   JOIN plant_care.cropvariety cv ON mpi.varietyId = cv.id
                   WHERE orderPackageItemsId = ?
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




exports.getOrderPackageId = (id) => {
  return new Promise((resolve, reject) => {
    console.log('Querying order for item ID:', id);

    const sql = `SELECT 
                    o.id AS orderId
                   FROM additionalitem ai
                   JOIN orderpackageitems opi ON ai.orderPackageItemsId = opi.id
                   JOIN orders o ON opi.orderId = o.id
                   WHERE ai.id = ?
                   `;

    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        console.error('Error in getOrderPackageId:', err);
        reject(err);
      } else {
        console.log('getOrderPackageId results:', results);
        resolve(results);
      }
    });
  });
};



exports.updatePackItemsAdditional = (items) => {
  return new Promise((resolve, reject) => {
    if (!items || items.length === 0) {
      return resolve(); // Nothing to update
    }

    const updates = items.map(item => {
      return new Promise((res, rej) => {
        const sql = `
          UPDATE additionalitem 
          SET isPacked = ? 
          WHERE id = ?
        `;

        marketPlace.query(sql, [item.isPacked, item.id], (err, result) => {
          if (err) {
            console.error(`Error updating item ID ${item.id}:`, err);
            return rej(err);
          }
          res({ itemId: item.id, result });
        });
      });
    });

    Promise.all(updates)
      .then(resolve)
      .catch(reject);
  });
};

exports.getAdditionalItemsStatus = (orderId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        COUNT(*) as totalItems,
        SUM(CASE WHEN ai.isPacked = true THEN 1 ELSE 0 END) as packedItems
      FROM additionalitem ai
      JOIN orderpackageitems opi ON ai.orderPackageItemsId = opi.id
      WHERE opi.orderId = ?
    `;

    marketPlace.query(sql, [orderId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0] || { totalItems: 0, packedItems: 0 });
      }
    });
  });
};

// New function to get packItemStatus
exports.getPackItemStatus = (orderId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT packItemStatus FROM orders WHERE id = ?`;

    marketPlace.query(sql, [orderId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]?.packItemStatus || 'Pending');
      }
    });
  });
};

// New function to update order statuses
exports.updateOrderStatuses = (orderId, addItemStatus, packItemStatus) => {
  return new Promise((resolve, reject) => {
    // Calculate packageStatus based on the rules provided
    let packageStatus;

    // Rule logic for packageStatus
    if (addItemStatus === 'Completed' && packItemStatus === 'Completed') {
      packageStatus = 'Completed';
    } else if ((addItemStatus === 'Opened' || addItemStatus === 'Completed') &&
      (packItemStatus === 'Opened')) {
      packageStatus = 'Opened';
    } else if (addItemStatus === 'Opened' && packItemStatus === 'Completed') {
      packageStatus = 'Opened';
    } else {
      packageStatus = 'Pending';
    }

    const sql = `
      UPDATE orders 
      SET addItemStatus = ?, packageStatus = ?
      WHERE id = ?
    `;

    marketPlace.query(sql, [addItemStatus, packageStatus, orderId], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};



// exports.getMarketPlacePremadePackagesDao = (page, limit, packageStatus, date, search) => {
//   return new Promise((resolve, reject) => {
//     const offset = (page - 1) * limit;

//     let whereClause = ` 
//     WHERE 
//       o.orderApp = 'Marketplace' 
//       AND op.packingStatus = 'Dispatch' 
//       AND op.id IS NOT NULL
//      `;
//     const params = [];
//     const countParams = [];

//     // if (packageStatus) {
//     //   if (packageStatus === 'Pending') {
//     //     whereClause += ` 
//     //   AND (
//     //     (pc.packedItems = 0 AND pc.totalItems > 0) 
//     //     OR 
//     //     (COALESCE(aic.packedAdditionalItems, 0) = 0 AND COALESCE(aic.totalAdditionalItems, 0) > 0)
//     //   )
//     // `;
//     //   } else if (packageStatus === 'Completed') {
//     //     whereClause += ` 
//     //   AND (
//     //     (pc.totalItems > 0 AND pc.packedItems = pc.totalItems) 
//     //     OR 
//     //     (COALESCE(aic.totalAdditionalItems, 0) > 0 AND COALESCE(aic.packedAdditionalItems, 0) = COALESCE(aic.totalAdditionalItems, 0))
//     //   )
//     // `;
//     //   } else if (packageStatus === 'Opened') {
//     //     whereClause += ` 
//     //   AND (
//     //     (pc.packedItems > 0 AND pc.totalItems > pc.packedItems) 
//     //     OR 
//     //     (COALESCE(aic.packedAdditionalItems, 0) > 0 AND COALESCE(aic.totalAdditionalItems, 0) > COALESCE(aic.packedAdditionalItems, 0))
//     //   )
//     // `;
//     //   }
//     // }

//     // if (date) {
//     //   whereClause += " AND DATE(o.sheduleDate) = ?";
//     //   params.push(date);
//     //   countParams.push(date);
//     // }

//     if (search) {
//       whereClause += ` AND (po.invNo LIKE ?)`;
//       const searchPattern = `%${search}%`;
//       params.push(searchPattern);
//       countParams.push(searchPattern);
//     }

//     const countSql = `
//     WITH package_item_counts AS (
//       SELECT 
//           op.orderId,
//           COUNT(*) AS totalItems,
//           SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) AS packedItems
//       FROM orderpackageitems opi
//       JOIN orderpackage op ON opi.orderPackageId = op.id
//       GROUP BY op.orderId
//         ),
//       additional_items_counts AS (
//           SELECT 
//               orderId,
//               COUNT(*) AS totalAdditionalItems,
//               SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) AS packedAdditionalItems
//           FROM orderadditionalitems
//           GROUP BY orderId
//       )

//       SELECT COUNT(*) as total
//       FROM processorders po
//       LEFT JOIN orders o ON po.orderId = o.id
//       LEFT JOIN orderpackage op ON op.orderId = po.id 
//       LEFT JOIN marketplacepackages mpi ON op.packageId = mpi.id
//       LEFT JOIN package_item_counts pic ON pic.orderId = po.id
//       LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
//       ${whereClause}
//       GROUP BY
//         o.id,
//         po.id,
//         po.invNo,
//         o.sheduleDate,
//         pic.totalItems,
//         pic.packedItems,
//         aic.totalAdditionalItems,
//         aic.packedAdditionalItems
//     `;


//     const dataSql = `
//       WITH package_item_counts AS (
//           SELECT 
//               op.orderId,
//               COUNT(*) AS totalItems,
//               SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) AS packedItems,
//               CASE
//                   WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) = 0 AND COUNT(*) > 0 THEN 'Pending'
//                   WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) > 0 
//                        AND SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) < COUNT(*) THEN 'Opened'
//                   WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) = COUNT(*) AND COUNT(*) > 0 THEN 'Completed'
//                   ELSE 'Unknown'
//               END AS packageStatus
//           FROM orderpackageitems opi
//           JOIN orderpackage op ON opi.orderPackageId = op.id
//           GROUP BY op.orderId
//       ),
//       additional_items_counts AS (
//           SELECT 
//               orderId,
//               COUNT(*) AS totalAdditionalItems,
//               SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) AS packedAdditionalItems,
//               CASE
//                   WHEN COUNT(*) = 0 THEN 'Unknown'
//                   WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) = 0 THEN 'Pending'
//                   WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) > 0 
//                        AND SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) < COUNT(*) THEN 'Opened'
//                   WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) = COUNT(*) THEN 'Completed'
//                   ELSE 'Unknown'
//               END AS additionalItemsStatus
//           FROM orderadditionalitems
//           GROUP BY orderId
//       )

//       SELECT 
//           o.id,
//           po.id AS processOrderId,
//           po.invNo,
//           o.sheduleDate,
//           COUNT(DISTINCT op.id) AS packageCount,
//           SUM(DISTINCT mpi.productPrice) AS packagePrice,
//           COALESCE(pic.totalItems, 0) AS totPackageItems,
//           COALESCE(pic.packedItems, 0) AS packPackageItems,
//           COALESCE(aic.totalAdditionalItems, 0) AS totalAdditionalItems,
//           COALESCE(aic.packedAdditionalItems, 0) AS packedAdditionalItems,
//           pic.packageStatus,
//           COALESCE(aic.additionalItemsStatus, 'Unknown') AS additionalItemsStatus
//       FROM processorders po
//       LEFT JOIN orders o ON po.orderId = o.id
//       LEFT JOIN orderpackage op ON op.orderId = po.id 
//       LEFT JOIN marketplacepackages mpi ON op.packageId = mpi.id
//       LEFT JOIN package_item_counts pic ON pic.orderId = po.id
//       LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
//       ${whereClause}
//       GROUP BY
//           o.id,
//           po.id,
//           po.invNo,
//           o.sheduleDate,
//           pic.totalItems,
//           pic.packedItems,
//           pic.packageStatus,
//           aic.totalAdditionalItems,
//           aic.packedAdditionalItems,
//           aic.additionalItemsStatus
//       ORDER BY po.createdAt DESC
//       LIMIT ? OFFSET ?
//       `;

//     params.push(parseInt(limit), parseInt(offset));

//     console.log('Executing Count Query...');
//     marketPlace.query(countSql, countParams, (countErr, countResults) => {
//       if (countErr) {
//         console.error("Error in count query:", countErr);
//         return reject(countErr);
//       }

//       const total = countResults[0]?.total || 0;

//       console.log('Executing Data Query...');
//       marketPlace.query(dataSql, params, (dataErr, dataResults) => {
//         if (dataErr) {
//           console.error("Error in data query:", dataErr);
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

exports.getMarketPlacePremadePackagesDao = (page, limit, packageStatus, date, search) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let whereClause = ` 
    WHERE 
      o.orderApp = 'Marketplace' 
      AND op.packingStatus = 'Dispatch' 
      AND op.id IS NOT NULL
     `;
    const params = [];
    const countParams = [];

    if (packageStatus) {
      if (packageStatus === 'Pending') {
        whereClause += ` 
      AND (
        (pic.totalItems > 0 AND pic.packedItems = 0) 
        AND 
        (COALESCE(aic.totalAdditionalItems, 0) > 0 AND COALESCE(aic.packedAdditionalItems, 0) = 0)
      )
    `;
      } else if (packageStatus === 'Completed') {
        whereClause += ` 
      AND (
        (pic.totalItems > 0 AND pic.packedItems = pic.totalItems) 
        OR 
        (COALESCE(aic.totalAdditionalItems, 0) > 0 AND COALESCE(aic.packedAdditionalItems, 0) = COALESCE(aic.totalAdditionalItems, 0))
      )
    `;
      } else if (packageStatus === 'Opened') {
        whereClause += ` 
      AND (
        (pic.packedItems > 0 AND pic.totalItems > pic.packedItems) 
        OR 
        (COALESCE(aic.packedAdditionalItems, 0) > 0 AND COALESCE(aic.totalAdditionalItems, 0) > COALESCE(aic.packedAdditionalItems, 0))
      )
    `;
      }
    }

    if (date) {
      whereClause += " AND DATE(o.sheduleDate) = ?";
      params.push(date);
      countParams.push(date);
    }

    if (search) {
      whereClause += ` AND (po.invNo LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern);
      countParams.push(searchPattern);
    }

    const countSql = `
    SELECT COUNT(DISTINCT po.id) as total
    FROM processorders po
    LEFT JOIN orders o ON po.orderId = o.id
    LEFT JOIN orderpackage op ON op.orderId = po.id 
    LEFT JOIN marketplacepackages mpi ON op.packageId = mpi.id
    LEFT JOIN (
        SELECT 
            op.orderId,
            COUNT(*) AS totalItems,
            SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) AS packedItems
        FROM orderpackageitems opi
        JOIN orderpackage op ON opi.orderPackageId = op.id
        GROUP BY op.orderId
    ) pic ON pic.orderId = po.id
    LEFT JOIN (
        SELECT 
            orderId,
            COUNT(*) AS totalAdditionalItems,
            SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) AS packedAdditionalItems
        FROM orderadditionalitems
        GROUP BY orderId
    ) aic ON aic.orderId = o.id
    ${whereClause}
    `;

    const dataSql = `
      WITH package_item_counts AS (
          SELECT 
              op.orderId,
              COUNT(*) AS totalItems,
              SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) AS packedItems,
              CASE
                  WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) = 0 AND COUNT(*) > 0 THEN 'Pending'
                  WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) > 0 
                       AND SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) < COUNT(*) THEN 'Opened'
                  WHEN SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) = COUNT(*) AND COUNT(*) > 0 THEN 'Completed'
                  ELSE 'Unknown'
              END AS packageStatus
          FROM orderpackageitems opi
          JOIN orderpackage op ON opi.orderPackageId = op.id
          GROUP BY op.orderId
      ),
      additional_items_counts AS (
          SELECT 
              orderId,
              COUNT(*) AS totalAdditionalItems,
              SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) AS packedAdditionalItems,
              CASE
                  WHEN COUNT(*) = 0 THEN 'Unknown'
                  WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) = 0 THEN 'Pending'
                  WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) > 0 
                       AND SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) < COUNT(*) THEN 'Opened'
                  WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) = COUNT(*) THEN 'Completed'
                  ELSE 'Unknown'
              END AS additionalItemsStatus
          FROM orderadditionalitems
          GROUP BY orderId
      )
        
      SELECT 
          o.id,
          po.id AS processOrderId,
          po.invNo,
          o.sheduleDate,
          COUNT(DISTINCT op.id) AS packageCount,
          SUM(DISTINCT mpi.productPrice) AS packagePrice,
          COALESCE(pic.totalItems, 0) AS totPackageItems,
          COALESCE(pic.packedItems, 0) AS packPackageItems,
          COALESCE(aic.totalAdditionalItems, 0) AS totalAdditionalItems,
          COALESCE(aic.packedAdditionalItems, 0) AS packedAdditionalItems,
          pic.packageStatus,
          COALESCE(aic.additionalItemsStatus, 'Unknown') AS additionalItemsStatus,
          au.userName AS adminPackBy,
          CONCAT(cof.firstNameEnglish, ' ', cof.lastNameEnglish) AS packBy
      FROM processorders po
      LEFT JOIN orders o ON po.orderId = o.id
      LEFT JOIN orderpackage op ON op.orderId = po.id 
      LEFT JOIN marketplacepackages mpi ON op.packageId = mpi.id
      LEFT JOIN package_item_counts pic ON pic.orderId = po.id
      LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
      LEFT JOIN agro_world_admin.adminusers au ON po.adminPackby = au.id
      LEFT JOIN collection_officer.collectionofficer cof ON po.packBy = cof.id
      ${whereClause}
      GROUP BY
          o.id,
          po.id,
          po.invNo,
          o.sheduleDate,
          pic.totalItems,
          pic.packedItems,
          pic.packageStatus,
          aic.totalAdditionalItems,
          aic.packedAdditionalItems,
          aic.additionalItemsStatus
      ORDER BY po.createdAt DESC
      LIMIT ? OFFSET ?
      `;

    params.push(parseInt(limit), parseInt(offset));

    console.log('Executing Count Query...');
    marketPlace.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0]?.total || 0;

      console.log('Executing Data Query...');
      marketPlace.query(dataSql, params, (dataErr, dataResults) => {
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



exports.getMarketPlacePremadePackagesItemsDao = (orderId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      WITH package_item_counts AS (
        SELECT 
          op.id AS packageId,
          op.orderId,
          COUNT(*) AS totalItems,
          SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) AS packedItems
        FROM orderpackageitems opi
        JOIN orderpackage op ON opi.orderPackageId = op.id
        WHERE op.orderId = ?
        GROUP BY op.id, op.orderId
      ),
      package_details AS (
        SELECT 
          po.id AS processOrderId,
          mp.displayName AS name,
          mp.productPrice AS price,
          op.id AS packageId,
          op.qty AS packageQty
        FROM processorders po
        LEFT JOIN orderpackage op ON po.id = op.orderId
        LEFT JOIN marketplacepackages mp ON op.packageId = mp.id
        WHERE po.id = ?
      )

      SELECT 
        pd.processOrderId AS orderId,
        pd.name,
        pd.price,
        pd.packageId,
        pd.packageQty,
        COALESCE(pic.totalItems, 0) AS totCount,
        COALESCE(pic.packedItems, 0) AS packCount,
        CASE
          WHEN COALESCE(pic.packedItems, 0) = 0 AND COALESCE(pic.totalItems, 0) > 0 THEN 'Pending'
          WHEN COALESCE(pic.packedItems, 0) > 0 AND COALESCE(pic.packedItems, 0) < COALESCE(pic.totalItems, 0) THEN 'Opened'
          WHEN COALESCE(pic.packedItems, 0) = COALESCE(pic.totalItems, 0) AND COALESCE(pic.totalItems, 0) > 0 THEN 'Completed'
          ELSE 'Unknown'
        END AS packStatus
      FROM package_details pd
      LEFT JOIN package_item_counts pic ON pd.packageId = pic.packageId AND pd.processOrderId = pic.orderId
      ORDER BY pd.name
    `;

    marketPlace.query(sql, [orderId, orderId], (err, results) => {
      if (err) {
        console.error('Error in getMarketPlacePremadePackagesItemsDao:', err);
        reject(err);
      } else {
        resolve(results || []);
      }
    });
  });
};

exports.getMarketPlacePremadePackagesAdditionalItemsDao = (orderId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        po.id AS orderId,
        SUM(oai.normalPrice) AS price,
        COUNT(*) AS totCount,
        SUM(CASE WHEN oai.isPacked = 1 THEN 1 ELSE 0 END) AS packCount,
        CASE
          WHEN SUM(CASE WHEN oai.isPacked = 1 THEN 1 ELSE 0 END) = 0 AND COUNT(*) > 0 THEN 'Pending'
          WHEN SUM(CASE WHEN oai.isPacked = 1 THEN 1 ELSE 0 END) > 0 
               AND SUM(CASE WHEN oai.isPacked = 1 THEN 1 ELSE 0 END) < COUNT(*) THEN 'Opened'
          WHEN SUM(CASE WHEN oai.isPacked = 1 THEN 1 ELSE 0 END) = COUNT(*) AND COUNT(*) > 0 THEN 'Completed'
          ELSE 'Unknown'
        END AS packStatus
      FROM processorders po
      JOIN orders o ON po.orderId = o.id
      JOIN orderadditionalitems oai ON o.id = oai.orderId
      WHERE po.id = ?
      GROUP BY po.id
    `;

    marketPlace.query(sql, [orderId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0] || null);
      }
    });
  });
};


exports.getMarketPlaceCustomePackagesDao = (page, limit, packageStatus, date, search) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let whereClause = ` 
    WHERE 
      o.orderApp = 'Marketplace' 
      AND op.id IS NULL
     `;
    const params = [];
    const countParams = [];

    if (packageStatus) {
      if (packageStatus === 'Pending') {
        whereClause += ` 
          AND (
            COALESCE(aic.packedAdditionalItems, 0) = 0 
            AND COALESCE(aic.totalAdditionalItems, 0) > 0
          )
        `;
      } else if (packageStatus === 'Completed') {
        whereClause += ` 
          AND (
            COALESCE(aic.totalAdditionalItems, 0) > 0 
            AND COALESCE(aic.packedAdditionalItems, 0) = COALESCE(aic.totalAdditionalItems, 0)
          )
        `;
      } else if (packageStatus === 'Opened') {
        whereClause += ` 
          AND (
            COALESCE(aic.packedAdditionalItems, 0) > 0 
            AND COALESCE(aic.totalAdditionalItems, 0) > COALESCE(aic.packedAdditionalItems, 0)
          )
        `;
      }
    }

    if (date) {
      whereClause += " AND DATE(o.sheduleDate) = ?";
      params.push(date);
      countParams.push(date);
    }

    if (search) {
      whereClause += ` AND (po.invNo LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern);
      countParams.push(searchPattern);
    }

    const countSql = `
WITH additional_items_counts AS (
    SELECT 
        orderId,
        COUNT(*) AS totalAdditionalItems,
        SUM(normalPrice) AS price,
        SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) AS packedAdditionalItems
    FROM orderadditionalitems
    GROUP BY orderId
)

SELECT COUNT(DISTINCT po.id) as total
FROM processorders po
LEFT JOIN orders o ON po.orderId = o.id
LEFT JOIN orderpackage op ON op.orderId = po.id 
LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
${whereClause}
`;

    const dataSql = `
      WITH additional_items_counts AS (
          SELECT 
              orderId,
              COUNT(*) AS totalAdditionalItems,
              SUM(normalPrice) AS price,
              SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) AS packedAdditionalItems,
              CASE
                  WHEN COUNT(*) = 0 THEN 'Unknown'
                  WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) = 0 THEN 'Pending'
                  WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) > 0 
                       AND SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) < COUNT(*) THEN 'Opened'
                  WHEN SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) = COUNT(*) THEN 'Completed'
                  ELSE 'Unknown'
              END AS additionalItemsStatus
          FROM orderadditionalitems
          GROUP BY orderId
      )
        
      SELECT 
          o.id,
          po.id AS processOrderId,
          po.invNo,
          o.sheduleDate,
          COALESCE(aic.price, 0) AS additionalItemPrice,
          COALESCE(aic.totalAdditionalItems, 0) AS totalAdditionalItems,
          COALESCE(aic.packedAdditionalItems, 0) AS packedAdditionalItems,
          COALESCE(aic.additionalItemsStatus, 'Unknown') AS additionalItemsStatus,
          au.userName AS adminPackBy,
          CONCAT(cof.firstNameEnglish, ' ', cof.lastNameEnglish) AS packBy

      FROM processorders po
      LEFT JOIN orders o ON po.orderId = o.id
      LEFT JOIN orderpackage op ON op.orderId = po.id 
      LEFT JOIN additional_items_counts aic ON aic.orderId = o.id
      LEFT JOIN agro_world_admin.adminusers au ON po.adminPackby = au.id
      LEFT JOIN collection_officer.collectionofficer cof ON po.packBy = cof.id

      ${whereClause}
      GROUP BY
          o.id,
          po.id,
          po.invNo,
          o.sheduleDate,
          aic.totalAdditionalItems,
          aic.packedAdditionalItems,
          aic.additionalItemsStatus
      ORDER BY po.createdAt DESC
      LIMIT ? OFFSET ?
      `;

    params.push(parseInt(limit), parseInt(offset));

    console.log('Executing Count Query...');
    marketPlace.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0]?.total || 0;

      console.log('Executing Data Query...');
      marketPlace.query(dataSql, params, (dataErr, dataResults) => {
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


exports.getPackageForDispatchDao = (orderId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        opi.id,
        opi.qty,
        opi.isPacked,
        opi.price,
        mpi.displayName,
        mpi.discountedPrice     
      FROM orderpackageitems opi
      LEFT JOIN marketplaceitems mpi ON opi.productId = mpi.id
      WHERE orderPackageId = ?
    `;

    marketPlace.query(sql, [orderId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.dispatchPackageDao = (package) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE orderpackageitems
      SET 
        isPacked = ?
      WHERE 
        id = ?
    `;

    marketPlace.query(sql, [package.isPacked, package.id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getDispatchOrderTypeDao = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT O.userId, U.buyerType, POR.invNo
      FROM processorders POR, orders O, marketplaceusers U
      WHERE POR.id = ? AND POR.orderId = O.id AND O.userId = U.id
    `;
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        console.log("Erro", err);

        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};

exports.getAllDispatchMarketplaceItems = (category, userId) => {
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
      LEFT JOIN excludelist XL ON MPI.id = XL.mpItemId AND XL.userId = ?
      WHERE category = ?
      ORDER BY 
        MPI.displayName
    `;


    marketPlace.query(sql, [userId, category], (err, results) => {
      if (err) {
        console.error(
          "[getAllMarketplaceItems] Error fetching all marketplace items:",
          err
        );
        return reject(err);
      }

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

      console.log(items);

      resolve(items);
    });
  });
};


exports.getAdditionalItemsForDispatchDao = (orderId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        oai.id,
        oai.qty,
        oai.isPacked,
        oai.price,
        oai.unit,
        mpi.displayName,
        mpi.discountedPrice     
      FROM orderadditionalitems oai
      LEFT JOIN marketplaceitems mpi ON oai.productId = mpi.id
      WHERE oai.orderId = ?
    `;

    marketPlace.query(sql, [orderId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};


exports.getDispatchOrderDetailsDao = (orderId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        po.invNo,
        o.id AS orderId,
        (
          SELECT SUM(oa.price)
          FROM orderadditionalitems oa
          WHERE oa.orderId = o.id
        ) AS additionalPrice
      FROM processorders po
      JOIN orders o ON po.orderId = o.id
      WHERE po.id = ?
    `;

    marketPlace.query(sql, [orderId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0] || null);
      }
    });
  });
};


exports.dispatchAdditionalItemsDao = (package) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE orderadditionalitems
      SET 
        isPacked = ?
      WHERE 
        id = ?
    `;

    marketPlace.query(sql, [package.isPacked, package.id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};


exports.replaceDispatchPackageItemsDao = (oldItem, newItem) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE orderpackageitems
      SET 
        productId = ?,
        qty = ?,
        price = ?,
        isPacked = 0
      WHERE 
        id = ?
    `;

    marketPlace.query(sql, [
      newItem.id,
      newItem.qty,
      newItem.price,
      oldItem.id
    ], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};


exports.trackPackagePackDao = (userId, orderId, delivaryMethod) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE processorders
      SET 
        adminPackby = ?,
        status = ?,
        outDlvrDate = NOW()
      WHERE 
        id = ?
    `;

    let delivaryStatus = 'Out For Delivery';
    if(delivaryMethod === 'Pickup'){
      delivaryStatus = 'Ready for Pickup';
    }

    marketPlace.query(sql, [parseInt(userId), delivaryStatus, parseInt(orderId)], (err, results) => {
      if (err) {
        console.log(err);

        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.createdashNotificationDao = (id) => {
  return new Promise((resolve, reject) => {
    // First, select the orderApp value
    const selectSql = `
      SELECT o1.orderApp, o1.delivaryMethod
      FROM processorders po1
      JOIN orders o1 ON po1.orderId = o1.id
      WHERE po1.id = ?
    `;

    marketPlace.query(selectSql, [parseInt(id)], (err, results) => {
      if (err) {
        console.log(err);
        reject(err);
        return;
      }

      // Check if we got results and if orderApp is 'Dash'
      if (results.length > 0 && results[0].orderApp === 'Dash') {
        // Execute INSERT only if condition is met
        const insertSql = `
          INSERT INTO dashnotification (orderId, title)
          VALUES (?, 'Order is Out for Delivery')
        `;

        marketPlace.query(insertSql, [parseInt(id)], (insertErr, insertResults) => {
          if (insertErr) {
            console.log(insertErr);
            reject(insertErr);
          } else {
            resolve({insertResults, delivaryMethod: results[0].delivaryMethod});
          }
        });
      } else {
        // Resolve with empty result or appropriate message when condition not met
        resolve({ message: 'No notification created - orderApp is not Dash' , delivaryMethod: results[0].delivaryMethod});
      }
    });
  });
};


exports.distributedOfficerTargetUpdateDao = (id) => {
  return new Promise((resolve, reject) => {
    // First, select the orderApp value
    const selectSql = `
      SELECT 
        dti.id AS itemId,
        dt.id AS targetId,
        dt.target,
        dt.complete 
      FROM distributedtarget dt
      LEFT JOIN distributedtargetitems dti ON dt.id = dti.targetId
      WHERE dti.orderId = ?
    `;

    collectionofficer.query(selectSql, [parseInt(id)], (err, results) => {
      if (err) {
        console.log(err);
        reject(err);
        return;
      }

      if (results.length > 0 && results[0].target > 0) {
        const targetSql = `
          UPDATE
            distributedtarget dt
            LEFT JOIN distributedtargetitems dti ON dt.id = dti.targetId
          SET 
            dt.complete = ?,
            dti.isComplete = 1,
            dti.completeTime = NOW()
          WHERE
            dti.orderId = ?
        `;

        collectionofficer.query(
          targetSql, 
          [
            (parseInt(results[0].complete) + 1),
            parseInt(id)
          ], 
          (targetErr, targetResults) => {
            if (targetErr) {
              console.log(targetErr);
              reject(targetErr);
            } else {
              resolve(targetResults);
            }
          }
        );
      } else {
        // Resolve with empty result or appropriate message when condition not met
        resolve({ message: 'No Target Available for update' });
      }
    });
  });
};