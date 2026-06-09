const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
  investment,
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
          if (err.code === "ER_DUP_ENTRY") {
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
              serviceId: id,
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
        au.userName AS assignedByAdmin, 
        CONCAT(fo2.firstName, ' ', fo2.lastName) AS assignedByOfficer,
        fo2.empId AS assignedByEmpId,
        gj.sheduleDate AS scheduledDate,
        gj.createdAt AS createdAt,
        CASE 
          WHEN jao.id IS NOT NULL THEN 'Assigned'
          ELSE 'Not Assigned'
        END AS assignStatus,
        jao.id AS assignmentId,
        CONCAT(fo.firstName, ' ', fo.lastName) AS assignedOfficerName,
        fo.empId AS officerEmpId,
        fo.jobRole AS assignedOfficerRole
      FROM 
        govilinkjobs gj
      LEFT JOIN users u ON gj.farmerId = u.id
      LEFT JOIN officerservices os ON gj.serviceId = os.id
      LEFT JOIN farms f ON gj.farmId = f.id
      LEFT JOIN agro_world_admin.adminusers au ON gj.assignBy = au.id
      LEFT JOIN jobassignofficer jao ON gj.id = jao.jobId AND jao.isActive = 1
      LEFT JOIN feildofficer fo ON jao.officerId = fo.id
      LEFT JOIN feildofficer fo2 ON gj.assignByCFO = fo2.id
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
          SET 
            assignBy = ?,
            status = 'Pending',
            assignDate = NOW()
          WHERE id = ?
        `;

        plantcare.query(
          updateJobSql,
          [assignedBy, jobId],
          (err, updateResults) => {
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
          }
        );
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
exports.checkDuplicateServiceNames = (
  id,
  englishName,
  tamilName,
  sinhalaName
) => {
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
        englishName,
        id,
        tamilName,
        id,
        sinhalaName,
        id,
        englishName,
        tamilName,
        sinhalaName,
        id,
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
                sinhalaName: duplicateRecord.sinhalaName,
              },
            });
          } else {
            resolve({
              exists: false,
              field: null,
              duplicateValue: null,
              existingId: null,
            });
          }
        }
      }
    );
  });
};

exports.getFieldAuditDetails = (filters = {}, search = {}) => {
  return new Promise((resolve, reject) => {
    let where1 = " WHERE 1=1 ";
    let where2 = " WHERE 1=1 ";
    let params1 = [];
    let params2 = [];

    if (search.jobId) {
      where1 += " AND (gj.jobId LIKE ? OR f.id LIKE ? OR u.NICnumber LIKE ? )";
      where2 += " AND (fa.jobId LIKE ? OR f.id LIKE ? OR u.NICnumber LIKE ? )";
      params1.push(
        `%${search.jobId}%`,
        `%${search.jobId}%`,
        `%${search.jobId}%`
      );
      params2.push(
        `%${search.jobId}%`,
        `%${search.jobId}%`,
        `%${search.jobId}%`
      );
    }

    // if (search.farmId) {
    //   where1 += " AND f.id LIKE ? ";
    //   where2 += " AND f.id LIKE ? ";
    //   params1.push(`%${search.farmId}%`);
    //   params2.push(`%${search.farmId}%`);
    // }

    // if (search.nic) {
    //   where1 += " AND u.NICnumber LIKE ? ";
    //   where2 += " AND u.NICnumber LIKE ? ";
    //   params1.push(`%${search.nic}%`);
    //   params2.push(`%${search.nic}%`);
    // }

    if (filters.status) {
      where1 += " AND gj.status = ? ";
      where2 += " AND fa.status = ? ";
      params1.push(filters.status);
      params2.push(filters.status);
    }

    if (filters.district) {
      where1 += " AND f.district = ? ";
      where2 += " AND f.district = ? ";
      params1.push(filters.district);
      params2.push(filters.district);
    }

    if (filters.completedDateFrom) {
      where1 += " AND DATE(gj.doneDate) = ? ";
      where2 += " AND DATE(fa.completeDate) = ? ";
      params1.push(filters.completedDateFrom);
      params2.push(filters.completedDateFrom);
    }

    if (filters.completedDateTo) {
      where1 += " AND DATE(gj.doneDate) = ? ";
      where2 += " AND DATE(fa.completeDate) = ? ";
      params1.push(filters.completedDateTo);
      params2.push(filters.completedDateTo);
    }

    // -------------------------------------------------------------------
    // SPECIAL FIELD-AUDIT-ONLY CONDITIONS
    // -------------------------------------------------------------------
    where2 += `
      AND (
        (fa.propose = 'Cluster' AND fa.status = 'Completed')
        OR
        (fa.propose IN ('Request', 'Individual') AND fa.status IN ('Completed', 'Pending'))
      )
    `;

    // -------------------------------------------------------------------
    // FINAL UNION QUERY
    // -------------------------------------------------------------------

    const sql = `
    (
      SELECT 
        gj.id,
        gj.jobId AS jobId,
        fo.empId AS empId,
        f.id AS farmId,
        f.regCode AS farmCode,
        u.NICnumber AS farmerNIC,
        f.district AS district,
        gj.sheduleDate AS scheduledDate,
        gj.doneDate AS completedDate,
        gj.status AS status,
        gj.assignBy AS assignBy,
        au.userName AS assignedByName,
        concat(fo1.firstName, ' ', fo1.lastName) AS AssignedOfficer,
        'Requested Service' AS visitPurpose,
        jao.createdAt AS assignedOn,
        'no' AS onScreenTime
      FROM plant_care.govilinkjobs gj
      LEFT JOIN plant_care.users u ON gj.farmerId = u.id
      LEFT JOIN plant_care.farms f ON gj.farmId = f.id
      LEFT JOIN agro_world_admin.adminusers au ON gj.assignBy = au.id
      LEFT JOIN plant_care.jobassignofficer jao ON gj.id = jao.jobId AND jao.isActive = 1
      LEFT JOIN plant_care.feildofficer fo ON jao.officerId = fo.id
      LEFT JOIN plant_care.feildofficer fo1 ON gj.assignByCFO = fo1.id
      ${where1}
    )

    UNION ALL

    (
      SELECT 
        fa.id,
        fa.jobId AS jobId,
        fo.empId AS empId,
        COALESCE( f.id, f2.id, f3.id) AS farmId,
        COALESCE(f.regCode, f2.regCode, f3.regCode) AS farmCode,
        COALESCE(u.NICnumber, u2.NICnumber) AS farmerNIC,
        COALESCE(fc.district, f.district, f2.district, f3.district) AS district,
        fa.sheduleDate AS scheduledDate,
        fa.completeDate AS completedDate,
        fa.status AS status,
        fa.assignBy AS assignBy,
        au.userName AS assignedByName,
        concat(fo1.firstName, ' ', fo1.lastName) AS AssignedOfficer,
        fa.propose AS visitPurpose,
        fa.assignDate AS assignedOn,
        fa.onScreenTime AS onScreenTime
      FROM plant_care.feildaudits fa
      LEFT JOIN agro_world_admin.adminusers au ON fa.assignBy = au.id
      LEFT JOIN plant_care.feildofficer fo ON fa.assignOfficerId = fo.id
      LEFT JOIN plant_care.certificationpayment cp ON fa.paymentId = cp.id
      LEFT JOIN plant_care.users u ON cp.userId = u.id
      LEFT JOIN plant_care.feildauditcluster fac ON fac.feildAuditId = fa.id
      LEFT JOIN plant_care.farms f ON fac.farmId = f.id
      LEFT JOIN plant_care.users u2 ON f.userId = u2.id
      LEFT JOIN plant_care.feildofficer fo1 ON fa.assignByCFO = fo1.id
      LEFT JOIN plant_care.certificationpaymentfarm cpf ON cp.id = cpf.paymentId
      LEFT JOIN plant_care.farms f2 ON cpf.farmId = f2.id
      LEFT JOIN plant_care.certificationpaymentcrop cpc ON cp.id = cpc.paymentId
      LEFT JOIN plant_care.ongoingcultivationscrops ongc ON cpc.cropId = ongc.id
      LEFT JOIN plant_care.farms f3 ON ongc.farmId = f3.id
      LEFT JOIN plant_care.farmcluster fc ON cp.certificateId = fc.certificateId

      ${where2}
    )

    ORDER BY completedDate DESC, scheduledDate DESC;
    `;

    // Combine both parameter lists
    const finalParams = [...params1, ...params2];

    console.log("Final SQL:", sql);
    console.log("Params:", finalParams);

    plantcare.query(sql, finalParams, (err, results) => {
      if (err) return reject(err);
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
        return reject(new Error("Complaint not found"));
      }

      resolve(results);
    });
  });
};

exports.GetDriverComplainByIdDAO = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT 
        dc.id, 
        dc.refNo,
        dc.driverId,
        co.empId AS empId,
        CONCAT(co.firstNameEnglish, ' ', co.lastNameEnglish) AS officerName,
        CONCAT(co.firstNameSinhala, ' ', co.lastNameSinhala) AS officerNameSinhala,
        CONCAT(co.firstNameTamil, ' ', co.lastNameTamil) AS officerNameTamil,
        co.phoneNumber01,
        co.email,
        dc.complainCategory AS complainCategoryId,
        cc.categoryEnglish AS complainCategory,
        cc.categorySinhala AS complainCategorySinhala,
        cc.categoryTamil AS complainCategoryTamil,
        ar.role,
        dc.createdAt,
        dc.complain,
        dc.reply,
        dc.replyTime,
        co.JobRole,
        au.userName AS replyByName
      FROM drivercomplains dc
      LEFT JOIN collectionofficer co ON dc.driverId = co.id
      LEFT JOIN agro_world_admin.complaincategory cc ON dc.complainCategory = cc.id
      LEFT JOIN agro_world_admin.adminroles ar ON cc.roleId = ar.id
      LEFT JOIN agro_world_admin.adminusers au ON dc.adminReplyBy = au.id
      WHERE dc.id = ?`;

    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return reject(err);
      }

      if (results.length === 0) {
        console.log("No data found for ID:", id);
        return resolve(null);
      }

      resolve(results[0]);
    });
  });
};

exports.ReplyDriverComplainDAO = (complainId, reply, replyBy) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE drivercomplains 
      SET 
        reply = ?,
        adminReplyBy = ?,
        replyTime = NOW(),
        status = 'Closed'
      WHERE id = ?
    `;

    collectionofficer.query(
      sql,
      [reply, replyBy, complainId],
      (err, results) => {
        if (err) {
          return reject(err);
        }

        if (results.affectedRows === 0) {
          return reject(new Error("Complaint not found"));
        }

        resolve(results);
      }
    );
  });
};

exports.getFieldAuditHistoryResponseByIdDAO = (jobId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        fa.jobId,
        ct.id AS certificationId,
        ct.applicable,
        cpc.cropId,
        f.regCode,
        cg.cropNameEnglish,
        ct.srtName,
        cp.payType,
        sqi.qEnglish,
        sqi.type,
        sqi.uploadImage,
        sqi.officerTickResult,
        sq.id AS slaveQId,
        COALESCE(f.regCode, f2.regCode) AS farmId
      FROM feildaudits fa
      LEFT JOIN certificationpayment cp ON fa.paymentId = cp.id
      LEFT JOIN certificates ct ON ct.id = cp.certificateId
      LEFT JOIN certificationpaymentcrop cpc ON cpc.paymentId = cp.id
      LEFT JOIN ongoingcultivationscrops occ ON occ.id = cpc.cropId
      LEFT JOIN certificationpaymentfarm cpf ON cpf.paymentId = cp.id
      LEFT JOIN farms f ON f.id = occ.farmId
      LEFT JOIN farms f2 ON f2.id = cpf.farmId
      LEFT JOIN cropcalender cc ON cc.id = occ.cropCalendar
      LEFT JOIN cropvariety cv ON cv.id = cc.cropVarietyId
      LEFT JOIN cropgroup cg ON cg.id = cv.cropGroupId
      LEFT JOIN slavequestionnaire sq ON sq.crtPaymentId = cp.id
      LEFT JOIN slavequestionnaireitems sqi ON sqi.slaveId = sq.id
      WHERE fa.jobId = ?
    `;

    plantcare.query(sql, [jobId], (err, results) => {
      if (err) return reject(err);
      if (results.length === 0) return resolve(null);

      const header = {
        jobId: results[0].jobId,
        certificationId: results[0].certificationId,
        srtName: results[0].srtName,
        payType: results[0].payType,
        regCode: results[0].regCode,
        cropId: results[0].cropId,
        cropNameEnglish: results[0].cropNameEnglish,
        applicable: results[0].applicable,
        farmId: results[0].farmId
      };

      const slaveQIds = [...new Set(results.map(row => row.slaveQId).filter(id => id))];

      if (slaveQIds.length === 0) {
        const data = results.map((row) => ({
          qEnglish: row.qEnglish,
          type: row.type,
          uploadImage: row.uploadImage,
          officerTickResult: row.officerTickResult,
          slaveQId: row.slaveQId,
          problem: null,
          solution: null,
          suggestions: []
        }));
        return resolve({ ...header, data });
      }

      exports.getJobSuggestionsBySlaveIdsDAO(slaveQIds)
        .then(suggestionMap => {
          const data = results.map((row) => {
            const rowSuggestions = suggestionMap[row.slaveQId] || [];
            return {
              qEnglish: row.qEnglish,
              type: row.type,
              uploadImage: row.uploadImage,
              officerTickResult: row.officerTickResult,
              slaveQId: row.slaveQId,
              problem: rowSuggestions[0]?.problem ?? null,
              solution: rowSuggestions[0]?.solution ?? null,
              suggestions: rowSuggestions
            };
          });
          resolve({ ...header, data });
        })
        .catch(err => reject(err));
    });
  });
};

exports.getJobSuggestionsBySlaveIdsDAO = (slaveIds) => {
  return new Promise((resolve, reject) => {
    if (!slaveIds || slaveIds.length === 0) return resolve({});

    const placeholders = slaveIds.map(() => '?').join(', ');
    const sql = `
      SELECT 
        slaveId,
        problem,
        solution
      FROM jobsuggestions
      WHERE slaveId IN (${placeholders})
    `;

    plantcare.query(sql, slaveIds, (err, results) => {
      if (err) {
        console.error('Error fetching job suggestions:', err);
        return reject(err);
      }

      const grouped = {};
      results.forEach(row => {
        if (!grouped[row.slaveId]) grouped[row.slaveId] = [];
        grouped[row.slaveId].push({
          problem: row.problem,
          solution: row.solution
        });
      });

      resolve(grouped);
    });
  });
};

exports.getServiceRequestResponseDao = (jobId) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT 
    gj.id,
    gj.jobId AS jobId,
    fo.empId AS empId,
    f.id AS farmId,
    f.regCode AS farmCode,
    u.NICnumber AS farmerNIC,
    f.district AS district,
    gj.sheduleDate AS scheduledDate,
    gj.doneDate AS completedDate,
    gj.status AS status,
    gj.assignBy AS assignBy,
    au.userName AS assignedByName,
    CONCAT(fo1.firstName, ' ', fo1.lastName) AS AssignedOfficer,
    'Requested Service' AS visitPurpose,
    jao.createdAt AS assignedOn,
    ofs.englishName AS serviceName,
    GROUP_CONCAT(cg.cropNameEnglish SEPARATOR ', ') AS cropNames,
    GROUP_CONCAT(cg.id) AS cropIds,  -- Optional: if you need IDs too
    'no' AS onScreenTime
FROM plant_care.govilinkjobs gj
JOIN plant_care.jobrequestcrops jrc ON gj.id = jrc.jobId
JOIN plant_care.cropgroup cg ON jrc.cropId = cg.id
LEFT JOIN plant_care.users u ON gj.farmerId = u.id
LEFT JOIN plant_care.farms f ON gj.farmId = f.id
LEFT JOIN plant_care.officerservices ofs ON gj.serviceId = ofs.id
LEFT JOIN agro_world_admin.adminusers au ON gj.assignBy = au.id
LEFT JOIN plant_care.jobassignofficer jao ON gj.id = jao.jobId AND jao.isActive = 1
LEFT JOIN plant_care.feildofficer fo ON jao.officerId = fo.id
LEFT JOIN plant_care.feildofficer fo1 ON gj.assignByCFO = fo1.id
WHERE gj.jobId = ?
GROUP BY 
    gj.id,
    gj.jobId,
    fo.empId,
    f.id,
    f.regCode,
    u.NICnumber,
    f.district,
    gj.sheduleDate,
    gj.doneDate,
    gj.status,
    gj.assignBy,
    au.userName,
    fo1.firstName,
    fo1.lastName,
    jao.createdAt,
    ofs.englishName,
    'no'
    `;

    plantcare.query(sql, [jobId], (err, results) => {
      if (err) return reject(err);
      resolve(results[0]);
    });
  });
};

exports.getAdvicesServiceRequestDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        gjs.id,
        gjs.jobId,
        gjs.farmerFeedback,
        gjs.advice,
        gjs.image
      FROM plant_care.govijoblinksuggestions gjs
      WHERE gjs.jobId = ?
    `;

    plantcare.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results);
      console.log("results", results);
    });
  });
};

exports.getSuggestionsServiceRequestDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
      gjp.id,
      gjp.jobId,
      gjp.problem,
      gjp.solution
      FROM plant_care.govijoblinkproblems gjp
      WHERE gjp.jobId = ?
    `;

    plantcare.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// exports.getFieldAuditHistoryClusterResponseByIdDAO = (jobId) => {
//   return new Promise((resolve, reject) => {
//     const sql = `
//       SELECT 
//         fa.jobId,
//         cp.certificateId,
//         ct.srtName,
//         cp.payType,
//         f.regCode,
//         (SELECT COUNT(*) FROM feildauditcluster fac1 WHERE fac1.feildAuditId = fa.id) AS totalFarms,
//         (SELECT COUNT(*) FROM feildauditcluster fac2 WHERE fac2.feildAuditId = fa.id AND fac2.isCompleted = 1) AS completedFarms,


//         JSON_ARRAYAGG(
//           JSON_OBJECT(
//             'qEnglish', sqi.qEnglish,
//             'type', sqi.type,
//             'uploadImage', sqi.uploadImage,
//             'officerTickResult', sqi.officerTickResult,
//             'problem', js.problem,
//             'solution', js.solution
//           )
//         ) AS questions

//       FROM feildaudits fa
//       LEFT JOIN certificationpayment cp ON fa.paymentId  = cp.id 
//       LEFT JOIN certificates ct ON ct.id = cp.certificateId 
//       LEFT JOIN slavequestionnaire sq ON sq.crtPaymentId = cp.id
//       LEFT JOIN certificationpaymentfarm cpf ON cpf.paymentId = cp.id
//       LEFT JOIN farmcluster fc ON fc.id = cp.clusterId 
//       LEFT JOIN farmclusterfarmers fcf ON fcf.clusterId = fc.id
//       LEFT JOIN farms f ON f.id = fcf.farmId 
//       LEFT JOIN slavequestionnaireitems sqi ON sqi.slaveId = sq.id
//       LEFT JOIN jobsuggestions js ON js.slaveId  = sq.id

//       WHERE fa.jobId = ?

//       GROUP BY 
//         fa.jobId,
//         cp.certificateId,
//         ct.srtName,
//         cp.payType,
//         f.regCode,
//         totalFarms,
//         completedFarms
//     `;

//     plantcare.query(sql, [jobId], (err, results) => {
//       if (err) return reject(err);
//       if (!results || results.length === 0) return resolve(null);

//       const header = {
//         jobId: results[0].jobId,
//         certificateId: results[0].certificateId,
//         srtName: results[0].srtName,
//         payType: results[0].payType,
//         totalFarms: results[0].totalFarms,
//         completedFarms: results[0].completedFarms
//       };

//       const farms = results.map((row) => ({
//         regCode: row.regCode,
//         questions: row.questions || [],
//       }));

//       resolve({
//         header,
//         farms,
//       });
//     });
//   });
// };

exports.getFieldAuditHistoryClusterResponseByIdDAO = (jobId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        fa.jobId,
        cp.certificateId,
        ct.srtName,
        cp.payType,
        f.regCode,
        sqi.qEnglish,
        sqi.type,
        sqi.uploadImage,
        sqi.officerTickResult,
        sq.id AS slaveQId,
        (SELECT COUNT(*) FROM feildauditcluster fac1 WHERE fac1.feildAuditId = fa.id) AS totalFarms,
        (SELECT COUNT(*) FROM feildauditcluster fac2 WHERE fac2.feildAuditId = fa.id AND fac2.isCompleted = 1) AS completedFarms

      FROM feildaudits fa
      LEFT JOIN certificationpayment cp ON fa.paymentId = cp.id 
      LEFT JOIN certificates ct ON ct.id = cp.certificateId 
      LEFT JOIN slavequestionnaire sq ON sq.crtPaymentId = cp.id
      LEFT JOIN certificationpaymentfarm cpf ON cpf.paymentId = cp.id
      LEFT JOIN farmcluster fc ON fc.id = cp.clusterId 
      LEFT JOIN farmclusterfarmers fcf ON fcf.clusterId = fc.id
      LEFT JOIN farms f ON f.id = fcf.farmId 
      LEFT JOIN slavequestionnaireitems sqi ON sqi.slaveId = sq.id

      WHERE fa.jobId = ?
    `;

    plantcare.query(sql, [jobId], (err, results) => {
      if (err) return reject(err);
      if (!results || results.length === 0) return resolve(null);

      const header = {
        jobId: results[0].jobId,
        certificateId: results[0].certificateId,
        srtName: results[0].srtName,
        payType: results[0].payType,
        totalFarms: results[0].totalFarms,
        completedFarms: results[0].completedFarms
      };

      const slaveQIds = [...new Set(results.map(row => row.slaveQId).filter(id => id))];

      // Group by regCode first
      const farmsMap = new Map();
      
      results.forEach(row => {
        if (!farmsMap.has(row.regCode)) {
          farmsMap.set(row.regCode, {
            regCode: row.regCode,
            questions: []
          });
        }
        farmsMap.get(row.regCode).questions.push({
          qEnglish: row.qEnglish,
          type: row.type,
          uploadImage: row.uploadImage,
          officerTickResult: row.officerTickResult,
          slaveQId: row.slaveQId
        });
      });

      if (slaveQIds.length === 0) {
        return resolve({
          header,
          farms: Array.from(farmsMap.values())
        });
      }

      exports.getJobSuggestionsBySlaveIdsDAO(slaveQIds)
        .then(suggestionMap => {
          const farms = Array.from(farmsMap.values()).map(farm => ({
            ...farm,
            questions: farm.questions.map(q => ({
              ...q,
              problem: suggestionMap[q.slaveQId]?.[0]?.problem ?? null,
              solution: suggestionMap[q.slaveQId]?.[0]?.solution ?? null,
              suggestions: suggestionMap[q.slaveQId] || []
            }))
          }));
          
          resolve({
            header,
            farms
          });
        })
        .catch(err => reject(err));
    });
  });
};

exports.getDashbordOfficerCountDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS count, JobRole
      FROM feildofficer
      WHERE status = 'Approved'
      GROUP BY JobRole
    `;

    plantcare.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results[0]);
    });
  });
};

exports.getDashbordServiceCountDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT SUM(count) AS total_count
      FROM (
        SELECT COUNT(*) AS count
        FROM investments.investmentrequest ir
        WHERE DATE(ir.auditedDate) = CURDATE() AND ir.officerStatus = 'Completed'
        
        UNION ALL
        
        SELECT COUNT(*) AS count
        FROM govilinkjobs
        WHERE DATE(doneDate) = CURDATE() AND status = 'Completed'
      ) AS subquery;
    `;
    

    plantcare.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results[0]);
    });
  });
};


exports.getDashbordAuditCountDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS count
      FROM feildaudits 
      WHERE status = 'Completed' AND DATE(completeDate) = CURDATE()
    `;

    plantcare.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results[0]);
    });
  });
};

