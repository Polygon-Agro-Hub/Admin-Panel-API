const {
  plantcare,
  collectionofficer,
  marketPlace,
  dash,
} = require("../startup/database");
const { error } = require("console");
const Joi = require("joi");
const path = require("path");
const XLSX = require("xlsx");

exports.getAllCropNameDAO = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        cg.id AS cropId, 
        cv.id AS varietyId, 
        cg.cropNameEnglish, 
        cv.varietyNameEnglish AS varietyEnglish, 
        cv.image
      FROM 
        cropvariety cv, 
        cropgroup cg
      WHERE 
        cg.id = cv.cropGroupId
      ORDER BY 
        cg.cropNameEnglish ASC
    `;

    plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }

      const groupedData = {};

      results.forEach((item) => {
        const { cropNameEnglish, varietyEnglish, varietyId, cropId, image } =
          item;

        if (!groupedData[cropNameEnglish]) {
          groupedData[cropNameEnglish] = {
            cropId: cropId,
            variety: [],
          };
        }

        groupedData[cropNameEnglish].variety.push({
          id: varietyId,
          varietyEnglish: varietyEnglish,
          image: image,
        });
      });

      // Format the final result with variety sorting
      const formattedResult = Object.keys(groupedData).map((cropName) => {
        // Sort varieties alphabetically by varietyEnglish
        const sortedVarieties = groupedData[cropName].variety.sort((a, b) =>
          a.varietyEnglish.localeCompare(b.varietyEnglish)
        );

        return {
          cropId: groupedData[cropName].cropId,
          cropNameEnglish: cropName,
          variety: sortedVarieties,
        };
      });

      resolve(formattedResult);
    });
  });
};

// exports.createMarketProductDao = async (product) => {
//   return new Promise((resolve, reject) => {
//     const sql =
//       "INSERT INTO marketplaceitems (cropId, displayName, normalPrice, discountedPrice, promo, unitType, startValue, changeby, tags, category, discount, displayType) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
//     const values = [
//       product.variety,
//       product.cropName,
//       product.normalPrice,
//       product.discountedPrice,
//       product.promo,
//       product.unitType,
//       product.startValue,
//       product.changeby,
//       product.tags,
//       product.category,
//       product.discount,
//       product.displaytype,
//     ];

//     marketPlace.query(sql, values, (err, results) => {
//       if (err) {
//         reject(err);
//       } else {
//         resolve(results);
//       }
//     });
//   });
// };
exports.checkMarketProductExistsDao = async (varietyId, displayName, category) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM marketplaceitems WHERE category = ? AND (varietyId = ? OR displayName = ?)";
    const values = [category, varietyId, displayName];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Check for specific cases
        const varietyExists = results.some(item => item.varietyId === varietyId);
        const nameExists = results.some(item => item.displayName === displayName);

        resolve({
          exists: results.length > 0,
          varietyExists,
          nameExists
        });
      }
    });
  });
};

exports.checkMarketEditProductExistsDao = async (varietyId, displayName, category, id) => {
  return new Promise((resolve, reject) => {
    // Exclude current record by id when checking duplicates
    const sql = `
      SELECT * 
      FROM marketplaceitems 
      WHERE category = ? 
        AND (varietyId = ? OR displayName = ?)
        AND id != ?
    `;

    const values = [category, varietyId, displayName, id];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Check separately if conflicts are with varietyId or displayName
        const varietyExists = results.some(item => item.varietyId === varietyId);
        const nameExists = results.some(item => item.displayName === displayName);

        resolve({
          exists: results.length > 0,
          varietyExists,
          nameExists
        });
      }
    });
  });
};


exports.createMarketProductDao = async (product) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO marketplaceitems (displayName, normalPrice, discountedPrice, promo, unitType, startValue, changeby, tags, category, discount, varietyId, displayType, maxQuantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [
      product.cropName,
      product.normalPrice,
      product.discountedPrice,
      product.promo,
      product.unitType,
      product.startValue,
      product.changeby,
      product.tags,
      product.category,
      product.discount,
      product.varietyId,
      product.displaytype,
      product.category === "WholeSale" ? product.maxQuantity : null,
    ];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// exports.getMarketplaceItems = () => {
//   return new Promise((resolve, reject) => {
//     const dataSql = `
//     SELECT m.id, m.cropId, cg.cropNameEnglish, m.displayName , cv.varietyNameEnglish, m.discountedPrice, m.startValue, m.promo, m.unitType, m.changeby, m.normalPrice, m.category
//     FROM marketplaceitems m, plant_care.cropgroup cg, plant_care.cropvariety cv
//     WHERE m.cropId = cv.id AND cv.cropGroupId = cg.id
//     `;
//     marketPlace.query(dataSql, (error, results) => {
//       if (error) {
//         reject(error);
//       } else {
//         resolve(results);
//       }
//     });
//   });
// };

exports.getMarketplaceItems = (
  limit,
  offset,
  searchItem,
  displayTypeValue,
  categoryValue,
  discountFilter // Add new parameter
) => {
  return new Promise((resolve, reject) => {
    let whereConditions = [];
    const countParams = [];
    const dataParams = [];

    // Base SQL queries
    let countSql = `SELECT COUNT(*) as total 
                    FROM marketplaceitems m
                    JOIN plant_care.cropvariety cv ON m.varietyId = cv.id
                    JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id`;

    let dataSql = `SELECT m.id, m.displayName, m.discountedPrice, m.discount, m.startValue, m.maxQuantity, m.promo,
                    m.unitType, m.changeby, m.normalPrice, m.category, m.displayType,
                    cg.cropNameEnglish, cv.varietyNameEnglish
                    FROM marketplaceitems m
                    JOIN plant_care.cropvariety cv ON m.varietyId = cv.id
                    JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id`;

    // Add search condition if provided
    if (searchItem) {
      whereConditions.push(
        "(m.displayName LIKE ? OR cg.cropNameEnglish LIKE ? OR cv.varietyNameEnglish LIKE ?)"
      );
      const searchQuery = `%${searchItem}%`;
      countParams.push(searchQuery, searchQuery, searchQuery);
      dataParams.push(searchQuery, searchQuery, searchQuery);
    }

    // Add display type condition if provided
    if (displayTypeValue) {
      whereConditions.push("m.displayType LIKE ?");
      countParams.push(displayTypeValue);
      dataParams.push(displayTypeValue);
    }

    // Add category condition if provided
    if (categoryValue) {
      whereConditions.push("m.category = ?");
      countParams.push(categoryValue);
      dataParams.push(categoryValue);
    }

    // Add discount filter condition if provided
    if (discountFilter === 'zero') {
      whereConditions.push("m.discount = 0");
      // No parameters to add for this condition
    }

    // Combine WHERE conditions if any exist
    if (whereConditions.length > 0) {
      const whereClause = " WHERE " + whereConditions.join(" AND ");
      countSql += whereClause;
      dataSql += whereClause;
    }

    // Add limit and offset to data query
    dataSql += " ORDER BY m.displayName LIMIT ? OFFSET ?";
    dataParams.push(parseInt(limit), parseInt(offset));

    // Execute queries
    marketPlace.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) return reject(countErr);

      const total = countResults[0].total;

      marketPlace.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) return reject(dataErr);

        resolve({
          total: total,
          items: dataResults,
        });
      });
    });
  });
};

exports.deleteMarketplaceItem = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM marketplaceitems WHERE id = ?";
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows);
      }
    });
  });
};

exports.createCoupenDAO = async (coupen) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO coupon (code, type, percentage, status, checkLimit, priceLimit, fixDiscount, startDate, endDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [
      coupen.code,
      coupen.type,
      coupen.percentage,
      coupen.status,
      coupen.checkLimit,
      coupen.priceLimit,
      coupen.fixDiscount,
      coupen.startDate,
      coupen.endDate,
    ];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.insertId);
      }
    });
  });
};

exports.getAllCoupenDAO = (limit, offset, status, types, searchText) => {
  console.log(status);

  return new Promise((resolve, reject) => {
    let countParms = [];
    let dataParms = [];
    let countSql = " SELECT COUNT(*) AS total FROM coupon WHERE 1=1  ";
    let dataSql = `
      SELECT *
      FROM coupon
      WHERE 1=1
    `;

    if (status) {
      countSql += " AND status = ? ";
      dataSql += ` AND status = ? `;
      countParms.push(status);
      dataParms.push(status);
    }

    if (searchText) {
      countSql += " AND code LIKE ? ";
      dataSql += " AND code LIKE ? ";
      const searchPattern = `%${searchText}%`;
      countParms.push(searchPattern);
      dataParms.push(searchPattern);
    }

    if (types) {
      countSql += " AND type = ? ";
      dataSql += ` AND type = ? `;
      countParms.push(types);
      dataParms.push(types);
    }

    dataSql += ` LIMIT ? OFFSET ? `;
    dataParms.push(limit);
    dataParms.push(offset);

    marketPlace.query(countSql, countParms, (countErr, countResults) => {
      if (countErr) {
        console.log(countErr);

        reject(countErr);
      } else {
        marketPlace.query(dataSql, dataParms, (dataErr, dataResults) => {
          if (dataErr) {
            console.log(dataErr);

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

exports.deleteCoupenById = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM coupon WHERE id = ?";
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows);
      }
    });
  });
};

exports.deleteAllCoupen = async () => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM coupon";
    marketPlace.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows);
      }
    });
  });
};

exports.getAllProductCropCatogoryDAO = () => {
  return new Promise((resolve, reject) => {
    const sql = `
          SELECT cg.id AS cropId, mpi.normalPrice, mpi.discountedPrice,mpi.discount, mpi.id AS varietyId, cg.cropNameEnglish, mpi.displayName
          FROM marketplaceitems mpi, plant_care.cropvariety cv, plant_care.cropgroup cg
          WHERE mpi.varietyId = cv.id AND cv.cropGroupId = cg.id AND mpi.category = 'Retail'
          ORDER BY cg.cropNameEnglish, mpi.displayName
      `;

    marketPlace.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }

      const groupedData = {};

      results.forEach((item) => {
        const {
          cropNameEnglish,
          displayName,
          varietyId,
          cropId,
          normalPrice,
          discountedPrice,
          discount,
        } = item;

        if (!groupedData[cropNameEnglish]) {
          groupedData[cropNameEnglish] = {
            cropId: cropId,
            variety: [],
          };
        }

        groupedData[cropNameEnglish].variety.push({
          id: varietyId,
          displayName: displayName,
          normalPrice: parseFloat(normalPrice),
          discountedPrice: parseFloat(discountedPrice),
          discount: parseFloat(discount),
        });
      });

      // Format the final result
      const formattedResult = Object.keys(groupedData).map((cropName) => ({
        cropId: groupedData[cropName].cropId,
        cropNameEnglish: cropName,
        variety: groupedData[cropName].variety,
      }));

      resolve(formattedResult);
    });
  });
};

exports.creatPackageDAO = async (data, profileImageUrl) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO marketplacepackages (displayName, status, productPrice, packingFee, serviceFee, image, description) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const values = [
      data.displayName,
      data.status,
      data.productPrice,
      data.packageFee,
      data.serviceFee,
      profileImageUrl,
      data.description,
    ];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        resolve(results.insertId);
      }
    });
  });
};

exports.creatPackageDetailsDAO = async (data, packageId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO packagedetails (packageId, productTypeId, qty)
      VALUES (?, ?, ?)
    `;
    const values = [packageId, data.productTypeId, data.qty];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.insertId);
      }
    });
  });
};

exports.creatPackageDetailsDAOEdit = async (data, packageId) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO packagedetails (packageId, mpItemId, quantity, quantityType, price, discount, discountedPrice) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const values = [
      packageId,
      parseInt(data.mpItemId),
      data.quantity,
      "Kg",
      data.discountedPrice + data.detailDiscount,
      data.detailDiscount,
      data.discountedPrice,
    ];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.insertId);
      }
    });
  });
};

exports.getProductById = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
          SELECT 
            CG.id AS cropGroupId,
            CV.image,
            CV.id AS varietyId,
            CV.varietyNameEnglish AS variety,
            MPI.displayName AS cropName,
            MPI.category,
            MPI.normalPrice,
            MPI.discountedPrice AS salePrice,
            MPI.promo,
            MPI.unitType,
            MPI.startValue,
            MPI.changeby,
            MPI.tags,
            MPI.displayType AS displaytype,
            MPI.maxQuantity,
            MPI.discount,
            ROUND((MPI.discount / MPI.normalPrice) * 100, 2) AS discountedPrice
          FROM marketplaceitems MPI
          JOIN plant_care.cropvariety CV ON MPI.varietyId = CV.id
          JOIN plant_care.cropgroup CG ON CV.cropGroupId = CG.id
          WHERE MPI.id = ?
    `;
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        if (results.length > 0) {
          let product = results[0];

          product.tags = product.tags
            ? product.tags.split(",").map((tag) => tag.trim())
            : [];

          resolve(product);
        } else {
          resolve([]);
        }
      }
    });
  });
};



exports.updateMarketProductDao = async (product, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE marketplaceitems SET  
        displayName = ?, 
        normalPrice = ?, 
        discountedPrice = ?, 
        promo = ?, 
        unitType = ?, 
        startValue = ?, 
        changeby = ?, 
        tags = ?, 
        displayType = ?,
        category = ?,
        discount = ?,
        maxQuantity = ?,
        varietyId = ?
      WHERE id = ?
    `;
    const values = [
      product.cropName || null,
      parseFloat(product.normalPrice) || 0,
      parseFloat(product.discountedPrice) || 0,
      product.promo ? 1 : 0,
      product.unitType || null,
      parseFloat(product.startValue) || 0,
      parseFloat(product.changeby) || 0,
      product.tags || '',
      product.displaytype || '',
      product.category || null,
      parseFloat(product.discount) || 0,
      product.category === 'WholeSale' ? parseFloat(product.maxQuantity) : null,
      parseInt(product.varietyId) || null,
      parseInt(id),
    ];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        console.error('SQL Error:', err);
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};exports.getAllMarketplacePackagesDAO = (searchText, date) => {
  return new Promise((resolve, reject) => {
    const sqlParams = [];
    let sql = `
      SELECT
        MP.id,
        MP.displayName,
        (MP.productPrice + MP.packingFee + MP.serviceFee) AS total,
        MP.status,
        DP.defineDate,
        AU.userName AS adminUser
      FROM marketplacepackages MP
      LEFT JOIN (
        -- Get latest modification per package
        SELECT d1.packageId, d1.createdAt AS defineDate, d1.adminId
        FROM definepackage d1
        INNER JOIN (
          SELECT packageId, MAX(createdAt) AS latestDate
          FROM definepackage
          GROUP BY packageId
        ) latest ON latest.packageId = d1.packageId AND latest.latestDate = d1.createdAt
      ) DP ON DP.packageId = MP.id
      LEFT JOIN agro_world_admin.adminusers AU ON AU.id = DP.adminId
      WHERE MP.isValid = 1
    `;

    const whereConditions = [];

    if (searchText) {
      whereConditions.push(`MP.displayName LIKE ?`);
      sqlParams.push(`%${searchText}%`);
    }

    if (date) {
      whereConditions.push(`DP.defineDate >= ?`);
      sqlParams.push(`${date} 00:00:00`);
    }

    if (whereConditions.length > 0) {
      sql += ` AND ` + whereConditions.join(" AND ");
    }

    sql += ` ORDER BY MP.status ASC, MP.displayName ASC`;

    marketPlace.query(sql, sqlParams, (err, results) => {
      if (err) return reject(err);

      const groupedData = {};
      results.forEach(pkg => {
        const {
          status,
          id,
          displayName,
          image,
          description,
          total,
          discount,
          subtotal,
          defineDate,
          adminUser,
          created_at
        } = pkg;

        if (!groupedData[status]) {
          groupedData[status] = { status, packages: [] };
        }

        groupedData[status].packages.push({
          id,
          displayName,
          image,
          description,
          total,
          status,
          discount,
          subtotal,
          defineDate,
          adminUser,
          createdAt: created_at,
        });
      });

      resolve(Object.values(groupedData));
    });
  });
};


exports.getMarketplacePackagesByDateDAO = (date) => {
  return new Promise((resolve, reject) => {
    const sqlParams = [];

    let sql = `
      SELECT
        MP.id,
        MP.displayName,
        (MP.productPrice + MP.packingFee + MP.serviceFee) AS total,
        MP.status,
        (
          SELECT DP.createdAt
          FROM definepackage DP
          WHERE DP.packageId = MP.id
          ORDER BY DP.createdAt DESC
          LIMIT 1
        ) AS defineDate,
        (
          SELECT U.userName
          FROM agro_world_admin.adminusers U
          WHERE U.id = (
            SELECT DP.adminId
            FROM definepackage DP
            WHERE DP.packageId = MP.id
            ORDER BY DP.createdAt DESC
            LIMIT 1
          )
        ) AS adminUser
      FROM marketplacepackages MP
      WHERE (
        SELECT DATE(DP.createdAt)
        FROM definepackage DP
        WHERE DP.packageId = MP.id
        ORDER BY DP.createdAt DESC
        LIMIT 1
      ) = ?
      ORDER BY MP.status ASC, MP.displayName ASC
    `;

    sqlParams.push(date); // format: 'YYYY-MM-DD'

    marketPlace.query(sql, sqlParams, (err, results) => {
      if (err) return reject(err);

      const groupedData = {};

      results.forEach((pkg) => {
        const {
          status,
          id,
          displayName,
          image,
          description,
          total,
          discount,
          subtotal,
          defineDate,
          adminUser,
          created_at,
        } = pkg;

        if (!groupedData[status]) {
          groupedData[status] = {
            status,
            packages: [],
          };
        }

        groupedData[status].packages.push({
          id,
          displayName,
          image,
          description,
          total,
          status,
          discount,
          subtotal,
          defineDate,
          adminUser,
          createdAt: created_at,
        });
      });

      resolve(Object.values(groupedData));
    });
  });
};


exports.deleteMarketplacePckages = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM marketplacepackages WHERE id = ?";
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows);
      }
    });
  });
};

exports.updateMarketplacePackageDAO = (packageId, updateData) => {
  return new Promise((resolve, reject) => {
    // Extract fields from updateData that we want to allow updating
    const {
      displayName,
      image,
      description,
      status,
      total,
      discount,
      subtotal,
    } = updateData;

    const sql = `
      UPDATE marketplacepackages
      SET 
        displayName = ?,
        image = ?,
        description = ?,
        status = ?,
        total = ?,
        discount = ?,
        subtotal = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const values = [
      displayName,
      image,
      description,
      status,
      total,
      discount,
      subtotal,
      packageId,
    ];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }
      if (results.affectedRows === 0) {
        return reject(new Error("No package found with the given ID"));
      }
      resolve({
        id: packageId,
        ...updateData,
        message: "Package updated successfully",
      });
    });
  });
};

exports.getMarketplacePackageByIdDAO = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        mpp.id, mpp.displayName, mpp.image, mpp.status, mpp.description, 
        mpp.productPrice, mpp.packingFee, mpp.serviceFee
      FROM market_place.marketplacepackages mpp
      WHERE mpp.id = ?;
    `;
    // JOIN market_place.packagedetails pd ON mpp.id = pd.packageId
    //   JOIN market_place.producttypes pt ON pd.productTypeId = pt.id

    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      if (results.length === 0) {
        return reject(new Error("Package not found"));
      }
      resolve(results);
    });
  });
};
// exports.getMarketplacePackageByIdDAO = (packageId) => {
//   return new Promise((resolve, reject) => {
//     const sql = `
//       SELECT
//         mp.id,
//         mp.displayName,
//         mp.image,
//         mp.description,
//         mp.status,
//         mp.total,
//         mp.discount,
//         mp.subtotal,
//         mp.created_at,
//         pd.id AS detailId,
//         pd.packageId,
//         pd.mpItemId,
//         pd.quantityType,
//         pd.quantity,
//         pd.price AS detailPrice,
//         pd.discount AS detailDiscount,
//         pd.discountedPrice AS detailDiscountedPrice,
//         mi.varietyId,
//         mi.displayName AS itemDisplayName,
//         mi.category,
//         mi.normalPrice,
//         mi.discountedPrice,
//         mi.discount AS itemDiscount,
//         mi.promo,
//         mi.unitType
//       FROM marketplacepackages mp
//       LEFT JOIN packagedetails pd ON mp.id = pd.packageId
//       LEFT JOIN marketplaceitems mi ON pd.mpItemId = mi.id
//       WHERE mp.id = ?
//     `;

//     marketPlace.query(sql, [packageId], (err, results) => {
//       if (err) {
//         return reject(err);
//       }

//       if (results.length === 0) {
//         return reject(new Error("Package not found"));
//       }

//       // The first row contains the package info
//       const pkg = {
//         id: results[0].id,
//         displayName: results[0].displayName,
//         image: results[0].image,
//         description: results[0].description,
//         status: results[0].status,
//         total: results[0].total,
//         discount: results[0].discount,
//         subtotal: results[0].subtotal,
//         createdAt: results[0].created_at,
//         packageDetails: [],
//       };

//       // Add all package details (there might be multiple)
//       results.forEach((row) => {
//         if (row.detailId) {
//           // Check if there are any package details
//           pkg.packageDetails.push({
//             id: row.detailId,
//             packageId: row.packageId,
//             mpItemId: row.mpItemId,
//             quantityType: row.quantityType,
//             quantity: row.quantity, // Add this line to include quantity
//             price: row.detailPrice,
//             detailDiscount: row.detailDiscount,
//             detailDiscountedPrice: row.detailDiscountedPrice,
//             itemDetails: {
//               varietyId: row.varietyId,
//               displayName: row.itemDisplayName,
//               category: row.category,
//               normalPrice: row.normalPrice,
//               discountedPrice: row.discountedPrice,
//               discount: row.itemDiscount,
//               promo: row.promo,
//               unitType: row.unitType,
//             },
//           });
//         }
//       });

//       resolve(pkg);
//     });
//   });
// };

exports.getMarketplacePackageByIdWithDetailsDAO = (packageId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        mp.id, 
        mp.displayName AS packageDisplayName, 
        mp.image, 
        mp.description, 
        mp.status, 
        mp.productPrice,
        mp.packingFee,
        mp.serviceFee,
        mp.created_at,
        pd.id AS detailId,
        pd.packageId,
        pd.productTypeId,
        pd.qty,
        pt.id AS productTypeId,
        pt.typeName AS productTypeName,
        pt.shortCode AS productTypeShortCode,
        pt.created_at AS productTypeCreatedAt
      FROM marketplacepackages mp
      LEFT JOIN packagedetails pd ON mp.id = pd.packageId
      LEFT JOIN producttypes pt ON pd.productTypeId = pt.id
      WHERE mp.id = ?
    `;

    marketPlace.query(sql, [packageId], (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length === 0) {
        return reject(new Error("Package not found"));
      }

      const pkg = {
        id: results[0].id,
        displayName: results[0].packageDisplayName,
        image: results[0].image,
        description: results[0].description,
        status: results[0].status,
        productPrice: results[0].productPrice,
        packingFee: results[0].packingFee,
        serviceFee: results[0].serviceFee,
        createdAt: results[0].created_at,
        packageDetails: [],
      };

      results.forEach((row) => {
        if (row.productTypeId) {
          pkg.packageDetails.push({
            id: row.detailId,
            packageId: row.packageId,
            productType: {
              id: row.productTypeId,
              typeName: row.productTypeName,
              shortCode: row.productTypeShortCode,
              price: row.productTypePrice,
              createdAt: row.productTypeCreatedAt,
            },
            qty: row.qty,
          });
        }
      });

      resolve(pkg);
      console.log("Package with details:", pkg);
    });
  });
};

exports.updatePackageDAO = async (data, profileImageUrl, packageId) => {
  return new Promise((resolve, reject) => {
    const sql =
      "UPDATE marketplacepackages SET displayName = ?, status = ?, total = ?, image = ?, description = ? WHERE id = ?";
    const values = [
      data.displayName,
      data.status,
      data.total,
      profileImageUrl,
      data.description,
      packageId,
    ];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        resolve(results.affectedRows); // Returns number of rows affected
      }
    });
  });
};

exports.updatePackageDetailsDAO = async (data, detailId) => {
  return new Promise((resolve, reject) => {
    const sql =
      "UPDATE packagedetails SET mpItemId = ?, quantity = ?, quantityType = ?, price = ? WHERE id = ?";
    const values = [
      parseInt(data.mpItemId),
      data.quantity,
      data.qtytype,
      parseInt(data.discountedPrice),
      detailId,
    ];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows); // Returns number of rows affected
      }
    });
  });
};

exports.deletePackageDetails = async (packageId) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM packagedetails WHERE packageId = ?";

    marketPlace.query(sql, [packageId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows);
      }
    });
  });
};



exports.getMarketplaceUsers = async (buyerType) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, firstName, email, created_at, buyerType
      FROM marketplaceusers 
      WHERE isSubscribe = 1 AND LOWER(buyerType) = LOWER(?)
    `;

    marketPlace.query(sql, [buyerType], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.deleteMarketplaceUser = async (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE marketplaceusers 
      SET isSubscribe = 0 
      WHERE id = ? AND isSubscribe = 1
    `;

    marketPlace.query(sql, [userId], (err, result) => {
      if (err) {
        return reject(err);
      }
      if (result.affectedRows === 0) {
        return reject(new Error("User not found or already deactivated"));
      }
      resolve({ message: "User deactivated successfully" });
    });
  });
};

exports.getNextBannerIndexRetail = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT COALESCE(MAX(indexId), 0) + 1 AS nextOrderNumber
      FROM banners
      WHERE type = 'Retail'
    `;

    marketPlace.query(query, (error, results) => {
      if (error) {
        return reject(error); // Handle error
      }

      resolve(results[0].nextOrderNumber); // Return the next order number
    });
  });
};

exports.getNextBannerIndexWholesale = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT COALESCE(MAX(indexId), 0) + 1 AS nextOrderNumber
      FROM banners
      WHERE type = 'Wholesale'
    `;

    marketPlace.query(query, (error, results) => {
      if (error) {
        return reject(error); // Handle error
      }

      resolve(results[0].nextOrderNumber); // Return the next order number
    });
  });
};

exports.getBannerCount = async (type) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT COUNT(*) as count FROM banners WHERE type = ?";

    marketPlace.query(sql, [type], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0].count);
      }
    });
  });
};

exports.createBanner = async (data) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO banners (indexId, details, image, type) VALUES (?, ?, ?, ?)";
    const values = [data.index, data.name, data.image, "Retail"];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          insertId: results.insertId,
          message: "Banner created successfully",
        });
      }
    });
  });
};

exports.createBannerWholesale = async (data) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO banners (indexId, details, image, type) VALUES (?, ?, ?, ?)";
    const values = [data.index, data.name, data.image, "Wholesale"];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          insertId: results.insertId,
          message: "Banner created successfully",
        });
      }
    });
  });
};

exports.getAllBanners = () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM banners WHERE type = 'Retail' ORDER BY indexId";

    marketPlace.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results); // No need to wrap in arrays, return results directly
    });
  });
};

exports.getAllBannersWholesale = () => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT * FROM banners WHERE type = 'Wholesale' ORDER BY indexId";

    marketPlace.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results); // No need to wrap in arrays, return results directly
    });
  });
};

exports.updateBannerOrder = async (feedbacks) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE banners SET indexId = ? WHERE id = ?";

    const queries = feedbacks.map((feedback) => {
      return new Promise((resolveInner, rejectInner) => {
        marketPlace.query(
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

exports.getBannerById = async (feedbackId) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM banners WHERE id = ?";
    marketPlace.query(sql, [feedbackId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0]);
    });
  });
};

exports.deleteBannerRetail = async (feedbackId, orderNumber) => {
  return new Promise((resolve, reject) => {
    const deleteSql = "DELETE FROM banners WHERE id = ?";
    const updateSql =
      "UPDATE banners SET indexId = indexId - 1 WHERE indexId > ? AND type = 'Retail'";

    marketPlace.query(deleteSql, [feedbackId], (deleteErr, deleteResults) => {
      if (deleteErr) {
        return reject(deleteErr);
      }
      marketPlace.query(
        updateSql,
        [orderNumber],
        (updateErr, updateResults) => {
          if (updateErr) {
            return reject(updateErr);
          }

          resolve({
            deleteResults,
            updateResults,
          });
        }
      );
    });
  });
};

exports.deleteBannerWhole = async (feedbackId, orderNumber) => {
  return new Promise((resolve, reject) => {
    const deleteSql = "DELETE FROM banners WHERE id = ?";
    const updateSql =
      "UPDATE banners SET indexId = indexId - 1 WHERE indexId > ? AND type = 'Wholesale'";

    marketPlace.query(deleteSql, [feedbackId], (deleteErr, deleteResults) => {
      if (deleteErr) {
        return reject(deleteErr);
      }
      marketPlace.query(
        updateSql,
        [orderNumber],
        (updateErr, updateResults) => {
          if (updateErr) {
            return reject(updateErr);
          }

          resolve({
            deleteResults,
            updateResults,
          });
        }
      );
    });
  });
};

exports.createProductTypesDao = async (data) => {
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO producttypes (typeName, shortCode) VALUES (?, ?)";
    marketPlace.query(sql, [data.typeName, data.shortCode], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.viewProductTypeDao = async () => {
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

exports.getProductType = async () => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT typeName, shortCode, id FROM producttypes ORDER BY typeName ASC";
    marketPlace.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.editPackageDAO = async (data, profileImageUrl, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE marketplacepackages 
      SET 
        displayName = ?, 
        status = ?, 
        productPrice = ?, 
        packingFee = ?, 
        serviceFee = ?, 
        image = ?, 
        description = ?
      WHERE id = ?
    `;

    const values = [
      data.displayName,
      data.status,
      data.productPrice,
      data.packageFee,
      data.serviceFee,
      profileImageUrl,
      data.description,
      parseFloat(id), // Used in WHERE clause
    ];

    console.log("Main package:", values);

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.editPackageDetailsDAO = async (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE packagedetails 
      SET qty = ? 
      WHERE id = ?
    `;

    const values = [data.qty, data.id];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// exports.getAllRetailOrderDetails = (
//   limit,
//   offset,
//   status,
//   method,
//   searchItem,
//   formattedDate
// ) => {
//   return new Promise((resolve, reject) => {
//     let countSql =
//       "SELECT COUNT(*) as total FROM market_place.orders o LEFT JOIN market_place.processorders po ON o.id = po.orderId";
//     let sql = `
//     SELECT o.id, o.fullName AS customerName, o.delivaryMethod AS method, po.amount, po.invNo, po.status, o.createdAt AS orderdDate FROM market_place.orders o
//     LEFT JOIN market_place.processorders po ON o.id = po.orderId
//     `;

//     let whereClause = " WHERE 1=1";
//     const searchParams = [];

//     if (searchItem) {
//       // Turn "ap" into "%a%p%" to match "apple"
//       const searchQuery = `%${searchItem.split("").join("%")}%`;
//       whereClause += " AND (po.invNo LIKE ? OR o.fullName LIKE ?)";
//       searchParams.push(searchQuery, searchQuery);
//     }

//     if (status) {
//       whereClause += " AND po.status = ?";
//       searchParams.push(status);
//     }

//     if (method) {
//       whereClause += " AND o.delivaryMethod = ?";
//       searchParams.push(method);
//     }

//     if (formattedDate) {
//       whereClause += " AND DATE(o.createdAt) = ?";
//       searchParams.push(formattedDate);
//     }

//     // Add where clause to both count and main SQL
//     countSql += whereClause;
//     sql += whereClause + " ORDER BY o.createdAt ASC LIMIT ? OFFSET ?";
//     const dataParams = [...searchParams, limit, offset];

//     marketPlace.query(countSql, searchParams, (countErr, countResults) => {
//       if (countErr) {
//         return reject(countErr);
//       }

//       const total = countResults[0].total;

//       marketPlace.query(sql, dataParams, (dataErr, dataResults) => {
//         if (dataErr) {
//           return reject(dataErr);
//         }

//         resolve({
//           total: total,
//           items: dataResults,
//         });
//       });
//     });
//   });
// };

exports.getAllRetailOrderDetails = (
  limit,
  offset,
  status,
  method,
  searchItem,
  formattedDate
) => {
  return new Promise((resolve, reject) => {
    let countSql = `
      SELECT COUNT(*) as total 
      FROM market_place.orders o 
      LEFT JOIN market_place.processorders po ON o.id = po.orderId
      LEFT JOIN market_place.marketplaceusers mu ON o.userId = mu.id
    `;

    let sql = `
      SELECT o.id, po.id AS orderId, o.fullName AS customerName, o.delivaryMethod AS method, 
             o.fullTotal AS amount, po.invNo, po.status, o.createdAt AS orderdDate 
      FROM market_place.orders o
      LEFT JOIN market_place.processorders po ON o.id = po.orderId
      LEFT JOIN market_place.marketplaceusers mu ON o.userId = mu.id
    `;

    let whereClause = " WHERE 1=1";
    const searchParams = [];

    // Add the new conditions
    whereClause += " AND mu.buyerType = 'Retail'";
    whereClause += " AND o.orderApp = 'Marketplace'";

    if (searchItem) {
      const searchQuery = `%${searchItem.split("").join("%")}%`;
      whereClause += " AND (po.invNo LIKE ? OR o.fullName LIKE ?)";
      searchParams.push(searchQuery, searchQuery);
    }

    if (status) {
      whereClause += " AND po.status = ?";
      searchParams.push(status);
    }

    if (method) {
      whereClause += " AND o.delivaryMethod = ?";
      searchParams.push(method);
    }

    if (formattedDate) {
      whereClause += " AND DATE(o.createdAt) = ?";
      searchParams.push(formattedDate);
    }

    countSql += whereClause;
    sql += whereClause + " ORDER BY po.createdAt DESC LIMIT ? OFFSET ?";
    const dataParams = [...searchParams, limit, offset];

    marketPlace.query(countSql, searchParams, (countErr, countResults) => {
      if (countErr) {
        return reject(countErr);
      }

      const total = countResults[0].total;

      marketPlace.query(sql, dataParams, (dataErr, dataResults) => {
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

exports.getProductTypeByIdDao = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT typeName, shortCode FROM producttypes WHERE id = ?";
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0]);
    });
  });
};

exports.editProductTypesDao = async (data, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
                UPDATE producttypes 
                SET 
                  typeName = ?, shortCode = ?
                WHERE id = ?
              `;
    marketPlace.query(
      sql,
      [data.typeName, data.shortCode, id],
      (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results);
      }
    );
  });
};

exports.DeleteProductTypeByIdDao = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM producttypes WHERE id = ?";
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};
exports.getAllDeliveryCharges = (searchItem, city) => {
  return new Promise((resolve, reject) => {
    let whereConditions = [];
    let params = [];
    let sql = `
        SELECT 
          dc.id,
          dc.province,
          dc.district,
          dc.city,
          dc.charge,
          au.userName
        FROM deliverycharge dc
        LEFT JOIN agro_world_admin.adminusers au ON dc.editBy = au.id
        `;

    if (searchItem) {
      whereConditions.push("dc.city LIKE ?");
      params.push(`%${searchItem}%`);
    }

    if (city) {
      whereConditions.push("dc.city = ?");
      params.push(city);
    }

    if (whereConditions.length > 0) {
      sql += " WHERE " + whereConditions.join(" AND ");
    }

    // Changed from ORDER BY createdAt DESC to ORDER BY city ASC for A-Z ordering
    sql += " ORDER BY dc.city ASC";

    collectionofficer.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }

      resolve(results);
    });
  });
};

exports.uploadDeliveryCharges = async (fileBuffer, userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Read the Excel file
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);
      console.log(data);

      // Validate data structure
      if (data.length === 0) {
        return reject(new Error("Excel file is empty"));
      }

      const requiredColumns = ["Province", "District", "City", "Charge"];
      const headers = Object.keys(data[0]);

      if (!requiredColumns.every((col) => headers.includes(col))) {
        return reject(
          new Error(
            "Excel file must contain 'Province', 'District', 'City', and 'Charge' columns"
          )
        );
      }

      // Process data and remove duplicates within the file
      const chargesToProcess = [];
      const uniqueKeyMap = new Map(); // Use composite key for uniqueness

      for (const row of data) {
        const province = row["Province"]?.toString().trim();
        const district = row["District"]?.toString().trim();
        const city = row["City"]?.toString().trim();
        const charge = parseFloat(row["Charge"]);

        if (!province || !district || !city || isNaN(charge)) {
          continue; // Skip invalid rows
        }

        // Create a unique key using province, district, and city
        const uniqueKey = `${province.toLowerCase()}-${district.toLowerCase()}-${city.toLowerCase()}`;

        // Check if this combination already exists in this batch
        if (!uniqueKeyMap.has(uniqueKey)) {
          uniqueKeyMap.set(uniqueKey, { province, district, city, charge });
        }
      }

      if (uniqueKeyMap.size === 0) {
        return resolve({
          inserted: 0,
          updated: 0,
          duplicates: 0,
          message: "No valid data to process",
        });
      }

      // Get existing delivery charges with their current values
      const existingCharges = await new Promise((resolve, reject) => {
        const sql = "SELECT province, district, city, charge FROM deliverycharge";
        collectionofficer.query(sql, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });

      // Separate into inserts and updates
      const chargesToInsert = [];
      const chargesToUpdate = [];

      // Create a map of existing charges for easy lookup
      const existingChargeMap = new Map();
      existingCharges.forEach(c => {
        const uniqueKey = `${c.province.toLowerCase()}-${c.district.toLowerCase()}-${c.city.toLowerCase()}`;
        existingChargeMap.set(uniqueKey, c);
      });

      // Process each record from the Excel file
      uniqueKeyMap.forEach((excelData, uniqueKey) => {
        const existingCharge = existingChargeMap.get(uniqueKey);

        if (existingCharge) {
          // Record exists, check if charge is different
          if (existingCharge.charge !== excelData.charge) {
            chargesToUpdate.push(excelData);
          }
        } else {
          // Record doesn't exist, needs to be inserted
          chargesToInsert.push(excelData);
        }
      });

      let insertedCount = 0;
      let updatedCount = 0;

      // Process inserts if any
      if (chargesToInsert.length > 0) {
        const insertSql = "INSERT INTO deliverycharge (province, district, city, charge, editBy) VALUES ?";
        const insertValues = chargesToInsert.map((charge) => [
          charge.province,
          charge.district,
          charge.city,
          charge.charge,
          userId
        ]);

        insertedCount = await new Promise((resolve, reject) => {
          collectionofficer.query(
            insertSql,
            [insertValues],
            (err, result) => {
              if (err) return reject(err);
              resolve(result.affectedRows);
            }
          );
        });
      }

      // Process updates if any - using batch update
      if (chargesToUpdate.length > 0) {
        const updatePromises = chargesToUpdate.map((charge) => {
          return new Promise((resolve, reject) => {
            const updateSql = `
              UPDATE deliverycharge 
              SET 
                charge = ?,
                editBy = ?
              WHERE LOWER(province) = ? 
              AND LOWER(district) = ? 
              AND LOWER(city) = ?
            `;
            collectionofficer.query(
              updateSql,
              [
                charge.charge,
                userId,
                charge.province.toLowerCase(),
                charge.district.toLowerCase(),
                charge.city.toLowerCase()
              ],
              (err, result) => {
                if (err) return reject(err);
                resolve(result.affectedRows);
              }
            );
          });
        });

        const updateResults = await Promise.allSettled(updatePromises);
        updatedCount = updateResults
          .filter(result => result.status === 'fulfilled')
          .reduce((sum, result) => sum + result.value, 0);
      }

      resolve({
        inserted: insertedCount,
        updated: updatedCount,
        duplicates: uniqueKeyMap.size - chargesToInsert.length - chargesToUpdate.length,
        message: "Delivery charges processed successfully",
      });
    } catch (error) {
      reject(error);
    }
  });
};

exports.editDeliveryChargeDAO = async (data, id, userId) => {  
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE deliverycharge 
      SET charge = ? , editBy = ?
      WHERE id = ?
    `;

    const values = [data.charge, userId, id];

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.checkPackageDisplayNameExistsDao = async (displayName, id) => {
  return new Promise((resolve, reject) => {
    let sql = " SELECT * FROM marketplacepackages WHERE displayName = ? ";
    const sqlParams = [displayName];

    if (id) {
      sql += " AND id != ? AND isValid = 1";
      sqlParams.push(id);
    }
    marketPlace.query(sql, sqlParams, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.length > 0); // true if exists
      }
    });
  });
};

exports.getAllRetailCustomersDao = (limit, offset, searchText) => {
  return new Promise((resolve, reject) => {
    let countParms = [];
    let dataParms = [];
    let countSql = `
      SELECT 
        COUNT(*) AS total
      FROM marketplaceusers MP
      WHERE 
        MP.buyerType = 'Retail' 
        AND MP.isMarketPlaceUser = 1   
      `;
    let dataSql = `
      SELECT 
        MP.id, 
        MP.title,
        MP.firstName,
        MP.lastName,
        MP.phoneCode,
        MP.phoneNumber,
        MP.cusId,
        MP.email,
        MP.created_at,
        MP.buildingType,
        H.houseNo,
        H.streetName,
        H.city,
        A.buildingNo,
        A.buildingName,
        A.unitNo,
        A.floorNo,
        A.houseNo AS AparthouseNo,
        A.streetName AS ApartstreetName,
        A.city AS Apartcity,
        (
            SELECT COUNT(*)
            FROM orders O
            LEFT JOIN processorders PO ON O.id = PO.orderId
            WHERE O.userId = MP.id
        ) AS totalOrders
      FROM marketplaceusers MP
      LEFT JOIN house H ON MP.id = H.customerId AND MP.buildingType = 'House'
      LEFT JOIN apartment A ON MP.id = A.customerId AND MP.buildingType = 'Apartment'
      WHERE 
        MP.buyerType = 'Retail' 
        AND MP.isMarketPlaceUser = 1   
      `;

    console.log(searchText);

    if (searchText) {
      countSql +=
        " AND (MP.firstName LIKE ? OR MP.lastName LIKE ? OR MP.phoneNumber LIKE ? OR MP.cusId LIKE ? OR CONCAT(MP.firstName, ' ', MP.lastName) LIKE ? OR CONCAT(MP.phoneCode, '-', MP.phoneNumber) LIKE ?) ";
      dataSql +=
        " AND (MP.firstName LIKE ? OR MP.lastName LIKE ? OR MP.phoneNumber LIKE ? OR MP.cusId LIKE ? OR CONCAT(MP.firstName, ' ', MP.lastName) LIKE ? OR CONCAT(MP.phoneCode, '-', MP.phoneNumber) LIKE ?) ";
      const search = `%${searchText}%`;
      countParms.push(search, search, search, search, search, search);
      dataParms.push(search, search, search, search, search, search);
    }

    dataSql += ` LIMIT ? OFFSET ? `;
    dataParms.push(limit);
    dataParms.push(offset);

    marketPlace.query(countSql, countParms, (countErr, countResults) => {
      if (countErr) {
        console.log(countErr);

        reject(countErr);
      } else {
        marketPlace.query(dataSql, dataParms, (dataErr, dataResults) => {
          if (dataErr) {
            console.log(dataErr);

            reject(dataErr);
          } else {
            // console.log(dataResults);

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

exports.getOrderDetailsById = (orderId) => {
  console.log(`[getOrderDetailsById] Fetching details for orderId: ${orderId}`);

  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        mp.id,
        mp.displayName,
        mp.productPrice,
        pd.id AS packageItemId,
        pd.productTypeId,
        pt.shortCode,
        pt.typeName,
        pd.qty
      FROM marketplacepackages mp
      LEFT JOIN packagedetails pd ON mp.id = pd.packageId
      LEFT JOIN producttypes pt ON pd.productTypeId = pt.id
      WHERE mp.id = ?
    `;

    marketPlace.query(sql, [orderId], (err, results) => {
      if (err) {
        console.error(`[getOrderDetailsById] Database error:`, err);
        return reject(new Error(`Database error: ${err.message}`));
      }

      if (!results || results.length === 0) {
        console.log(`[getOrderDetailsById] No order found with id: ${orderId}`);
        return resolve(null);
      }

      try {
        const invNo = undefined;
        const packagesMap = new Map();

        results.forEach((row) => {
          const packageId = row.id;
          if (!packageId) return;

          if (!packagesMap.has(packageId)) {
            packagesMap.set(packageId, {
              packageId: packageId,
              displayName: row.displayName,
              productPrice: row.productPrice || null,
              productTypes: [],
            });
          }

          if (row.productTypeId) {
            const qty = parseInt(row.qty, 10) || 0;
            if (qty > 0) {
              // Create individual objects for each unit
              for (let i = 0; i < qty; i++) {
                packagesMap.get(packageId).productTypes.push({
                  id: row.productTypeId,
                  typeName: row.typeName,
                  shortCode: row.shortCode,
                });
              }
            } else {
              // Handle zero/negative quantities or invalid values
              packagesMap.get(packageId).productTypes.push({
                id: row.productTypeId,
                typeName: row.typeName,
                shortCode: row.shortCode,
                qty: row.qty, // Preserve original value
              });
            }
          }
        });

        const response = {
          invNo: invNo,
          packages: Array.from(packagesMap.values()),
        };

        console.log(`[getOrderDetailsById] Successfully fetched order details`);
        resolve(response);
      } catch (error) {
        console.error(`[getOrderDetailsById] Processing error:`, error);
        reject(new Error(`Failed to process order details: ${error.message}`));
      }
    });
  });
};

exports.getAllMarketplaceItems = (category) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        id,
        varietyId,
        displayName,
        category,
        normalPrice,
        discountedPrice,
        discount,
        promo,
        unitType,
        startValue,
        changeby,
        displayType,
        tags,
        createdAt,
        maxQuantity
      FROM 
        marketplaceitems
        WHERE category = 'Retail'
      ORDER BY 
        createdAt DESC
    `;

    console.log(`[getAllMarketplaceItems] Executing SQL query:`, sql);

    console.log("hello category", category);

    marketPlace.query(sql, [category], (err, results) => {
      if (err) {
        console.error(
          "[getAllMarketplaceItems] Error fetching all marketplace items:",
          err
        );
        return reject(err);
      }

      console.log(
        `[getAllMarketplaceItems] Query results count:`,
        results.length
      );

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
        displayType: row.displayType,
        tags: row.tags ? row.tags.split(",") : [],
        createdAt: row.createdAt,
        maxQuantity: row.maxQuantity,
      }));

      console.log(
        `[getAllMarketplaceItems] Successfully retrieved ${items.length} items`
      );
      resolve(items);
    });
  });
};

exports.getOrderTypeDao = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT buyerType
      FROM processorders POR, orders O, marketplaceusers U
      WHERE POR.orderId = O.id AND O.userId = U.id
    `;
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        console.log("Erro", err);

        reject(err);
      } else {
        resolve(results[0]);
        console.log("``````````result``````````", results[0]);
      }
    });
  });
};

exports.createDefinePackageDao = (packageData, userId) => {
  return new Promise((resolve, reject) => {
    try {
      // Validate inputs
      if (!packageData || !packageData.packageId || !packageData.price) {
        throw new Error("Invalid input parameters");
      }

      const sql = `
        INSERT INTO definepackage (
          packageId, price, adminId
        ) VALUES (?, ?, ?)
      `;

      const values = [
        packageData.packageId,
        parseFloat(packageData.price),
        parseInt(userId),
      ];

      // Database query
      marketPlace.query(sql, values, (err, results) => {
        if (err) {
          console.log("Database error:", err);
          return reject(err);
        }
        resolve(results);
      });
    } catch (error) {
      console.log("Error in createDefinePackageDao:", error);
      reject(error);
    }
  });
};

exports.createDefinePackageItemsDao = (definePackageId, products) => {
  return new Promise((resolve, reject) => {
    try {
      // Validate inputs
      if (!definePackageId || !products || !Array.isArray(products)) {
        throw new Error("Invalid input parameters");
      }

      // Create an array of value arrays for the batch insert
      const values = products.map((product) => [
        definePackageId,
        product.productType,
        product.productId,
        product.qty,
        parseFloat(product.price),
      ]);

      const sql = `
        INSERT INTO definepackageitems (
          definePackageId, productType, productId, qty, price
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
      console.log("Error in createDefinePackageItemsDao:", error);
      reject(error);
    }
  });
};

exports.getAllWholesaleCustomersDao = (limit, offset, searchText) => {
  return new Promise((resolve, reject) => {
    let countParms = [];
    let dataParms = [];
    let countSql = `
      SELECT 
        COUNT(*) AS total
      FROM marketplaceusers MP
      WHERE 
        MP.buyerType = 'Wholesale' 
        AND MP.isMarketPlaceUser = 1   
      `;
    let dataSql = `
      SELECT 
        MP.id, 
        MP.title,
        MP.firstName,
        MP.lastName,
        MP.phoneCode,
        MP.phoneNumber,
        MP.cusId,
        MP.email,
        MP.created_at,
        MP.buildingType,
        MP.companyName,
        H.houseNo,
        H.streetName,
        H.city,
        A.buildingNo,
        A.buildingName,
        A.unitNo,
        A.floorNo,
        A.houseNo AS AparthouseNo,
        A.streetName AS ApartstreetName,
        MP.companyPhoneCode,
        MP.companyPhone,
        A.city AS Apartcity,
        (
            SELECT COUNT(*)
            FROM orders O
            LEFT JOIN processorders PO ON O.id = PO.orderId
            WHERE O.userId = MP.id
        ) AS totalOrders
      FROM marketplaceusers MP
      LEFT JOIN house H ON MP.id = H.customerId AND MP.buildingType = 'House'
      LEFT JOIN apartment A ON MP.id = A.customerId AND MP.buildingType = 'Apartment'
      WHERE 
        MP.buyerType = 'Wholesale' 
        AND MP.isMarketPlaceUser = 1   
      `;

    console.log(searchText);

    if (searchText) {
      countSql += `
        AND (
          CONCAT(MP.firstName, ' ', MP.lastName) LIKE ?
          OR MP.firstName LIKE ?
          OR MP.lastName LIKE ?
          OR MP.phoneNumber LIKE ?
          OR MP.cusId LIKE ?
          OR CONCAT(MP.phoneCode, '-', MP.phoneNumber) LIKE ?
        )
      `;
    
      dataSql += `
        AND (
          CONCAT(MP.firstName, ' ', MP.lastName) LIKE ?
          OR MP.firstName LIKE ?
          OR MP.lastName LIKE ?
          OR MP.phoneNumber LIKE ?
          OR MP.cusId LIKE ?
          OR CONCAT(MP.phoneCode, '-', MP.phoneNumber) LIKE ?
        )
      `;
    
      const search = `%${searchText}%`;
      countParms.push(search, search, search, search, search, search);
      dataParms.push(search, search, search, search, search, search);
    }

    dataSql += ` LIMIT ? OFFSET ? `;
    dataParms.push(limit);
    dataParms.push(offset);

    marketPlace.query(countSql, countParms, (countErr, countResults) => {
      if (countErr) {
        console.log(countErr);

        reject(countErr);
      } else {
        marketPlace.query(dataSql, dataParms, (dataErr, dataResults) => {
          if (dataErr) {
            console.log(dataErr);

            reject(dataErr);
          } else {
            // console.log(dataResults);

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

exports.getUserOrdersDao = async (userId, status) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT DISTINCT
        P.id,
        P.invNo,
        O.sheduleType,
        O.sheduleDate,
        P.paymentMethod,
        P.isPaid,
        O.fullTotal,
        P.createdAt,
        P.status
      FROM processorders P
      JOIN orders O ON P.orderId = O.id
      WHERE O.userId = ? 
    `;

    console.log(status, "-------");

    if (status === "Assinged") {
      sql += " AND P.status = 'Ordered' ";
    } else if (status === "Processing") {
      sql += " AND P.status = 'Processing' ";
    } else if (status === "Delivered") {
      sql += " AND P.status = 'Delivered' ";
    } else if (status === "Cancelled") {
      sql += " AND P.status = 'Cancelled' ";
    } else if (status === "Faild") {
      sql += " AND P.status = 'Faild' ";
    } else if (status === "On the way") {
      sql += " AND P.status = 'On the way' ";
    }else if (status === "Out For Delivery") {
      sql += " AND P.status = 'Out For Delivery' ";
    }

    marketPlace.query(sql, [userId, status], (err, results) => {
      if (err) {
        console.log("Error", err);
        reject(err);
      } else {
        resolve(results);
        // console.log("``````````result``````````", results);
      }
    });
  });
};

exports.getInvoiceDetailsDAO = (processOrderId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        o.id AS orderId,
        o.centerId,
        o.orderApp,
        o.delivaryMethod AS deliveryMethod,
        o.discount AS orderDiscount,
        o.createdAt AS invoiceDate,
        o.sheduleDate AS scheduledDate,
        o.buildingType,
        o.title,
        o.fullName,
        o.phonecode1,
        o.phone1,
        po.invNo AS invoiceNumber,
        po.paymentMethod AS paymentMethod,
        o.fullTotal AS grandTotal,
        mu.email AS userEmail,
        CASE
          WHEN o.buildingType = 'House' THEN oh.houseNo
          WHEN o.buildingType = 'Apartment' THEN oa.houseNo
          ELSE NULL
        END AS houseNo,
        CASE
          WHEN o.buildingType = 'House' THEN oh.streetName
          WHEN o.buildingType = 'Apartment' THEN oa.streetName
          ELSE NULL
        END AS streetName,
        CASE
          WHEN o.buildingType = 'House' THEN oh.city
          WHEN o.buildingType = 'Apartment' THEN oa.city
          ELSE NULL
        END AS city,
        oa.buildingNo,
        oa.buildingName,
        oa.unitNo,
        oa.floorNo
      FROM orders o
      LEFT JOIN processorders po ON o.id = po.orderId
      LEFT JOIN orderhouse oh ON o.id = oh.orderId AND o.buildingType = 'House'
      LEFT JOIN orderapartment oa ON o.id = oa.orderId AND o.buildingType = 'Apartment'
      LEFT JOIN marketplaceusers mu ON o.userId = mu.id  -- Add this join
      WHERE po.id = ?
    `;

    marketPlace.query(sql, [processOrderId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0] || null);
    });
  });
};

exports.getDeliveryChargeByCityDAO = (city) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        id,
        city,
        charge
      FROM deliverycharge
      WHERE city = ?
      LIMIT 1
    `;

    collectionofficer.query(sql, [city], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0] || null);
    });
  });
};

exports.getFamilyPackItemsDAO = (orderId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        op.id,
        mp.id AS packageId,
        mp.displayName AS name,
        (mp.productPrice + mp.packingFee + mp.serviceFee) AS amount
      FROM orderpackage op
      JOIN marketplacepackages mp ON op.packageId = mp.id
      WHERE op.orderId = ?
    `;

    marketPlace.query(sql, [orderId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getAdditionalItemsDAO = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        oai.id,
        mi.displayName AS name,
        oai.unit, 
        oai.price AS unitPrice,
        oai.qty AS quantity,
        oai.normalPrice,
        (oai.price * oai.qty) AS amount,
        oai.discount AS itemDiscount,
        cv.image AS image
      FROM orderadditionalitems oai
      JOIN marketplaceitems mi ON oai.productId = mi.id
      JOIN plant_care.cropvariety cv ON mi.varietyId = cv.id
      WHERE oai.orderId = ?
    `;

    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getBillingDetailsDAO = (orderId, userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        o.title,
        o.fullName,
        o.phoneCode1,
        o.phone1,
        o.buildingType,
        o.couponValue,
        COALESCE(oh.houseNo, oa.houseNo) AS houseNo,
        COALESCE(oh.streetName, oa.streetName) AS street,
        COALESCE(oh.city, oa.city) AS city
      FROM orders o
      LEFT JOIN orderhouse oh ON o.id = oh.orderId
      LEFT JOIN orderapartment oa ON o.id = oa.orderId
      WHERE o.id = ?
      LIMIT 1
    `;

    marketPlace.query(sql, [orderId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0] || null);
    });
  });
};

exports.getPickupCenterDetailsDAO = (centerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM collection_officer.distributedcenter WHERE id = ?
    `;

    marketPlace.query(sql, [centerId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0] || null);
    });
  });
};

exports.getPackageDetailsDAO = (packageId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        pd.packageId,
        pt.id AS productTypeId,
        pt.typeName,
        pd.qty
      FROM packagedetails pd
      JOIN producttypes pt ON pd.productTypeId = pt.id
      WHERE pd.packageId = ?
    `;

    marketPlace.query(sql, [packageId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getCoupenDAO = async (coupenId) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT coupon.id, coupon.code, coupon.type, CAST(coupon.percentage AS DECIMAL(10,2)) AS percentage, coupon.status, coupon.checkLimit, CAST(coupon.priceLimit AS DECIMAL(10,2)) AS priceLimit, CAST(coupon.fixDiscount AS DECIMAL(10,2)) AS fixDiscount, coupon.startDate, coupon.endDate FROM market_place.coupon WHERE coupon.id = ?";

    marketPlace.query(sql, [coupenId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(
          results.map((row) => ({
            ...row,
            percentage:
              row.percentage !== null ? parseFloat(row.percentage) : null,
            priceLimit:
              row.priceLimit !== null ? parseFloat(row.priceLimit) : null,
            fixDiscount:
              row.fixDiscount !== null ? parseFloat(row.fixDiscount) : null,
          }))
        );
      }
    });
  });
};

exports.updateCoupenDAO = async (coupen) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE coupon 
      SET 
        code = ?, 
        type = ?, 
        percentage = ?, 
        status = ?, 
        checkLimit = ?, 
        priceLimit = ?, 
        fixDiscount = ?, 
        startDate = ?, 
        endDate = ?
      WHERE id = ?
    `;

    const values = [
      coupen.code,
      coupen.type,
      coupen.percentage,
      coupen.status,
      coupen.checkLimit,
      coupen.priceLimit,
      coupen.fixDiscount,
      coupen.startDate,
      coupen.endDate,
      coupen.id,
    ];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows); // you can return affected rows or true
      }
    });
  });
};

exports.getPackageEachItemsDao = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        PD.id,
        PT.id AS productTypeId,
        PT.typeName,
        COALESCE(PD.qty, 0) AS qty
      FROM producttypes PT
      LEFT JOIN packagedetails PD ON PT.id = PD.productTypeId
      AND PD.packageId = ?
    `;
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getAllWholesaleOrderDetails = (
  limit,
  offset,
  status,
  method,
  searchItem,
  formattedDate
) => {
  return new Promise((resolve, reject) => {
    let countSql = `
      SELECT COUNT(*) as total 
      FROM market_place.orders o 
      LEFT JOIN market_place.processorders po ON o.id = po.orderId
      LEFT JOIN market_place.marketplaceusers mu ON o.userId = mu.id
    `;

    let sql = `
      SELECT o.id, po.id AS orderId, o.fullName AS customerName, o.delivaryMethod AS method, 
             o.fullTotal AS amount, po.invNo, po.status, o.createdAt AS orderdDate 
      FROM market_place.orders o
      LEFT JOIN market_place.processorders po ON o.id = po.orderId
      LEFT JOIN market_place.marketplaceusers mu ON o.userId = mu.id
    `;

    let whereClause = " WHERE 1=1";
    const searchParams = [];

    // Add the new conditions
    whereClause += " AND mu.buyerType = 'Wholesale'";
    whereClause += " AND o.orderApp = 'Marketplace'";

    if (searchItem) {
      const searchQuery = `%${searchItem.split("").join("%")}%`;
      whereClause += " AND (po.invNo LIKE ? OR o.fullName LIKE ?)";
      searchParams.push(searchQuery, searchQuery);
    }

    if (status) {
      whereClause += " AND po.status = ?";
      searchParams.push(status);
    }

    if (method) {
      whereClause += " AND o.delivaryMethod = ?";
      searchParams.push(method);
    }

    if (formattedDate) {
      whereClause += " AND DATE(o.createdAt) = ?";
      searchParams.push(formattedDate);
    }

    countSql += whereClause;
    sql += whereClause + " ORDER BY po.createdAt DESC LIMIT ? OFFSET ?";
    const dataParams = [...searchParams, limit, offset];

    marketPlace.query(countSql, searchParams, (countErr, countResults) => {
      if (countErr) {
        return reject(countErr);
      }

      const total = countResults[0].total;

      marketPlace.query(sql, dataParams, (dataErr, dataResults) => {
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

exports.deletePackageDetailsItemsDao = async (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
      DELETE FROM packagedetails 
      WHERE id = ?
    `;

    const values = [data.id];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.insertNewPackageDetailsItemsDao = async (id, data) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO packagedetails(packageId, productTypeId, qty)
      VALUES(?, ?, ?)
    `;

    const values = [id, data.productTypeId, data.qty];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getDefinePackageItemsByPackageIdDAO = async (packageId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        dpi.*, 
        pt.shortCode,
        dp.price AS productTypePrice,
        mi.displayName as dN,
        DATE_FORMAT(dp.createdAt, '%Y-%m-%d %H:%i:%s') AS packageCreatedAt
      FROM definepackageitems dpi
      INNER JOIN definepackage dp ON dpi.definePackageId = dp.id
      LEFT JOIN producttypes pt ON dpi.productType = pt.id
      LEFT JOIN marketplaceitems mi ON dpi.productId = mi.id
      WHERE dp.id = (
        SELECT id FROM definepackage 
        WHERE packageId = ?
        ORDER BY createdAt DESC
        LIMIT 1
      )
    `;

    marketPlace.query(sql, [packageId], (err, results) => {
      if (err) {
        reject(err);
      } else if (results.length === 0) {
        resolve({ createdAt: null, items: [], totalPrice: 0 });
      } else {
        const { packageCreatedAt } = results[0];
        const items = results.map(({ packageCreatedAt, ...item }) => item);

        const totalPrice = items.reduce((sum, item) => {
          const price = parseFloat(item.price) || 0;
          const qty = parseInt(item.qty) || 1;
          return sum + price * qty;
        }, 0);

        resolve({ createdAt: packageCreatedAt, items, totalPrice });
      }
    });
  });
};

exports.toDaySalesDao = async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS salesCount, SUM(O.fullTotal) AS total
      FROM processorders PO
      LEFT JOIN orders O ON PO.orderId = O.id
      WHERE DATE(PO.createdAt) = CURDATE()
    `;


    marketPlace.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        let obj = {
          count: results[0].salesCount,
          total: 0.00
        }
        if (results[0].total !== null) {
          obj.total = results[0].total
        }
        resolve(obj);
      }
    });
  });
};

exports.yesterdaySalesDao = async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS salesCount, SUM(O.fullTotal) AS total
      FROM processorders PO
      LEFT JOIN orders O ON PO.orderId = O.id
      WHERE DATE(PO.createdAt) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    `;

    marketPlace.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        let obj = {
          count: results[0].salesCount,
          total: 0.00
        }
        if (results[0].total !== null) {
          obj.total = results[0].total
        }
        resolve(obj);
      }
    });
  });
};

exports.thisMonthSalesDao = async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        COUNT(*) AS salesCount, 
        SUM(O.fullTotal) AS total
      FROM processorders PO
      LEFT JOIN orders O ON PO.orderId = O.id
      WHERE YEAR(PO.createdAt) = YEAR(CURDATE()) AND MONTH(PO.createdAt) = MONTH(CURDATE())
    `;

    marketPlace.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        let obj = {
          count: results[0].salesCount,
          total: 0.00,
        };
        if (results[0].total !== null) {
          obj.total = results[0].total;
        }
        resolve(obj);
      }
    });
  });
};


exports.toDayUserCountDao = async (isToday) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT COUNT(*) AS userCount
      FROM marketplaceusers
      WHERE isMarketPlaceUser = 1 
    `;

    if (isToday) {
      sql += ` AND DATE(created_at) = CURDATE() `
    }

    marketPlace.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {

        resolve(results[0]);
      }
    });
  });
};


exports.salesAnalyzeDao = async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        /* Last 30 days (0-30 days ago) */
        SUM(CASE WHEN PO.createdAt >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) 
                 AND PO.createdAt < CURDATE() THEN O.fullTotal ELSE 0 END) AS last_30_days_total,
                 
        /* Previous 30-60 days */
        SUM(CASE WHEN PO.createdAt >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) 
                 AND PO.createdAt < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN O.fullTotal ELSE 0 END) AS previous_30_to_60_days_total,
                 
        /* Count of orders for last 30 days */
        COUNT(CASE WHEN PO.createdAt >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) 
                   AND PO.createdAt < CURDATE() THEN 1 ELSE NULL END) AS last_30_days_count,
                   
        /* Count of orders for previous 30-60 days */
        COUNT(CASE WHEN PO.createdAt >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) 
                   AND PO.createdAt < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE NULL END) AS previous_30_to_60_days_count
      FROM processorders PO
      LEFT JOIN orders O ON PO.orderId = O.id
      WHERE PO.createdAt >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
    `;

    marketPlace.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {

        if (results[0].last_30_days_total === null) results[0].last_30_days_total = 0;
        if (results[0].previous_30_to_60_days_total === null) results[0].previous_30_to_60_days_total = 0;

        let obj = {
          amount: results[0].last_30_days_total,
          precentage: (results[0].last_30_days_count - results[0].previous_30_to_60_days_count) / results[0].previous_30_to_60_days_count * 100
        }
        resolve(obj);
      }
    });
  });
};


exports.totalMarketOrderCountDao = async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS count
      FROM processorders PO
      LEFT JOIN orders O ON PO.orderId = O.id
      WHERE O.orderApp = 'Marketplace'
    `;

    marketPlace.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};


exports.areaOrderDataDao = async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        DATE_FORMAT(PO.createdAt, '%b') AS month,
        MONTH(PO.createdAt) AS monthNum,
        COUNT(*) AS salesCount, 
        SUM(O.fullTotal) AS total
      FROM processorders PO
      LEFT JOIN orders O ON PO.orderId = O.id
      WHERE PO.createdAt >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 12 MONTH)
        AND PO.createdAt < DATE_FORMAT(NOW(), '%Y-%m-01')
      GROUP BY monthNum, month
      ORDER BY monthNum
    `;

    marketPlace.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        const allMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        // Get current month (1-12)
        const currentMonth = new Date().getMonth() + 1;

        // Initialize with zeros
        const monthlyData = {
          months: [],
          salesCount: [],
          total: []
        };

        // Only include months up to previous month
        allMonths.forEach((month, index) => {
          const monthNumber = index + 1;
          if (monthNumber < currentMonth) {
            monthlyData.months.push(month);

            // Find data for this month
            const monthData = results.find(r => r.monthNum === monthNumber);
            monthlyData.salesCount.push(monthData ? monthData.salesCount : 0);
            monthlyData.total.push(monthData ? monthData.total : 0);
          }
        });

        resolve(monthlyData);
      }
    });
  });
};

exports.pieDataDao = async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT category, SUM(count) as count
      FROM (
        -- Count from order package items
        SELECT G.category, COUNT(DISTINCT PO.id) as count
        FROM processorders PO
        LEFT JOIN orders O ON PO.orderId = O.id
        LEFT JOIN orderpackage OP ON OP.orderId = O.id
        LEFT JOIN orderpackageitems OPI ON OPI.orderPackageId = OP.id
        LEFT JOIN marketplaceitems MPI1 ON OPI.productId = MPI1.id
        LEFT JOIN plant_care.cropvariety V1 ON MPI1.varietyId = V1.id
        LEFT JOIN plant_care.cropgroup G ON V1.cropGroupId = G.id
        WHERE G.category IS NOT NULL
        GROUP BY G.category

        UNION ALL

        -- Count from additional items
        SELECT G.category, COUNT(DISTINCT PO.id) as count
        FROM processorders PO
        LEFT JOIN orders O ON PO.orderId = O.id
        LEFT JOIN orderadditionalitems OAI ON O.id = OAI.orderId
        LEFT JOIN marketplaceitems MPI2 ON OAI.productId = MPI2.id
        LEFT JOIN plant_care.cropvariety V2 ON MPI2.varietyId = V2.id
        LEFT JOIN plant_care.cropgroup G ON V2.cropGroupId = G.id
        WHERE G.category IS NOT NULL
        GROUP BY G.category
      ) combined
      GROUP BY category;
    `;

    marketPlace.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Define the desired category order
        const categoryOrder = ["Vegetables", "Grain", "Fruit", "Mushrooms"];

        // Create a map for quick lookup
        const resultMap = {};
        results.forEach(item => {
          resultMap[item.category] = parseInt(item.count);
        });

        // Build the ordered arrays
        const orderedResponse = {
          category: [],
          count: []
        };

        categoryOrder.forEach(cat => {
          if (resultMap.hasOwnProperty(cat)) {
            orderedResponse.category.push(cat);
            orderedResponse.count.push(resultMap[cat]);
          }
        });

        resolve(orderedResponse);
      }
    });
  });
};


exports.lastFiveOrdersDao = async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        PO.id,
        PO.invNo,
        PO.createdAt,
        PO.paymentMethod,
        PO.status,
        O.fullTotal,
        U.firstName,
        U.lastName
      FROM processorders PO
      LEFT JOIN orders O ON PO.orderId = O.id
      LEFT JOIN marketplaceusers U ON O.userId = U.id
      WHERE O.orderApp = 'Marketplace'
      ORDER BY PO.createdAt DESC
      LIMIT 5
    `;

    marketPlace.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};


exports.toDayUserCountDao = async (isToday) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT COUNT(*) AS userCount
      FROM marketplaceusers
      WHERE isMarketPlaceUser = 1 
    `;

    if (isToday) {
      sql += ` AND DATE(created_at) = CURDATE() `
    }

    marketPlace.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {

        resolve(results[0]);
      }
    });
  });
};

exports.getDefinePackageItemsBeforeDateDAO = async (packageId, providedDate) => {
  return new Promise((resolve, reject) => {
    // Ensure the provided date includes the full day by appending 23:59:59 if no time is specified
    const formattedDate = providedDate.includes(" ") ? providedDate : `${providedDate} 23:59:59`;

    const sql = `
      SELECT 
        dpi.*, 
        pt.shortCode,
        dp.price AS productTypePrice,
        mi.displayName AS dN,
        DATE_FORMAT(dp.createdAt, '%Y-%m-%d %H:%i:%s') AS packageCreatedAt
      FROM definepackageitems dpi
      INNER JOIN definepackage dp ON dpi.definePackageId = dp.id
      LEFT JOIN producttypes pt ON dpi.productType = pt.id
      LEFT JOIN marketplaceitems mi ON dpi.productId = mi.id
      WHERE dp.id = (
        SELECT id 
        FROM definepackage 
        WHERE packageId = ?
        AND createdAt <= ?  
        ORDER BY createdAt DESC
        LIMIT 1
      )
    `;

    marketPlace.query(sql, [packageId, formattedDate], (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length === 0) {
        return resolve({ createdAt: null, items: [], totalPrice: 0 });
      }

      const { packageCreatedAt } = results[0];
      const items = results.map(({ packageCreatedAt, ...item }) => item);

      const totalPrice = items.reduce((sum, item) => {
        const price = parseFloat(item.price) || 0;
        const qty = parseFloat(item.qty) || 1; // Use parseFloat for qty to handle decimal values
        return sum + price * qty;
      }, 0);

      resolve({ createdAt: packageCreatedAt, items, totalPrice });
    });
  });
};

exports.getCouponByCodeDao = async (code) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT code
      FROM coupon
      WHERE code = ?
    `;

    // Assuming 'marketPlace' is your database connection pool
    marketPlace.query(sql, [code], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Return the first matching coupon (or null if not found)
        resolve(results[0] || null);
      }
    });
  });
};


exports.removeMarketplacePckages = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
          UPDATE marketplacepackages 
          SET 
            isValid = 0,
            status = 'Enabled'
          WHERE id = ?`;
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows);
      }
    });
  });
};

exports.checkMarketProductExistsDaoEdit = async (varietyId, displayName, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = "SELECT * FROM marketplaceitems WHERE (varietyId = ? OR displayName = ?)";
    const values = [varietyId, displayName];

    if (excludeId) {
      sql += " AND id != ?";
      values.push(excludeId);
    }

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Check for specific cases
        const varietyExists = results.some(item => item.varietyId == varietyId);
        const nameExists = results.some(item => item.displayName === displayName);

        resolve({
          exists: results.length > 0,
          varietyExists,
          nameExists,
          bothExist: varietyExists && nameExists
        });
      }
    });
  });
};


exports.changePackageStatusDao = async (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE marketplacepackages
      SET status = ?
      WHERE id = ?
    `;

    const values = [data.status, data.id];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};