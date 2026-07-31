const {
  plantcare,
  collectionofficer,
  marketPlace,
  investment,
} = require("../startup/database");
const Joi = require("joi");
const path = require("path");

exports.allCropGroups = () => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT id, cropNameEnglish FROM cropgroup ORDER BY cropNameEnglish ASC";

    plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }

      resolve(results);
    });
  });
};

exports.createCropGroup = async (
  cropNameEnglish,
  cropNameSinhala,
  cropNameTamil,
  category,
  costFeild,
  incomeFeild,
  image,
  bgColor,
  seedRate,
  rowSpace,
  plantSpace,
  AvgYield,
  nitrogen,
  phosphorus,
  potassium,
) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO cropgroup (cropNameEnglish, cropNameSinhala, cropNameTamil, category, costFeild, incomeFeild, image, bgColor, seedRate, rowSpace, plantSpace, AvgYield, nitrogen, phosphorus, potassium) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [
      cropNameEnglish,
      cropNameSinhala,
      cropNameTamil,
      category,
      costFeild,
      incomeFeild,
      image,
      bgColor,
      seedRate,
      rowSpace,
      plantSpace,
      AvgYield,
      nitrogen,
      phosphorus,
      potassium,
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

exports.getAllCropGroups = (limit, offset, searchText, category) => {
  return new Promise((resolve, reject) => {
    const dataParams = [];
    const countParams = [];
    let countSql = "SELECT COUNT(*) AS total FROM cropgroup cg";
    let dataSql = `
        SELECT 
          cg.*,
          COUNT(cv.id) as varietyCount,
          GROUP_CONCAT(DISTINCT cv.varietyNameEnglish) as varietyList
        FROM 
          cropgroup cg
        LEFT JOIN 
          cropvariety cv ON cg.id = cv.cropGroupId
      `;

    const whereConditions = [];

    if (searchText) {
      whereConditions.push("cg.cropNameEnglish LIKE ?");
      dataParams.push(`%${searchText}%`);
      countParams.push(`%${searchText}%`);
    }

    if (category) {
      whereConditions.push("cg.category = ?");
      dataParams.push(category);
      countParams.push(category);
    }

    if (whereConditions.length > 0) {
      const whereClause = " WHERE " + whereConditions.join(" AND ");
      dataSql += whereClause;
      countSql += whereClause;
    }

    dataSql += `
        GROUP BY 
          cg.id
        ORDER BY 
          cg.cropNameEnglish ASC
        LIMIT ? OFFSET ?
      `;
    dataParams.push(limit, offset);

    plantcare.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        reject(countErr);
      } else {
        plantcare.query(dataSql, dataParams, (dataErr, dataResults) => {
          if (dataErr) {
            reject(dataErr);
          } else {
            const processedResults = dataResults.map((row) => ({
              ...row,
              varietyList: row.varietyList ? row.varietyList.split(",") : [],
            }));

            resolve({
              total: countResults[0].total,
              items: processedResults,
            });
          }
        });
      }
    });
  });
};

exports.deleteCropGroup = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM cropgroup WHERE id = ?";
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows);
      }
    });
  });
};

exports.createCropVariety = async (
  cropGroupId,
  varietyNameEnglish,
  varietyNameSinhala,
  varietyNameTamil,
  descriptionEnglish,
  descriptionSinhala,
  descriptionTamil,
  image,
  bgColor,
) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO cropvariety (cropGroupId, varietyNameEnglish, varietyNameSinhala, varietyNameTamil, descriptionEnglish, descriptionSinhala, descriptionTamil, image, bgColor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [
      cropGroupId,
      varietyNameEnglish,
      varietyNameSinhala,
      varietyNameTamil,
      descriptionEnglish,
      descriptionSinhala,
      descriptionTamil,
      image,
      bgColor,
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

exports.allCropVariety = (cropGroupId) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT id, varietyNameEnglish FROM cropvariety WHERE cropGroupId = ? ORDER BY varietyNameEnglish ASC ";

    plantcare.query(sql, [cropGroupId], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.createCropCallender = async (
  cropVarietyId,
  method,
  natOfCul,
  cropDuration,
  suitableAreas,
  specialNotes,
) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO cropcalender (cropVarietyId  , method, natOfCul, cropDuration, suitableAreas, specialNotes) VALUES (?, ?, ?, ?, ?, ?)";
    const values = [
      cropVarietyId,
      method,
      natOfCul,
      cropDuration,
      suitableAreas,
      specialNotes,
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

exports.insertXLSXData = (cropId, data) => {
  return new Promise((resolve, reject) => {
    const schema = Joi.object({
      "Task index": Joi.number().required(),
      Day: Joi.number().integer().required(),
      "Task type (English)": Joi.string().required(),
      "Task type (Sinhala)": Joi.string().required(),
      "Task type (Tamil)": Joi.string().required(),
      "Task Category (English)": Joi.string().required(),
      "Task Category (Sinhala)": Joi.string().required(),
      "Task Category (Tamil)": Joi.string().required(),
      "Task (English)": Joi.string().required(),
      "Task (Sinhala)": Joi.string().required(),
      "Task (Tamil)": Joi.string().required(),
      "Task description (English)": Joi.string().required(),
      "Task description (Sinhala)": Joi.string().required(),
      "Task description (Tamil)": Joi.string().required(),
      "Image Link": Joi.string().required(),
      "Video Link English": Joi.string().required(),
      "Video Link Sinhala": Joi.string().required(),
      "Video Link Tamil": Joi.string().required(),
      "Required Images": Joi.number().required(),
    }).required();

    const validatedData = [];
    for (let i = 0; i < data.length; i++) {
      const { error, value } = schema.validate(data[i]);
      if (error) {
        return reject(
          new Error(
            `Validation error in row ${i + 1}: ${error.details[0].message}`,
          ),
        );
      }
      validatedData.push(value);
    }

    const sql = `
        INSERT INTO cropcalendardays 
        (cropId, taskIndex, days, taskTypeEnglish, taskTypeSinhala, taskTypeTamil, 
        taskCategoryEnglish, taskCategorySinhala, taskCategoryTamil, 
        taskEnglish, taskSinhala, taskTamil, 
        taskDescriptionEnglish, taskDescriptionSinhala, taskDescriptionTamil, imageLink, videoLinkEnglish, videoLinkSinhala, videoLinkTamil, reqImages) 
        VALUES ?`;

    const values = validatedData.map((row) => [
      cropId,
      row["Task index"],
      row.Day,
      row["Task type (English)"],
      row["Task type (Sinhala)"],
      row["Task type (Tamil)"],
      row["Task Category (English)"],
      row["Task Category (Sinhala)"],
      row["Task Category (Tamil)"],
      row["Task (English)"],
      row["Task (Sinhala)"],
      row["Task (Tamil)"],
      row["Task description (English)"],
      row["Task description (Sinhala)"],
      row["Task description (Tamil)"],
      row["Image Link"],
      row["Video Link English"],
      row["Video Link Sinhala"],
      row["Video Link Tamil"],
      row["Required Images"],
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

exports.getAllVarietyByGroup = (cropGroupId) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM cropvariety WHERE cropGroupId = ?";

    plantcare.query(sql, [cropGroupId], (err, results) => {
      if (err) {
        return reject(err);
      }
      const processedDataResults = results.map((variety) => {
        return variety;
      });

      resolve(processedDataResults);
    });
  });
};

exports.deleteCropVariety = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM cropvariety WHERE id = ?";
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows);
      }
    });
  });
};

exports.getGroupById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM cropgroup WHERE id = ?";

    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      const processedDataResults = results.map((variety) => {
        return variety;
      });
      resolve(processedDataResults);
    });
  });
};

exports.getGroupByIds3 = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM cropgroup WHERE id = ?";
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      if (results.length === 0) {
        return resolve(null);
      }
      resolve(results[0]);
    });
  });
};

exports.getVarietyByIds3 = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM cropvariety WHERE id = ?";
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      if (results.length === 0) {
        return resolve(null);
      }
      resolve(results[0]);
    });
  });
};

exports.getVarietyById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM cropvariety WHERE id = ?";

    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      const processedDataResults = results.map((variety) => {
        return variety;
      });
      resolve(processedDataResults);
    });
  });
};

exports.updateGroup = (newsData, id) => {
  return new Promise((resolve, reject) => {
    const {
      cropNameEnglish,
      cropNameSinhala,
      cropNameTamil,
      category,
      costFeild,
      incomeFeild,
      bgColor,
      image,
      seedRate,
      rowSpace,
      plantSpace,
      AvgYield,
      nitrogen,
      phosphorus,
      potassium,
    } = newsData;

    let sql = `
            UPDATE cropgroup 
            SET 
                cropNameEnglish = ?, 
                cropNameSinhala = ?, 
                cropNameTamil = ?, 
                category = ?,
                costFeild = ?,
                incomeFeild = ?,
                bgColor = ?,
                seedRate = ?,
                rowSpace = ?,
                plantSpace = ?,
                AvgYield = ?,
                nitrogen = ?,
                phosphorus = ?,
                potassium = ?
        `;

    let values = [
      cropNameEnglish,
      cropNameSinhala,
      cropNameTamil,
      category,
      costFeild,
      incomeFeild,
      bgColor,
      seedRate,
      rowSpace,
      plantSpace,
      AvgYield,
      nitrogen,
      phosphorus,
      potassium,
    ];

    if (image) {
      sql += `, image = ?`;
      values.push(image);
    }

    sql += ` WHERE id = ?`;
    values.push(id);

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.updateCropVariety = (id, updates) => {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    const sql = `UPDATE cropvariety SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);

    plantcare.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

exports.getAllCropCalendars = (limit, offset, searchText, category) => {
  return new Promise((resolve, reject) => {
    let countSql = `
      SELECT COUNT(*) AS total 
      FROM cropcalender
      LEFT JOIN cropvariety ON cropcalender.cropVarietyId = cropvariety.id
      LEFT JOIN cropgroup ON cropvariety.cropGroupId = cropgroup.id
    `;

    let dataSql = `
      SELECT 
        cropcalender.id,
        cropcalender.method,
        cropcalender.natOfCul,
        cropcalender.cropDuration,
        cropgroup.cropNameEnglish,
        cropgroup.category,
        cropvariety.varietyNameEnglish
      FROM 
        cropcalender
      LEFT JOIN cropvariety ON cropcalender.cropVarietyId = cropvariety.id
      LEFT JOIN cropgroup ON cropvariety.cropGroupId = cropgroup.id
    `;

    const conditions = [];
    const params = [];

    if (searchText) {
      conditions.push(`(
        cropgroup.cropNameEnglish LIKE ?
        OR cropvariety.varietyNameEnglish LIKE ?
        OR cropgroup.category LIKE ?
        OR cropcalender.method LIKE ?
        OR cropcalender.natOfCul LIKE ?
        OR cropcalender.cropDuration LIKE ?
      )`);
      const searchValue = `%${searchText}%`;
      params.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
      );
    }

    if (category) {
      conditions.push(`cropgroup.category = ?`);
      params.push(category);
    }

    if (conditions.length > 0) {
      const whereClause = " WHERE " + conditions.join(" AND ");
      countSql += whereClause;
      dataSql += whereClause;
    }

    limit = parseInt(limit, 10) || 10;
    offset = parseInt(offset, 10) || 0;

    dataSql += "ORDER BY cropgroup.cropNameEnglish, cropvariety.varietyNameEnglish";
    const dataParams = [...params, limit, offset];

    plantcare.query(countSql, params, (countErr, countResults) => {
      if (countErr) {
        reject(countErr);
      } else {
        plantcare.query(dataSql, dataParams, (dataErr, dataResults) => {
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

exports.updateCropCalender = async (id, updateData) => {
  return new Promise((resolve, reject) => {
    let sql = `
            UPDATE cropcalender 
            SET 
                method = ?,
                natOfCul = ?, 
                cropDuration = ?,
                specialNotes = ?,
                suitableAreas = ?
        `;

    let values = [
      updateData.method,
      updateData.natOfCul,
      updateData.cropDuration,
      updateData.specialNotes,
      updateData.suitableAreas,
    ];

    sql += ` WHERE id = ?`;
    values.push(id);

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows);
      }
    });
  });
};

exports.deleteCropCalender = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM cropcalender WHERE id = ?";
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows);
      }
    });
  });
};

exports.getAllTaskByCropId = (cropId, limit, offset) => {
  return new Promise((resolve, reject) => {
    const countSql =
      "SELECT COUNT(*) as total FROM cropcalender cc, cropcalendardays cd WHERE cc.id = cd.cropId AND cc.id = ?";
    const sql = `
            SELECT * 
            FROM cropcalender cc 
            JOIN cropcalendardays cd ON cc.id = cd.cropId 
            WHERE cc.id = ?
            ORDER BY cd.taskIndex 
            `;
    const values = [cropId];

    plantcare.query(countSql, [cropId], (countErr, countResults) => {
      if (countErr) {
        reject(countErr);
      } else {
        plantcare.query(
          sql,
          [cropId, parseInt(limit), parseInt(offset)],
          (dataErr, dataResults) => {
            if (dataErr) {
              reject(dataErr);
            } else {
              resolve({
                results: dataResults,
                total: countResults[0].total,
              });
            }
          },
        );
      }
    });
  });
};

exports.updateVariety = (newsData, id) => {
  return new Promise((resolve, reject) => {
    const {
      varietyNameEnglish,
      varietyNameSinhala,
      varietyNameTamil,
      descriptionEnglish,
      descriptionSinhala,
      descriptionTamil,
      bgColor,
      image,
    } = newsData;

    let sql = `
          UPDATE cropvariety 
          SET 
              varietyNameEnglish = ?, 
              varietyNameSinhala = ?, 
              varietyNameTamil = ?, 
               descriptionEnglish = ?, 
              descriptionSinhala = ?, 
              descriptionTamil = ?, 
              bgColor = ?
      `;

    let values = [
      varietyNameEnglish,
      varietyNameSinhala,
      varietyNameTamil,
      descriptionEnglish,
      descriptionSinhala,
      descriptionTamil,
      bgColor,
    ];

    if (image) {
      sql += `, image = ?`;
      values.push(image);
    }

    sql += ` WHERE id = ?`;
    values.push(id);

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.checkCropGroup = (engName) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM cropgroup WHERE cropNameEnglish LIKE ?";

    plantcare.query(sql, [engName], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.checkCropVerity = (id, engName) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT * FROM cropvariety WHERE cropGroupId = ? AND varietyNameEnglish LIKE ?";

    plantcare.query(sql, [id, engName], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.checkExistanceCropCalander = async (
  id,
  cultivationMethod,
  natureOfCultivation,
  excludeId,
) => {
  return new Promise((resolve, reject) => {
    let sql =
      "SELECT * FROM cropcalender WHERE cropVarietyId = ? AND method = ? AND natOfCul = ?";
    const params = [id, cultivationMethod, natureOfCultivation];

    if (excludeId) {
      sql += " AND id != ?";
      params.push(excludeId);
    }

    plantcare.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.cropGroupsDao = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT id, cropNameEnglish FROM cropgroup";
    plantcare.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getAllCropGroupEnglishNamesOnly = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, cropNameEnglish 
      FROM cropgroup 
      ORDER BY cropNameEnglish ASC
    `;
    plantcare.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};
