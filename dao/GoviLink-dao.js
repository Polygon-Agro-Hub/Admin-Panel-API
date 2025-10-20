const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
  dash,
} = require("../startup/database");

exports.checkCompanyDisplayNameDao = async (companyName, regNumber, id) => {
  return new Promise((resolve, reject) => {
    let sql =
      "SELECT * FROM feildcompany WHERE (companyName = ? OR RegNumber = ?)";
    const sqlParams = [companyName, regNumber];

    if (id) {
      sql += " AND id != ?";
      sqlParams.push(id);
    }

    plantcare.query(sql, sqlParams, (err, results) => {
      if (err) {
        reject(err);
      } else {
        // Check if either companyName or RegNumber already exists
        const nameExists = results.some(
          (result) => result.companyName === companyName
        );
        const regNumberExists = results.some(
          (result) => result.RegNumber === regNumber
        );

        resolve({
          exists: results.length > 0,
          nameExists,
          regNumberExists,
        });
      }
    });
  });
};

exports.createCompany = async (
  regNumber,
  companyName,
  email,
  financeOfficerName,
  accName,
  accNumber,
  bank,
  branch,
  phoneCode1,
  phoneNumber1,
  phoneCode2,
  phoneNumber2,
  logo, // This will now be the S3 URL or undefined
  modifyBy
) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO feildcompany (companyName, RegNumber, email, financeOfficerName, accName, accNumber, bank, branch, phoneCode1, phoneNumber1, phoneCode2, phoneNumber2, logo, modifyBy, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW())";

    // Handle undefined logo - set to NULL in database
    const logoValue = logo !== undefined ? logo : null;

    console.log("DAO - Logo value:", logoValue); // Debug log

    const values = [
      companyName,
      regNumber,
      email,
      financeOfficerName,
      accName,
      accNumber,
      bank,
      branch,
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      logoValue, // Use the handled logo value
      modifyBy,
    ];

    console.log("DAO - Executing query with values:", values); // Debug log

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        console.error("DAO - Database error:", err); // Debug log
        reject(err);
      } else {
        console.log("DAO - Insert successful, ID:", results.insertId); // Debug log
        resolve(results.insertId);
      }
    });
  });
};

exports.getCompanyDAO = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM feildcompany WHERE id = ?`;
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

// officerService.dao.js

exports.saveOfficerService = (englishName, tamilName, sinhalaName, srvFee) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO plant_care.officerservices (englishName, tamilName, sinhalaName, srvFee) 
      VALUES (?, ?, ?, ?)
    `;

    admin.query(
      sql,
      [englishName, tamilName, sinhalaName, srvFee],
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            message: "Officer service saved successfully",
            insertId: result.insertId,
          });
        }
      }
    );
  });
};

exports.getAllCompanyDAO = (searchTerm) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        fc.id,
        fc.companyName,
        fc.RegNumber,
        fc.email,
        fc.financeOfficerName,
        fc.accName,
        fc.accNumber,
        fc.bank,
        fc.branch,
        fc.phoneCode1,
        fc.phoneNumber1,
        fc.phoneCode2,
        fc.phoneNumber2,
        fc.logo,
        fc.modifyBy,
        au.userName as modifierName,  -- Get userName from adminusers
        fc.createdAt
      FROM 
        feildcompany fc
      LEFT JOIN 
        agro_world_admin.adminusers au ON fc.modifyBy = au.id
      WHERE 1=1
    `;

    const params = [];

    if (searchTerm && searchTerm.trim()) {
      sql +=
        " AND (fc.companyName LIKE ? OR fc.email LIKE ? OR fc.RegNumber LIKE ?)";
      const trimmed = `%${searchTerm.trim()}%`;
      params.push(trimmed, trimmed, trimmed);
    }

    plantcare.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.updateCompany = (
  id,
  regNumber,
  companyName,
  email,
  financeOfficerName,
  accName,
  accNumber,
  bank,
  branch,
  phoneCode1,
  phoneNumber1,
  phoneCode2,
  phoneNumber2,
  logo,
  modifyBy
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE feildcompany SET 
        regNumber = ?,
        companyName = ?,
        email = ?,
        financeOfficerName = ?,
        accName = ?,
        accNumber = ?,
        bank = ?,
        branch = ?,
        phoneCode1 = ?,
        phoneNumber1 = ?,
        phoneCode2 = ?,
        phoneNumber2 = ?,
        logo = ?,
        modifyBy = ?,
        createdAt = NOW()
      WHERE id = ?
    `;

    const values = [
      regNumber,
      companyName,
      email,
      financeOfficerName,
      accName,
      accNumber,
      bank,
      branch,
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      logo,
      modifyBy,
      id,
    ];

    plantcare.query(sql, values, (err, results) => {
      if (err) {
        console.error("Database error details:", err);
        return reject(err);
      }
      console.log("Update successful:", results);
      resolve(results);
    });
  });
};

exports.deleteCompanyById = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM feildcompany WHERE id = ?";
    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows);
      }
    });
  });
};

// Update Officer Service by ID
exports.updateOfficerService = (
  id,
  englishName,
  tamilName,
  sinhalaName,
  srvFee,
  modifyBy
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE plant_care.officerservices
      SET englishName = ?, tamilName = ?, sinhalaName = ?, srvFee = ?, modifyBy = ?
      WHERE id = ?
    `;

    admin.query(
      sql,
      [englishName, tamilName, sinhalaName, srvFee, modifyBy, id], // <-- include id here
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.affectedRows === 0) {
            reject(new Error("No officer service found with the given ID"));
          } else {
            resolve({
              message: "Officer service updated successfully",
              affectedRows: result.affectedRows,
            });
          }
        }
      }
    );
  });
};

// Get Officer Service by ID
exports.getOfficerServiceById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, englishName, tamilName, sinhalaName, srvFee
      FROM plant_care.officerservices
      WHERE id = ?
    `;

    admin.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        if (results.length === 0) {
          reject(new Error("No officer service found with the given ID"));
        } else {
          resolve(results[0]); // return single service
        }
      }
    });
  });
};

exports.getAllOfficerServices = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT os.id, os.englishName, os.tamilName, os.sinhalaName, os.srvFee,
             au.userName AS modifiedByUser
      FROM plant_care.officerservices AS os
      LEFT JOIN agro_world_admin.adminusers AS au
        ON os.modifyBy = au.id
      WHERE os.isValid = 1
    `;

    admin.query(sql, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results); // each row will now include modifiedByUser
      }
    });
  });
};

// Delete an officer service by ID
exports.deleteOfficerServiceById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE plant_care.officerservices 
                 SET isValid = 0 
                 WHERE id = ?`;

    admin.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          message: "Service marked as invalid successfully",
          affectedRows: results.affectedRows,
        });
      }
    });
  });
};

exports.getAllCompanyDAO = (searchTerm) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        fc.id,
        fc.companyName,
        fc.RegNumber,
        fc.email,
        fc.financeOfficerName,
        fc.accName,
        fc.accNumber,
        fc.bank,
        fc.branch,
        fc.phoneCode1,
        fc.phoneNumber1,
        fc.phoneCode2,
        fc.phoneNumber2,
        fc.logo,
        fc.modifyBy,
        au.userName as modifierName,  -- Get userName from adminusers
        fc.createdAt,
        (
          SELECT COUNT(*)
          FROM feildofficer fo1
          WHERE fo1.companyId = fc.id AND fo1.empId LIKE 'CFO%' AND fo1.status = 'Aproved'
        ) AS cfoCount,
        (
          SELECT COUNT(*)
          FROM feildofficer fo2
          WHERE fo2.companyId = fc.id AND fo2.empId LIKE 'FIO%' AND fo2.status = 'Aproved'
        ) AS fioCount
      FROM 
        feildcompany fc
      LEFT JOIN 
        agro_world_admin.adminusers au ON fc.modifyBy = au.id
      WHERE 1=1
    `;

    const params = [];

    if (searchTerm && searchTerm.trim()) {
      sql +=
        " AND (fc.companyName LIKE ? OR fc.email LIKE ? OR fc.RegNumber LIKE ?)";
      const trimmed = `%${searchTerm.trim()}%`;
      params.push(trimmed, trimmed, trimmed);
    }

    plantcare.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

// Get all govi link jobs with filters
exports.getAllGoviLinkJobsDAO = (filters = {}) => {
  return new Promise((resolve, reject) => {
    const { searchTerm, district, status, assignStatus, date } = filters;

    let sql = `
      SELECT 
        gj.id AS jobId,
        CONCAT(u.firstName, ' ', u.lastName) AS farmerName,
        u.NICnumber AS farmerNIC,
        os.englishName AS service,
        f.district AS district,
        gj.status AS status,
        au.userName AS assignedBy,
        gj.sheduleDate AS scheduledDate,
        gj.createdAt AS createdAt,
        CASE 
          WHEN jao.id IS NOT NULL THEN 'Assigned'
          ELSE 'Not Assigned'
        END AS assignStatus,
        jao.id AS assignmentId,
        CONCAT(fo.firstName, ' ', fo.lastName) AS assignedOfficerName,
        fo.empId AS officerEmpId
      FROM 
        govilinkjobs gj
      LEFT JOIN users u ON gj.farmerId = u.id
      LEFT JOIN officerservices os ON gj.serviceId = os.id
      LEFT JOIN farms f ON gj.farmId = f.id
      LEFT JOIN agro_world_admin.adminusers au ON gj.assignBy = au.id
      LEFT JOIN jobassignofficer jao ON gj.id = jao.jobId AND jao.isActive = 1
      LEFT JOIN feildofficer fo ON jao.officerId = fo.id
      WHERE 1=1
    `;

    const params = [];

    // Search filter (ONLY by farmer name, NIC, or service - as requested)
    if (searchTerm && searchTerm.trim()) {
      sql += `
        AND (
          CONCAT(u.firstName, ' ', u.lastName) LIKE ? OR
          u.NICnumber LIKE ? OR
          os.englishName LIKE ?
        )
      `;
      const trimmed = `%${searchTerm.trim()}%`;
      params.push(trimmed, trimmed, trimmed);
    }

    // District filter
    if (district && district.trim()) {
      sql += ` AND f.district = ?`;
      params.push(district.trim());
    }

    // Status filter
    if (status && status.trim()) {
      sql += ` AND gj.status = ?`;
      params.push(status.trim());
    }

    // Assign Status filter (Assigned/Not Assigned)
    if (assignStatus && assignStatus.trim()) {
      if (assignStatus === "Assigned") {
        sql += ` AND jao.id IS NOT NULL`;
      } else if (assignStatus === "Not Assigned") {
        sql += ` AND jao.id IS NULL`;
      }
    }

    // Date filter - filter by SCHEDULED DATE (not created date)
    if (date && date.trim()) {
      sql += ` AND DATE(gj.sheduleDate) = ?`; // Changed from gj.createdAt to gj.sheduleDate
      params.push(date.trim());
    }

    sql += " ORDER BY gj.createdAt DESC";

    console.log("Final SQL:", sql); // Debug log
    console.log("Params:", params); // Debug log

    plantcare.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};
// Get field officers by job role
exports.getOfficersByJobRoleDAO = (jobRole, scheduleDate) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        fo.id,
        fo.empId,
        fo.firstName,
        fo.lastName,
        fo.JobRole,
        fo.distrct,
        COUNT(ja.id) AS activeJobCount
      FROM 
        feildofficer fo
      LEFT JOIN 
        jobassignofficer ja 
        ON fo.id = ja.officerId 
        AND ja.isActive = 1
      LEFT JOIN 
        govilinkjobs gj 
        ON gj.id = ja.jobId 
        AND gj.sheduleDate = ?
      WHERE 
        fo.JobRole = ?
      GROUP BY 
        fo.id, fo.empId, fo.firstName, fo.lastName, fo.JobRole, fo.distrct
      ORDER BY 
        fo.firstName, fo.lastName
    `;

    const params = [scheduleDate, jobRole];

    plantcare.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// Assign officer to job deactivate previous assignments and create new one
exports.assignOfficerToJobDAO = (jobId, officerId) => {
  return new Promise((resolve, reject) => {
    // Step 1: Deactivate any existing active assignments
    const deactivateSql = `
      UPDATE jobassignofficer 
      SET isActive = 0 
      WHERE jobId = ? AND isActive = 1
    `;

    plantcare.query(deactivateSql, [jobId], (err, deactivateResults) => {
      if (err) return reject(err);

      // Step 2: Create new assignment
      const insertSql = `
        INSERT INTO jobassignofficer (jobId, officerId, isActive) 
        VALUES (?, ?, 1)
      `;

      plantcare.query(insertSql, [jobId, officerId], (err, insertResults) => {
        if (err) return reject(err);

        resolve({
          success: true,
          data: {
            assignmentId: insertResults.insertId,
            jobId: jobId,
            officerId: officerId,
            previousAssignmentsDeactivated: deactivateResults.affectedRows,
            action: "created",
          },
        });
      });
    });
  });
};

// Get basic job details by ID
exports.getJobBasicDetailsByIdDAO = (jobId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        gj.id AS jobId,
        gj.sheduleDate AS scheduledDate,
        
        -- Farmer Details
        CONCAT(u.firstName, ' ', u.lastName) AS farmerName,
        u.NICnumber AS farmerNIC,
        
        -- Service Details
        os.englishName AS serviceName,
        
        -- Farm Details
        f.farmName,
        
        -- Crops as comma separated string
        GROUP_CONCAT(DISTINCT cg.cropNameEnglish SEPARATOR ', ') AS crops
        
      FROM 
        govilinkjobs gj
        
        -- Join farmer details
        LEFT JOIN users u ON gj.farmerId = u.id
        
        -- Join service details
        LEFT JOIN officerservices os ON gj.serviceId = os.id
        
        -- Join farm details
        LEFT JOIN farms f ON gj.farmId = f.id
        
        -- Join crops
        LEFT JOIN jobrequestcrops jrc ON gj.id = jrc.jobId
        LEFT JOIN cropgroup cg ON jrc.cropId = cg.id
        
      WHERE 
        gj.id = ?
        
      GROUP BY 
        gj.id
    `;

    plantcare.query(sql, [jobId], (err, results) => {
      if (err) return reject(err);

      if (results.length === 0) {
        resolve(null);
      } else {
        const jobData = results[0];

        // Format the date to YYYY/MM/DD
        if (jobData.scheduledDate) {
          const date = new Date(jobData.scheduledDate);
          jobData.scheduledDate = date
            .toISOString()
            .split("T")[0]
            .replace(/-/g, "/");
        }

        resolve(jobData);
      }
    });
  });
};
