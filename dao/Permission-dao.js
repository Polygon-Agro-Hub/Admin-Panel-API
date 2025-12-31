const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
} = require("../startup/database");

exports.getAllFeatures = () => {
  return new Promise((resolve, reject) => {
    const sql = `
                  SELECT 
                    fe.id, 
                    fe.name,
                    fc.id AS categoryId,
                    fc.category
                  FROM 
                    features fe
                  JOIN 
                    featurecategory fc ON fe.category = fc.id`;

    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results); // No need to wrap in arrays, return results directly
    });
  });
};

exports.getAllRoleFeatures = (roleId) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM rolefeatures WHERE roleId = ?";

    admin.query(sql, roleId, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results); // No need to wrap in arrays, return results directly
    });
  });
};

exports.createRoleFeature = async (role_id, position_id, feature_id) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO rolefeatures (roleId, positionId, featureId) VALUES (?, ?, ?)";
    const values = [role_id, position_id, feature_id];

    admin.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.insertId);
      }
    });
  });
};

exports.createCategoryDao = async (category_id) => {
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO featurecategory (category) VALUES (?)";
    const values = [category_id];

    admin.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve({ id: results.insertId });
      }
    });
  });
};


exports.createFeature = async (category_id, feature) => {
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO features (name, category) VALUES (?, ?)";
    const values = [feature.trim(), category_id];

    admin.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.insertId);
      }
    });
  });
};

exports.deleteRoleFeature = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM rolefeatures WHERE id = ?";
    admin.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.createAdminRole = async (role, email) => {
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO adminroles (role, email) VALUES (?, ?)";
    const values = [role, email];

    admin.query(sql, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.insertId); // Return the ID of the newly inserted row
      }
    });
  });
};




exports.getAllFeatureCategories = () => {
  return new Promise((resolve, reject) => {
    const sql = `
                  SELECT * FROM featurecategory`;

    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results); // No need to wrap in arrays, return results directly
    });
  });
};


exports.editFeatureName = (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
                  UPDATE features
                  SET name = ?
                  WHERE id = ?
              `;

    admin.query(sql, [data.name, data.id], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results); // No need to wrap in arrays, return results directly
    });
  });
};


exports.editCategoryName = (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
                  UPDATE featurecategory
                  SET category = ?
                  WHERE id = ?
              `;

    admin.query(sql, [data.name, data.id], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }

      resolve(results); // No need to wrap in arrays, return results directly
    });
  });
};


exports.CheckFeatureDao = async (name) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT *
      FROM features
      WHERE name = ?
    `
    const values = [name];

    admin.query(sql, values, (err, results) => {
      if (err) {
        console.log(err);

        reject(err);
      } else {
        console.log(results);

        resolve(results);
      }
    });
  });
};