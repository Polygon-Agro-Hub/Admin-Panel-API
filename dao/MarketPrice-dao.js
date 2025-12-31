const { plantcare, collectionofficer, marketPlace } = require('../startup/database');
const Joi = require('joi');
const path = require('path');


exports.createxlhistory = (xlName) => {
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO xlsxhistory (`xlName`) VALUES (?)";
    const values = [xlName];

    collectionofficer.query(sql, [values], (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Resolve with the inserted ID (xlindex)
        resolve(results.insertId);
        console.log(results.insertId);
      }
    });
  });
};



exports.insertMarketPriceXLSXData = (xlindex, data) => {
  return new Promise((resolve, reject) => {
    // Step 1: Insert data into the marketprice table
    const marketPriceSQL = `
      INSERT INTO marketprice 
      (varietyId, xlindex, grade, price) 
      VALUES ?`;

    const marketPriceValues = data.map((row) => [
      row["Variety Id"],
      xlindex,
      row["Grade"],
      row["Price"]
    ]);

    collectionofficer.query(marketPriceSQL, [marketPriceValues], (err, marketPriceResult) => {
      if (err) {
        return reject(err);
      }

      console.log("Market price data inserted successfully.");

      // Step 2: Fetch all collectionCenterId values
      const fetchCentersSQL = `SELECT id FROM companycenter`;

      collectionofficer.query(fetchCentersSQL, (err, collectionCenters) => {
        if (err) {
          return reject(err);
        }

        if (collectionCenters.length === 0) {
          return resolve({
            message: "No collection centre found. Only market price data inserted.",
            totalRows: data.length,
            insertedRows: marketPriceResult.affectedRows,
          });
        }

        const marketPriceIds = marketPriceResult.insertId; // Start ID of inserted rows
        const totalInsertedRows = marketPriceResult.affectedRows;

        // Generate rows for marketpriceserve
        const marketPriceServeValues = [];
        for (let i = 0; i < totalInsertedRows; i++) {
          const marketPriceId = marketPriceIds + i;
          const price = marketPriceValues[i][3]; // Fetch price from marketPriceValues
          const updatedPrice = marketPriceValues[i][3];

          collectionCenters.forEach((center) => {
            marketPriceServeValues.push([
              marketPriceId,
              xlindex,
              price, // Use the price as newPrice
              updatedPrice,
              center.id,
            ]);
          });
        }

        // Step 3: Insert data into the marketpriceserve table
        const marketPriceServeSQL = `
          INSERT INTO marketpriceserve 
          (marketPriceId, xlindex, price, updatedPrice, companyCenterId) 
          VALUES ?`;

          collectionofficer.query(marketPriceServeSQL, [marketPriceServeValues], (err, marketPriceServeResult) => {
          if (err) {
            return reject(err);
          }

          console.log("Market price serve data inserted successfully.");

          resolve({
            message: "All data validated and inserted successfully",
            totalRows: data.length,
            insertedRows: marketPriceResult.affectedRows,
            serveInsertedRows: marketPriceServeResult.affectedRows,
          });
        });
      });
    });
  });
};




  exports.getAllxlsxlist = (limit, offset) => {
    return new Promise((resolve, reject) => {
      const countSql = "SELECT COUNT(*) as total FROM xlsxhistory";
      const dataSql =
        `SELECT * FROM xlsxhistory  
  ORDER BY createdAt DESC 
  LIMIT ? OFFSET ?`;
  
  collectionofficer.query(countSql, (countErr, countResults) => {
        if (countErr) {
          reject(countErr);
        } else {
          collectionofficer.query(dataSql, [limit, offset], (dataErr, dataResults) => {
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

  exports.deleteXl = (id) => {
    const sql = "DELETE FROM xlsxhistory WHERE id = ?";
  
    return new Promise((resolve, reject) => {
      collectionofficer.query(sql, [id], (err, results) => {
        if (err) {
          reject("Error executing delete query: " + err);
        } else {
          resolve(results);
        }
      });
    });
  };



exports.getXLSXFilePath = async (fileName) => {
  try {
    // Assuming files are stored in a specific directory (e.g., 'uploads/xlsx')
    const filePath = path.join(__dirname, '../files', fileName);
    console.log(filePath);

    // Check if the file exists on the server (Optional)
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return null; // File does not exist
    }

    return filePath;
  } catch (error) {
    console.error('Error retrieving XLSX file path:', error);
    throw error;
  }
};





exports.getAllMarketPriceDAO = (crop, grade, search) => {
  return new Promise((resolve, reject) => {
    const params = [];
    const countParams = [];

    let countSql = `
      SELECT COUNT(*) as total
      FROM marketprice m
      JOIN plant_care.cropvariety cv ON m.varietyId = cv.id
      JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      WHERE 1=1
    `;
    let sql = `
      SELECT 
        m.id,
        cg.cropNameEnglish AS cropName,
        cv.varietyNameEnglish AS varietyName,
        m.grade,
        m.price,
        m.createdAt
      FROM marketprice m
      JOIN plant_care.cropvariety cv ON m.varietyId = cv.id
      JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      WHERE 1=1
    `;

    // Add filters if crop or grade is provided
    if (crop) {
      sql += " AND cg.id = ?";
      countSql += " AND cg.id = ?";
      params.push(crop);
      countParams.push(crop);
    }

    if (grade) {
      sql += " AND m.grade = ?";
      countSql += " AND m.grade = ?";
      params.push(grade);
      countParams.push(grade);
    }

    if (search) {
      sql += " AND cg.cropNameEnglish LIKE ?";
      countSql += " AND cg.cropNameEnglish LIKE ?";
      const searchQuery = `%${search}%`;
      params.push(searchQuery);
      countParams.push(searchQuery);
    }

    sql += ` ORDER BY cg.cropNameEnglish, cv.varietyNameEnglish, m.grade`;
   
    

    // Execute the count query
    collectionofficer.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Count Query Error:", countErr.message || countErr);
        return reject(countErr);
      }

      // Execute the main query
      collectionofficer.query(sql, params, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Data Query Error:", dataErr.message || dataErr);
          return reject(dataErr);
        }

        resolve({
          results: dataResults,
          total: countResults[0].total,
        });
      });
    });
  });
};











exports.getAllCropNameDAO = () => {
  return new Promise((resolve, reject) => {
    const sql = `
        SELECT id, cropNameEnglish
        FROM cropgroup  
        `;

        plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};



exports.getAllxlsxlistCount = () => {
  return new Promise((resolve, reject) => {
    const countSql = "SELECT COUNT(*) as total FROM xlsxhistory";


collectionofficer.query(countSql, (countErr, countResults) => {
      if (countErr) {
        reject(countErr);
      } else {
         
        resolve({
          total: countResults[0].total,
        });
      
      
      }
    });
  });
};






exports.getAllMarketPriceAgroDAO = (crop, grade, search, centerId, companyId) => {
  return new Promise((resolve, reject) => {
    const params = [];
    const countParams = [];
    console.log(centerId, companyId);
    // First, get the companyCenterId based on centerId and companyId
    let companyCenterSql = `
      SELECT id 
      FROM companycenter 
      WHERE centerId = ? AND companyId = ?
    `;

    collectionofficer.query(companyCenterSql, [centerId, companyId], (ccErr, ccResults) => {
      if (ccErr) {
        console.error("CompanyCenter Query Error:", ccErr.message || ccErr);
        return reject(ccErr);
      }

      if (!ccResults || ccResults.length === 0) {
        return resolve({
          results: [],
          total: 0,
          message: "No company center found for the provided centerId and companyId"
        });
      }

      const companyCenterId = ccResults[0].id;
      console.log('this is the selelcted companycenter ID',companyCenterId);

      // Now build the main queries using the companyCenterId
      let countSql = `
        SELECT COUNT(*) as total
        FROM marketpriceserve ms
        JOIN marketprice m ON ms.marketPriceId = m.id
        JOIN plant_care.cropvariety cv ON m.varietyId = cv.id
        JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
        WHERE ms.companyCenterId = ?
      `;
      
      let sql = `
        SELECT 
          m.id,
          cg.cropNameEnglish AS cropName,
          cv.varietyNameEnglish AS varietyName,
          m.grade,
          ms.price,
          ms.updatedPrice,
          ms.updateAt,
          m.createdAt
        FROM marketpriceserve ms
        JOIN marketprice m ON ms.marketPriceId = m.id
        JOIN plant_care.cropvariety cv ON m.varietyId = cv.id
        JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
        WHERE ms.companyCenterId = ?
      `;

      // Add companyCenterId as the first parameter
      params.push(companyCenterId);
      countParams.push(companyCenterId);

      // Add filters if crop or grade is provided
      if (crop) {
        sql += " AND cg.id = ?";
        countSql += " AND cg.id = ?";
        params.push(crop);
        countParams.push(crop);
      }

      if (grade) {
        sql += " AND m.grade = ?";
        countSql += " AND m.grade = ?";
        params.push(grade);
        countParams.push(grade);
      }

      if (search) {
        sql += " AND cg.cropNameEnglish LIKE ? OR cv.varietyNameEnglish LIKE ?";
        countSql += " AND cg.cropNameEnglish LIKE ? OR cv.varietyNameEnglish LIKE ?";
        const searchQuery = `%${search}%`;
        params.push(searchQuery, searchQuery);
        countParams.push(searchQuery, searchQuery);
      }

      sql += ` ORDER BY cg.cropNameEnglish, cv.varietyNameEnglish, m.grade`;

      // Execute the count query
      collectionofficer.query(countSql, countParams, (countErr, countResults) => {
        if (countErr) {
          console.error("Count Query Error:", countErr.message || countErr);
          return reject(countErr);
        }

        // Execute the main query
        collectionofficer.query(sql, params, (dataErr, dataResults) => {
          if (dataErr) {
            console.error("Data Query Error:", dataErr.message || dataErr);
            return reject(dataErr);
          }

          resolve({
            results: dataResults,
            total: countResults[0].total,
          });
        });
      });
    });
  });
};