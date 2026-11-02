const {
  admin,
  plantcare,
  collectionofficer,
} = require("../startup/database");
const { Upload } = require("@aws-sdk/lib-storage");
const Joi = require("joi");

exports.getAllSalesAgentsDao = (
  page,
  limit,
  searchText,
  status,
  date,
  targetValue
) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;
    let countSql = `
        SELECT COUNT(*) AS total FROM salesagent
        WHERE status = 'Approved'
        `;

    let dataSql = `
        SELECT 
            SA.id,
            SA.empId,
            SA.firstName,
            SA.lastName,
            SAS.completed AS targetComplete,
            SAS.target AS target
        FROM salesagent SA
        JOIN salesagentstars SAS ON SA.id = SAS.salesagentId
        WHERE SA.status = 'Approved' AND SAS.date = ?
        `;
    const countParams = [];
    const dataParams = [date];

    if (searchText) {
      const searchPattern = `%${searchText}%`;
      dataSql += `
                AND (SA.lastName LIKE ? OR SA.firstName LIKE ? OR SA.empId LIKE ?)
            `;
      countSql += `
                AND (lastName LIKE ? OR firstName LIKE ? OR empId LIKE ?)
            `;

      countParams.push(searchPattern, searchPattern, searchPattern);
      dataParams.push(searchPattern, searchPattern, searchPattern);
    }

    // Handling Status Filter (for target completion)
    if (status) {
      if (status === "Pending") {
        dataSql += ` HAVING targetComplete < ? `;
        dataParams.push(targetValue);
      } else if (status === "Completed") {
        dataSql += ` HAVING targetComplete = ? `;
        dataParams.push(targetValue);
      } else if (status === "Exceeded") {
        dataSql += ` HAVING targetComplete > ? `;
        dataParams.push(targetValue);
      }
    }

    dataSql += " LIMIT ? OFFSET ? ";
    dataParams.push(parseInt(limit), parseInt(offset));

    // Execute Count Query
    collectionofficer.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      // Execute Data Query
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

exports.saveTargetDao = (target, userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
        INSERT INTO target(targetValue, createdBy) VALUES (?, ?)
      `;

    collectionofficer.query(sql, [target.targetValue, userId], (err, results) => {
      if (err) {
        return reject(err); 
      }
      resolve(results);
    });
  });
};


exports.getAllTargets = () => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM target`;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.restoreTargets = (targets) => {
  return new Promise((resolve, reject) => {
    if (targets.length === 0) return resolve(); 

    const sql = `
      INSERT INTO target (targetValue, createdBy, createdAt)
      VALUES ?
    `;

    // Map data into the format MySQL expects
    const values = targets.map(target => [target.targetValue, target.createdBy, target.createdAt]);

    collectionofficer.query(sql, [values], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getTotalTargetDao = (date) => {
  return new Promise((resolve, reject) => {
    const sql = `
        SELECT targetValue FROM target 
      `;

    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err); 
      }

      let data;
      if (results.length === 0) {
        data = { targetValue: 0 };
      } else {
        data = results[0];
      }

      resolve(data);
    });
  });
};

exports.removeTargetDao = () => {
  return new Promise((resolve, reject) => {
    const sql = `
        DELETE FROM target
    `;

    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err); 
      }
      resolve(results);
    });
  });
};


// Shared FROM / WHERE builder so the count and data queries always match
const buildBase = ({ searchText, onboarded, status }) => {
  let from = `
    FROM pendingwholesaleusers pw
    JOIN marketplaceusers mu ON mu.id = pw.userId
    LEFT JOIN salesagent sa ON sa.id = mu.salesAgent
    WHERE mu.deletedAt IS NULL
      AND pw.approveStatus = ?
  `;
  const params = [status];

  // Filter: Onboarded
  if (onboarded) {
    if (onboarded === "Polygon") {
      from += ` AND mu.salesAgent IS NULL `;
    } else {
      from += ` AND sa.empId = ? `;
      params.push(onboarded);
    }
  }

  // Search: name, cusId, phones, company, onboarded
  if (searchText) {
    const p = `%${searchText}%`;
    from += `
      AND (
        CONCAT_WS(' ', mu.firstName, mu.lastName) LIKE ?
        OR mu.cusId LIKE ?
        OR CONCAT(mu.phoneCode, mu.phoneNumber) LIKE ?
        OR mu.phoneNumber LIKE ?
        OR CONCAT(mu.companyPhoneCode, mu.companyPhone) LIKE ?
        OR mu.companyPhone LIKE ?
        OR mu.companyName LIKE ?
        OR sa.empId LIKE ?
      )
    `;
    params.push(p, p, p, p, p, p, p, p);
  }

  return { from, params };
};

exports.getPendingWholesaleBuyersDao = ({
  page,
  limit,
  searchText,
  onboarded,
  status,
}) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;
    const { from, params } = buildBase({ searchText, onboarded, status });

    const countSql = `SELECT COUNT(*) AS total ${from}`;

    const dataSql = `
      SELECT
        pw.id                                   AS applicationId,
        mu.id                                   AS userId,
        mu.cusId,
        CONCAT_WS(' ', mu.title, mu.firstName, mu.lastName) AS name,
        COALESCE(sa.empId, 'Polygon')           AS onboarded,
        mu.companyName                          AS company,
        pw.createdAt                            AS createdAt,
        CONCAT_WS('', mu.phoneCode, mu.phoneNumber)             AS customerContact,
        CONCAT_WS('', mu.companyPhoneCode, mu.companyPhone)     AS companyContact,
        CASE pw.approveStatus
          WHEN 'Approve' THEN 'Approved'
          WHEN 'Reject'  THEN 'Rejected'
          ELSE 'To Review'
        END                                     AS status
      ${from}
      ORDER BY pw.createdAt DESC
      LIMIT ? OFFSET ?
    `;

    collectionofficer.query(countSql, params, (countErr, countRes) => {
      if (countErr) return reject(countErr);

      const total = countRes[0].total;

      collectionofficer.query(
        dataSql,
        [...params, parseInt(limit), parseInt(offset)],
        (dataErr, dataRes) => {
          if (dataErr) return reject(dataErr);
          resolve({ items: dataRes, total });
        }
      );
    });
  });
};

// Options for the "Onboarded" dropdown: Polygon + every approved agent empId
exports.getOnboardedOptionsDao = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT empId FROM salesagent
      WHERE status = 'Approved' AND empId IS NOT NULL
      ORDER BY empId
    `;
    collectionofficer.query(sql, (err, results) => {
      if (err) return reject(err);
      resolve([
        { label: "Polygon", value: "Polygon" },
        ...results.map((r) => ({ label: r.empId, value: r.empId })),
      ]);
    });
  });
};

exports.getSalesAgents = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT empId, firstName FROM salesagent
      WHERE status = 'Approved' AND empId IS NOT NULL
      ORDER BY empId
    `;
    collectionofficer.query(sql, (err, results) => {
      if (err) return reject(err);
      resolve([
        { label: "Polygon", value: "Polygon" },
        ...results.map((r) => ({
          label: `${r.empId} - ${r.firstName}`,
          value: r.empId,
        })),
      ]);
    });
  });
};

exports.checkMarketPlaceUserExistsDao = ({ email, phoneCode, phoneNumber, nic }) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, email, phoneNumber, nic
      FROM marketplaceusers
      WHERE deletedAt IS NULL
        AND (email = ? OR (phoneCode = ? AND phoneNumber = ?) OR nic = ?)
      LIMIT 1
    `;
    collectionofficer.query(sql, [email, phoneCode, phoneNumber, nic], (err, results) => {
      if (err) return reject(err);
      resolve(results[0] || null);
    });
  });
};
 
// ---------------------------------------------------------------
// Create Wholesale marketplace user + pending application (single transaction)
// ---------------------------------------------------------------
exports.createWholesaleCustomerDao = async (data) => {
  const conn = await collectionofficer.promise().getConnection();
  try {
    await conn.beginTransaction();
 
    // ---- next cusId (MAR-00001, MAR-00002 ...) ----
    const [last] = await conn.query(`
      SELECT cusId
      FROM marketplaceusers
      WHERE cusId LIKE 'MAR-%'
      ORDER BY CAST(SUBSTRING(cusId, 5) AS UNSIGNED) DESC
      LIMIT 1
      FOR UPDATE
    `);
    const lastId = last[0] ? last[0].cusId : null;
 
    let nextId;
    if (!lastId) {
      nextId = "MAR-00001";
    } else {
      const numericPart = parseInt(lastId.split("-")[1], 10);
      nextId = `MAR-${(numericPart + 1).toString().padStart(5, "0")}`;
    }
 
    // ---- marketplace user ----
    const [userRes] = await conn.query(
      `
      INSERT INTO marketplaceusers (
        salesAgent, cusId, title, firstName, lastName,
        phoneCode, phoneNumber, docType, nic, buyerType, email, password,
        companyPhoneCode, companyPhone, companyName,
        isMarketPlaceUser, isPswUpdateed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Wholesale', ?, ?, ?, ?, ?, 1, 0)
      `,
      [
        data.salesAgent || null,
        nextId,
        data.title,
        data.firstName,
        data.lastName,
        data.phoneCode,
        data.phoneNumber,
        data.docType,
        data.nic,
        data.email,
        data.password, // bcrypt hash
        data.companyPhoneCode,
        data.companyPhone,
        data.companyName,
      ]
    );
 
    // ---- pending wholesale application ----
    const [pendingRes] = await conn.query(
      `
      INSERT INTO pendingwholesaleusers (userId, approveStatus, brImg)
      VALUES (?, 'To Review', ?)
      `,
      [userRes.insertId, data.brImg]
    );
 
    await conn.commit();
 
    return {
      userId: userRes.insertId,
      applicationId: pendingRes.insertId,
      cusId: nextId,
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
};