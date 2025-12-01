const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
  dash,
} = require("../startup/database");


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
      [englishName, tamilName, sinhalaName, srvFee, modifyBy, id],
      (err, result) => {
        if (err) {
          // Handle database unique constraint errors as fallback
          if (err.code === 'ER_DUP_ENTRY') {
            reject(new Error("Service name already exists in the database"));
          } else {
            reject(err);
          }
        } else {
          if (result.affectedRows === 0) {
            reject(new Error("No officer service found with the given ID"));
          } else {
            resolve({
              message: "Officer service updated successfully",
              affectedRows: result.affectedRows,
              serviceId: id
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
    const sql = `DELETE FROM plant_care.officerservices 
                 WHERE id = ?`;

    admin.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          message: "Service deleted successfully",
          affectedRows: results.affectedRows,
        });
      }
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

exports.getOfficersByJobRoleDAO = (jobRole, scheduleDate, jobId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        fo.id,
        fo.empId,
        fo.firstName,
        fo.lastName,
        fo.JobRole,
        fo.distrct,
        fo.assignDistrict,
        COUNT(ja.id) AS activeJobCount
      FROM 
        feildofficer fo
      INNER JOIN 
        govilinkjobs gj_filter 
        ON gj_filter.id = ?
      INNER JOIN 
        farms f 
        ON f.id = gj_filter.farmId
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
        AND FIND_IN_SET(f.district, fo.assignDistrict) > 0
      GROUP BY 
        fo.id, fo.empId, fo.firstName, fo.lastName, fo.JobRole, fo.distrct, fo.assignDistrict
      ORDER BY 
        activeJobCount ASC, fo.firstName, fo.lastName
    `;

    const params = [jobId, scheduleDate, jobRole];

    plantcare.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

exports.assignOfficerToJobDAO = (jobId, officerId, assignedBy) => {
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

        // Step 3: Update assignBy in govilinkjobs table
        const updateJobSql = `
          UPDATE govilinkjobs 
          SET assignBy = ? 
          WHERE id = ?
        `;

        plantcare.query(updateJobSql, [assignedBy, jobId], (err, updateResults) => {
          if (err) return reject(err);

          resolve({
            success: true,
            data: {
              assignmentId: insertResults.insertId,
              jobId: jobId,
              officerId: officerId,
              assignedBy: assignedBy,
              previousAssignmentsDeactivated: deactivateResults.affectedRows,
              action: "created",
            },
          });
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

// Check for duplicate service names
exports.checkDuplicateServiceNames = (id, englishName, tamilName, sinhalaName) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        id,
        englishName,
        tamilName,
        sinhalaName,
        CASE 
          WHEN englishName = ? AND id != ? THEN 'englishName'
          WHEN tamilName = ? AND id != ? THEN 'tamilName' 
          WHEN sinhalaName = ? AND id != ? THEN 'sinhalaName'
          ELSE NULL 
        END as duplicateField
      FROM plant_care.officerservices
      WHERE (englishName = ? OR tamilName = ? OR sinhalaName = ?)
        AND id != ?
      LIMIT 1
    `;

    admin.query(
      sql,
      [
        englishName, id,
        tamilName, id,
        sinhalaName, id,
        englishName, tamilName, sinhalaName, id
      ],
      (err, results) => {
        if (err) {
          reject(err);
        } else {
          if (results.length > 0) {
            const duplicateRecord = results[0];
            const duplicateField = duplicateRecord.duplicateField;
            const duplicateValue = duplicateRecord[duplicateField];
            
            resolve({
              exists: true,
              field: duplicateField,
              duplicateValue: duplicateValue,
              existingId: duplicateRecord.id,
              existingRecord: {
                id: duplicateRecord.id,
                englishName: duplicateRecord.englishName,
                tamilName: duplicateRecord.tamilName,
                sinhalaName: duplicateRecord.sinhalaName
              }
            });
          } else {
            resolve({
              exists: false,
              field: null,
              duplicateValue: null,
              existingId: null
            });
          }
        }
      }
    );
  });
};


exports.getFieldAuditDetails = (filters = {}, search = {}) => {
  return new Promise((resolve, reject) => {
    // Build WHERE conditions for searches
    let searchConditions = [];
    const searchParams = [];
    
    // Job ID search
    if (search.jobId) {
      searchConditions.push('fa.jobId LIKE ?');
      searchParams.push(`%${search.jobId}%`);
    }
    
    // Farm regCode search
    if (search.farmId) {
      searchConditions.push('f.regCode LIKE ?');
      searchParams.push(`%${search.farmId}%`);
    }
    
    // NIC search
    if (search.nic) {
      searchConditions.push('u.NICnumber LIKE ?');
      searchParams.push(`%${search.nic}%`);
    }
    
    const searchWhereClause = searchConditions.length > 0 
      ? `AND (${searchConditions.join(' OR ')})` 
      : '';

    // Build filter conditions
    const filterConditions = [];
    const filterParams = [];

    if (filters.status) {
      filterConditions.push('fa.status = ?');
      filterParams.push(filters.status);
    }

    // Fixed district filter - checks both fc.district and f.district
    if (filters.district) {
      filterConditions.push('(fc.district = ? OR f.district = ?)');
      filterParams.push(filters.district, filters.district);
    }

    if (filters.completedDateFrom) {
      filterConditions.push('DATE(fa.completeDate) = ?');
      filterParams.push(filters.completedDateFrom);
    }

    if (filters.completedDateTo) {
      filterConditions.push('DATE(fa.completeDate) = ?');
      filterParams.push(filters.completedDateTo);
    }

    const filterWhereClause = filterConditions.length > 0
      ? `AND ${filterConditions.join(' AND ')}`
      : '';

    const sql = `
      SELECT 
        fa.jobId,
        fo.empId,
        fa.propose AS visitPurpose,
        fa.sheduleDate AS scheduledDate,
        fa.completeDate AS completedDate,
        fa.onScreenTime,
        fa.status,
        fa.assignDate AS assignedOn,
        fa.assignBy,
        admin.userName AS assignedByName,
        
        -- For Cluster: get district from farmcluster, for others from farms
        CASE 
          WHEN fa.propose = 'Cluster' THEN fc.district
          ELSE f.district
        END AS district,
        
        -- Aggregate farm IDs for clusters
        CASE 
          WHEN fa.propose = 'Cluster' THEN GROUP_CONCAT(DISTINCT f.id ORDER BY f.id SEPARATOR ',')
          ELSE f.id
        END AS farmId,
        
        -- Aggregate regCodes for clusters
        CASE 
          WHEN fa.propose = 'Cluster' THEN GROUP_CONCAT(DISTINCT f.regCode ORDER BY f.regCode SEPARATOR ',')
          ELSE f.regCode
        END AS regCode,
        
        -- Aggregate NICs for clusters
        CASE 
          WHEN fa.propose = 'Cluster' THEN GROUP_CONCAT(DISTINCT u.NICnumber ORDER BY u.NICnumber SEPARATOR ',')
          ELSE u.NICnumber
        END AS farmerNIC
        
      FROM feildaudits fa
      
      -- Join field officer
      INNER JOIN feildofficer fo ON fa.assignOfficerId = fo.id
      
      -- Join certification payment
      INNER JOIN certificationpayment cp ON fa.paymentId = cp.id
      
      -- Join admin user for assignBy (from different database)
      LEFT JOIN agro_world_admin.adminusers admin ON fa.assignBy = admin.id
      
      -- Left join for Cluster scenario
      LEFT JOIN farmcluster fc ON fa.propose = 'Cluster' AND cp.clusterId = fc.id
      LEFT JOIN farmclusterfarmers fcf ON fa.propose = 'Cluster' AND fc.id = fcf.clusterId
      
      -- Left join for Individual/Request scenario OR farms from cluster
      LEFT JOIN farms f ON (
        (fa.propose IN ('Request', 'Individual') AND f.userId = cp.userId)
        OR (fa.propose = 'Cluster' AND f.id = fcf.farmId)
      )
      
      -- Join users (farmer owner)
      LEFT JOIN users u ON f.userId = u.id
      
      WHERE 1=1
        -- Cluster: only completed
        AND (
          (fa.propose = 'Cluster' AND fa.status = 'Completed')
          OR
          -- Request/Individual: both completed and pending
          (fa.propose IN ('Request', 'Individual') AND fa.status IN ('Completed', 'Pending'))
        )
        ${filterWhereClause}
        ${searchWhereClause}
      
      GROUP BY 
        fa.id,
        fa.jobId,
        fo.empId,
        fa.propose,
        fa.sheduleDate,
        fa.completeDate,
        fa.onScreenTime,
        fa.status,
        fa.assignDate,
        fa.assignBy,
        admin.userName,
        fc.district,
        f.district,
        f.id,
        f.regCode,
        u.NICnumber
      
      ORDER BY fa.completeDate DESC, fa.sheduleDate DESC
    `;

    // Combine all parameters in correct order
    const params = [...filterParams, ...searchParams];

    console.log('Filters received in DAO:', filters);
    console.log('Search received in DAO:', search);
    console.log('SQL Query:', sql);
    console.log('Parameters:', params);

    plantcare.query(sql, params, (err, results) => {
      if (err) {
        console.error("Error fetching field audit details:", err);
        return reject(err);
      }

      resolve(results);
    });
  });
};

exports.GetFieldOfficerComplainByIdDAO = (id) => {
  console.log("DAO - GetFieldOfficerComplainByIdDAO called with ID:", id);
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        foc.id, 
        foc.refNo,
        foc.officerId,
        fo.empId AS empId,
        CONCAT(fo.firstName, ' ', fo.lastName) AS officerName,
        CONCAT(fo.firstNameSinhala, ' ', fo.lastNameSinhala) AS officerNameSinhala,
        CONCAT(fo.firstNameTamil, ' ', fo.lastNameTamil) AS officerNameTamil,
        fo.phoneNumber1,
        fo.email,
        foc.complainCategory AS complainCategoryId,
        cc.categoryEnglish AS complainCategory,
        cc.categorySinhala AS complainCategorySinhala,
        cc.categoryTamil AS complainCategoryTamil,
        ar.role,
        foc.createdAt,
        foc.complain,
        foc.reply,
        foc.replyTime,
        foc.language,
        fo.JobRole,
        au.userName AS replyByName
      FROM feildofficercomplains foc
      LEFT JOIN feildofficer fo ON foc.officerId = fo.id
      LEFT JOIN agro_world_admin.complaincategory cc ON foc.complainCategory = cc.id
      LEFT JOIN agro_world_admin.adminroles ar ON cc.roleId = ar.id
      LEFT JOIN agro_world_admin.adminusers au ON foc.adminReplyBy = au.id
      WHERE foc.id = ?
    `;

    console.log("Executing SQL:", sql);
    console.log("With parameters:", [id]);

    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return reject(err);
      }

      console.log("Query results:", results);
      console.log("Number of results:", results.length);

      if (results.length === 0) {
        console.log("No data found for ID:", id);
        return resolve(null);
      }

      resolve(results[0]);
    });
  });
};

exports.ReplyFieldOfficerComplainDAO = (complainId, reply, replyBy) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE feildofficercomplains 
      SET 
        reply = ?,
        adminReplyBy = ?,
        replyTime = NOW(),
        status = 'Closed'
      WHERE id = ?
    `;

    plantcare.query(sql, [reply, replyBy, complainId], (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.affectedRows === 0) {
        return reject(new Error('Complaint not found'));
      }

      resolve(results);
    });
  });
};