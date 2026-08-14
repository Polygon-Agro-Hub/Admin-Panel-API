const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
  investment,
  goviShop,
} = require("../startup/database");
const bcrypt = require("bcryptjs");
const { Upload } = require("@aws-sdk/lib-storage");
const Joi = require("joi");

exports.getAllDashboardData = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT u.id) as totalUsers,
          COUNT(DISTINCT CASE 
            WHEN u.membership = 'Pro' 
              AND EXISTS (
                SELECT 1 FROM membershippayment mp 
                WHERE mp.userId = u.id 
                  AND mp.expireDate > CURRENT_TIMESTAMP()
              )
            THEN u.id 
          END) as proUsers,
          COUNT(DISTINCT CASE 
            WHEN u.membership = 'Basic' 
              OR NOT EXISTS (
                SELECT 1 FROM membershippayment mp 
                WHERE mp.userId = u.id 
                  AND mp.expireDate > CURRENT_TIMESTAMP()
              )
            THEN u.id 
          END) as freeUsers
        FROM users u
      `;

      // Get monthly income with comparison to previous month
      const incomeQuery = `
        SELECT 
          COALESCE(SUM(
            CASE 
              WHEN MONTH(CURRENT_TIMESTAMP()) >= MONTH(mp.createdAt)
                AND YEAR(CURRENT_TIMESTAMP()) >= YEAR(mp.createdAt)
                AND (YEAR(CURRENT_TIMESTAMP()) * 12 + MONTH(CURRENT_TIMESTAMP())) 
                    <= (YEAR(mp.expireDate) * 12 + MONTH(mp.expireDate))
              THEN mp.payment / CAST(SUBSTRING_INDEX(mp.plan, ' ', 1) AS UNSIGNED)
              ELSE 0
            END
          ), 0) as currentMonthIncome,
          COALESCE(SUM(
            CASE 
              WHEN MONTH(DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH)) >= MONTH(mp.createdAt)
                AND YEAR(DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH)) >= YEAR(mp.createdAt)
                AND (YEAR(DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH)) * 12 + 
                     MONTH(DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH))) 
                    <= (YEAR(mp.expireDate) * 12 + MONTH(mp.expireDate))
              THEN mp.payment / CAST(SUBSTRING_INDEX(mp.plan, ' ', 1) AS UNSIGNED)
              ELSE 0
            END
          ), 0) as previousMonthIncome
        FROM membershippayment mp
        WHERE mp.expireDate > DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH)
      `;

      // Get recent 6 payments
      const paymentsQuery = `
        SELECT 
          CONCAT('TXN-', mp.id) as transactionId,
          CONCAT(u.firstName, ' ', u.lastName) as farmerName,
          mp.plan as packagePeriod,
          FORMAT(mp.payment, 2) as amount,
          DATE_FORMAT(mp.createdAt, '%Y-%m-%d %H:%i') as dateTime
        FROM membershippayment mp
        INNER JOIN users u ON mp.userId = u.id
        ORDER BY mp.createdAt DESC
        LIMIT 6
      `;

      // Get package enrollments (active users only)
      const enrollmentsQuery = `
        SELECT 
          membership_type as membership,
          COUNT(*) as count
        FROM (
          SELECT 
            u.id,
            CASE 
              WHEN u.membership = 'Pro' 
                AND EXISTS (
                  SELECT 1 FROM membershippayment mp 
                  WHERE mp.userId = u.id 
                    AND mp.expireDate > CURRENT_TIMESTAMP()
                )
              THEN 'Pro'
              ELSE 'Basic'
            END as membership_type
          FROM users u
        ) as user_memberships
        GROUP BY membership_type
      `;

      // Get monthly statistics for last 6 months
      // Calculate revenue as sum of (payment / plan_months) for each payment
      const monthlyStatsQuery = `
        SELECT 
          DATE_FORMAT(mp.createdAt, '%Y-%m') as month,
          DATE_FORMAT(mp.createdAt, '%b') as monthName,
          COUNT(*) as payments,
          SUM(
            mp.payment / 
            CAST(SUBSTRING_INDEX(mp.plan, ' ', 1) AS UNSIGNED)
          ) as revenue
        FROM membershippayment mp
        WHERE mp.createdAt >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(mp.createdAt, '%Y-%m'), DATE_FORMAT(mp.createdAt, '%b')
        ORDER BY month ASC
      `;

      // Execute all queries
      plantcare.query(statsQuery, (err1, statsResults) => {
        if (err1) return reject("Error in stats query: " + err1);

        plantcare.query(incomeQuery, (err2, incomeResults) => {
          if (err2) return reject("Error in income query: " + err2);

          plantcare.query(paymentsQuery, (err3, paymentsResults) => {
            if (err3) return reject("Error in payments query: " + err3);

            plantcare.query(enrollmentsQuery, (err4, enrollmentsResults) => {
              if (err4) return reject("Error in enrollments query: " + err4);

              plantcare.query(
                monthlyStatsQuery,
                (err5, monthlyStatsResults) => {
                  if (err5)
                    return reject("Error in monthly stats query: " + err5);

                  // Combine all results
                  const dashboardData = {
                    stats: statsResults[0],
                    income: incomeResults[0],
                    recentPayments: paymentsResults,
                    enrollments: enrollmentsResults,
                    monthlyStatistics: monthlyStatsResults,
                  };

                  resolve(dashboardData);
                },
              );
            });
          });
        });
      });
    } catch (error) {
      reject("Error executing dashboard queries: " + error);
    }
  });
};

// DAO Function
exports.getAllPackagePayments = (page, limit, searchTerm, fromDate, toDate) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let countSql = `
      SELECT COUNT(*) as total
      FROM membershippayment mp
      INNER JOIN users u ON mp.userId = u.id
      WHERE 1=1
    `;

    let dataSql = `
      SELECT 
        mp.id as transactionId,
        CONCAT(u.firstName, ' ', u.lastName) as farmerName,
        CONCAT(u.phoneNumber) as phoneNumber,
        mp.plan as packagePeriod,
        FORMAT(mp.payment, 2) as amount,
        DATE_FORMAT(mp.createdAt, '%d %b, %Y %h:%i%p') as dateTime,
        mp.createdAt as sortDate
      FROM membershippayment mp
      INNER JOIN users u ON mp.userId = u.id
      WHERE 1=1
    `;

    const countParams = [];
    const dataParams = [];

    // Date filtering
    if (fromDate) {
      countSql += " AND DATE(mp.createdAt) >= ?";
      dataSql += " AND DATE(mp.createdAt) >= ?";
      countParams.push(fromDate);
      dataParams.push(fromDate);
    }

    if (toDate) {
      countSql += " AND DATE(mp.createdAt) <= ?";
      dataSql += " AND DATE(mp.createdAt) <= ?";
      countParams.push(toDate);
      dataParams.push(toDate);
    }

    // Search filtering
    if (searchTerm) {
      const searchCondition = `
        AND (
          mp.id LIKE ?
          OR u.firstName LIKE ?
          OR u.lastName LIKE ?
          OR u.phoneNumber LIKE ?
          OR mp.plan LIKE ?
          OR mp.payment LIKE ?
        )
      `;
      countSql += searchCondition;
      dataSql += searchCondition;

      const searchValue = `%${searchTerm}%`;
      countParams.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
      );
      dataParams.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
      );
    }

    // Order by most recent first
    dataSql += " ORDER BY mp.createdAt DESC";

    // Add pagination
    dataSql += " LIMIT ? OFFSET ?";
    dataParams.push(limit, offset);

    // Execute count query
    plantcare.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      // Execute data query
      plantcare.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }

        resolve({ items: dataResults, total });
      });
    });
  });
};

// Function for govi job dashboard data
exports.getAllGovijobDashboardData = () => {
  return new Promise(async (resolve, reject) => {
    try {
      // ===== 1️ Basic stats =====
      const statsQuery = `
        SELECT 
          COUNT(CASE WHEN MONTH(gj.createdAt) = MONTH(CURRENT_DATE()) 
            AND YEAR(gj.createdAt) = YEAR(CURRENT_DATE()) THEN 1 END) AS requestsThisMonth,
          COUNT(CASE WHEN DATE(gj.createdAt) = CURDATE() THEN 1 END) AS requestsToday
        FROM govilinkjobs gj
      `;

      // ===== 2️ Income (current and previous month) =====
      const incomeQuery = `
        SELECT 
          COALESCE(SUM(CASE 
            WHEN MONTH(gjp.createdAt) = MONTH(CURRENT_DATE()) 
              AND YEAR(gjp.createdAt) = YEAR(CURRENT_DATE())
            THEN gjp.amount ELSE 0 END), 0) AS currentMonthIncome,
          COALESCE(SUM(CASE 
            WHEN MONTH(gjp.createdAt) = MONTH(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)) 
              AND YEAR(gjp.createdAt) = YEAR(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
            THEN gjp.amount ELSE 0 END), 0) AS previousMonthIncome
        FROM govijobpayment gjp
      `;

      // ===== 3️ Recent 6 service payments =====
      const recentPaymentsQuery = `
        SELECT 
          gjp.transactionId,
          CONCAT(u.firstName, ' ', u.lastName) AS farmerName,
          os.englishName AS serviceName,
          FORMAT(gjp.amount, 2) AS amount,
          DATE_FORMAT(gjp.createdAt, '%Y-%m-%d %H:%i') AS dateTime
        FROM govijobpayment gjp
        INNER JOIN govilinkjobs gj ON gj.id = gjp.jobId
        INNER JOIN users u ON gj.farmerId = u.id
        INNER JOIN officerservices os ON gj.serviceId = os.id
        ORDER BY gjp.createdAt DESC
        LIMIT 6
      `;

      // ===== 4️ Monthly statistics (for last 6 months) =====
      const monthlyStatsQuery = `
        SELECT 
          DATE_FORMAT(gjp.createdAt, '%Y-%m') AS month,
          DATE_FORMAT(gjp.createdAt, '%b') AS monthName,
          COUNT(gjp.id) AS payments,
          SUM(gjp.amount) AS revenue
        FROM govijobpayment gjp
        WHERE gjp.createdAt >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(gjp.createdAt, '%Y-%m'), DATE_FORMAT(gjp.createdAt, '%b')
        ORDER BY month ASC
      `;

      // ===== Execute all queries =====
      plantcare.query(statsQuery, (err1, statsResults) => {
        if (err1) return reject("Error in stats query: " + err1);

        plantcare.query(incomeQuery, (err2, incomeResults) => {
          if (err2) return reject("Error in income query: " + err2);

          plantcare.query(recentPaymentsQuery, (err3, paymentsResults) => {
            if (err3) return reject("Error in recent payments query: " + err3);

            plantcare.query(monthlyStatsQuery, (err4, monthlyStatsResults) => {
              if (err4) return reject("Error in monthly stats query: " + err4);

              const dashboardData = {
                stats: statsResults[0],
                income: incomeResults[0],
                recentPayments: paymentsResults,
                monthlyStatistics: monthlyStatsResults,
              };

              resolve(dashboardData);
            });
          });
        });
      });
    } catch (error) {
      reject("Error executing Govijob dashboard queries: " + error);
    }
  });
};

exports.getAllCertificateDashboardData = () => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get dashboard statistics
      // Active enrollments: expireDate > current date
      // Total certificates from certificates table
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT c.id) as totalCertificates,
          COUNT(DISTINCT CASE 
            WHEN cp.expireDate > CURRENT_TIMESTAMP()
            THEN cp.id 
          END) as activeEnrollments,
          COUNT(DISTINCT CASE 
            WHEN cp.expireDate <= CURRENT_TIMESTAMP() OR cp.expireDate IS NULL
            THEN cp.id 
          END) as expiredEnrollments
        FROM certificates c
        LEFT JOIN certificationpayment cp ON c.id = cp.certificateId
      `;

      // Get monthly income with comparison to previous month
      // Monthly income = (Certificate Price / No of months) * active user count per certificate
      // Only include valid/active certificates (expireDate > current date for current month)
      // Certificate durations: 1 month, 4 months, 12 months
      // -----------------old one-----------------------------
      // const incomeQuery = `
      //   SELECT
      //     COALESCE(SUM(
      //       CASE
      //         WHEN c.timeLine > 0
      //         THEN (c.price / c.timeLine) * current_users.userCount
      //         ELSE 0
      //       END
      //     ), 0) as currentMonthIncome,
      //     COALESCE(SUM(
      //       CASE
      //         WHEN c.timeLine > 0
      //         THEN (c.price / c.timeLine) * previous_users.userCount
      //         ELSE 0
      //       END
      //     ), 0) as previousMonthIncome
      //   FROM certificates c
      //   LEFT JOIN (
      //     SELECT
      //       certificateId,
      //       COUNT(DISTINCT userId) as userCount
      //     FROM certificationpayment
      //     WHERE expireDate > CURRENT_TIMESTAMP()
      //     GROUP BY certificateId
      //   ) current_users ON c.id = current_users.certificateId
      //   LEFT JOIN (
      //     SELECT
      //       certificateId,
      //       COUNT(DISTINCT userId) as userCount
      //     FROM certificationpayment
      //     WHERE expireDate > DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH)
      //       AND createdAt <= LAST_DAY(DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH))
      //     GROUP BY certificateId
      //   ) previous_users ON c.id = previous_users.certificateId
      //   WHERE c.timeLine IN (1, 4, 12)
      // `;
      // ----------------------------------------------

      const incomeQuery = `
        SELECT 
  -- Current month: only payments NOT expired right now
  COALESCE(SUM(
    CASE 
      WHEN c.timeLine > 0 
        AND cp.expireDate > CURRENT_TIMESTAMP()
      THEN (c.price / c.timeLine)
      ELSE 0
    END
  ), 0) AS currentMonthIncome,

  -- Previous month: payments that were active during last month
  COALESCE(SUM(
    CASE 
      WHEN c.timeLine > 0
        AND cp.expireDate > DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH)
        AND cp.createdAt <= LAST_DAY(DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH))
      THEN (c.price / c.timeLine)
      ELSE 0
    END
  ), 0) AS previousMonthIncome

FROM certificates c
JOIN certificationpayment cp ON c.id = cp.certificateId
WHERE c.timeLine IN (1, 4, 12)
      `;

      // Get recent 6 payments with validity period calculation (FIXED)
      // Now calculates total validity period from createdAt to expireDate
      const paymentsQuery = `
  SELECT 
    cp.transactionId,
    CONCAT(u.firstName, ' ', u.lastName) as farmerName,
    c.srtName as certificateName,
    cp.payType,
    FORMAT(cp.amount, 2) as amount,
    cp.createdAt as dateTime,
    DATE_FORMAT(cp.expireDate, '%Y-%m-%d') as expiryDate,
    CASE 
      WHEN cp.expireDate IS NULL OR cp.createdAt IS NULL THEN 'Expired'
      ELSE CONCAT(
        TIMESTAMPDIFF(MONTH, cp.createdAt, cp.expireDate),
        ' month',
        CASE WHEN TIMESTAMPDIFF(MONTH, cp.createdAt, cp.expireDate) != 1 THEN 's' ELSE '' END,
        ' ',
        DATEDIFF(
          cp.expireDate, 
          DATE_ADD(cp.createdAt, INTERVAL TIMESTAMPDIFF(MONTH, cp.createdAt, cp.expireDate) MONTH)
        ),
        ' day',
        CASE 
          WHEN DATEDIFF(
            cp.expireDate, 
            DATE_ADD(cp.createdAt, INTERVAL TIMESTAMPDIFF(MONTH, cp.createdAt, cp.expireDate) MONTH)
          ) != 1 THEN 's' 
          ELSE '' 
        END
      )
    END as validityMonths
  FROM certificationpayment cp
  INNER JOIN users u ON cp.userId = u.id
  INNER JOIN certificates c ON cp.certificateId = c.id
  ORDER BY cp.createdAt DESC
  LIMIT 6
`;

      // Get certificate type breakdown by payType from certificationpayment table
      const certificateTypesQuery = `
        SELECT 
          cp.payType,
          COUNT(DISTINCT cp.id) as count
        FROM certificationpayment cp
        WHERE cp.payType IS NOT NULL
        GROUP BY cp.payType
      `;

      // Get monthly statistics for last 12 months
      const monthlyStatsQuery = `
        SELECT 
          DATE_FORMAT(cp.createdAt, '%Y-%m') as month,
          DATE_FORMAT(cp.createdAt, '%b') as monthName,
          COUNT(*) as payments,
          SUM(
            CASE 
              WHEN c.timeLine > 0 
              THEN cp.amount / c.timeLine
              ELSE 0
            END
          ) as revenue
        FROM certificationpayment cp
        INNER JOIN certificates c ON cp.certificateId = c.id
        WHERE cp.createdAt >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(cp.createdAt, '%Y-%m'), DATE_FORMAT(cp.createdAt, '%b')
        ORDER BY month ASC
      `;

      // Execute all queries
      plantcare.query(statsQuery, (err1, statsResults) => {
        if (err1) return reject("Error in stats query: " + err1);

        plantcare.query(incomeQuery, (err2, incomeResults) => {
          if (err2) return reject("Error in income query: " + err2);

          plantcare.query(paymentsQuery, (err3, paymentsResults) => {
            if (err3) return reject("Error in payments query: " + err3);

            plantcare.query(
              certificateTypesQuery,
              (err4, certificateTypesResults) => {
                if (err4)
                  return reject("Error in certificate types query: " + err4);

                plantcare.query(
                  monthlyStatsQuery,
                  (err5, monthlyStatsResults) => {
                    if (err5)
                      return reject("Error in monthly stats query: " + err5);

                    // Combine all results
                    const dashboardData = {
                      stats: statsResults[0],
                      income: incomeResults[0],
                      recentPayments: paymentsResults,
                      certificateTypes: certificateTypesResults,
                      monthlyStatistics: monthlyStatsResults,
                    };

                    resolve(dashboardData);
                  },
                );
              },
            );
          });
        });
      });
    } catch (error) {
      reject("Error executing certificate dashboard queries: " + error);
    }
  });
};

exports.getAllServicePayments = (page, limit, searchTerm, fromDate, toDate) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let countSql = `
      SELECT COUNT(*) as total
      FROM govijobpayment gjp
      INNER JOIN govilinkjobs gj ON gj.id = gjp.jobId
      INNER JOIN users u ON gj.farmerId = u.id
      INNER JOIN officerservices os ON gj.serviceId = os.id
      WHERE 1=1
    `;

    let dataSql = `
      SELECT 
        gjp.transactionId,
        CONCAT(u.firstName, ' ', u.lastName) AS farmerName,
        os.englishName AS serviceName,
        FORMAT(gjp.amount, 2) AS amount,
        DATE_FORMAT(gjp.createdAt, '%Y-%m-%d %H:%i') AS dateTime,
        gjp.createdAt as sortDate,
        u.firstName,  -- Add these for debugging
        u.lastName    -- Add these for debugging
      FROM govijobpayment gjp
      INNER JOIN govilinkjobs gj ON gj.id = gjp.jobId
      INNER JOIN users u ON gj.farmerId = u.id
      INNER JOIN officerservices os ON gj.serviceId = os.id
      WHERE 1=1
    `;

    const countParams = [];
    const dataParams = [];

    // Date filtering
    if (fromDate) {
      countSql += " AND DATE(gjp.createdAt) >= ?";
      dataSql += " AND DATE(gjp.createdAt) >= ?";
      countParams.push(fromDate);
      dataParams.push(fromDate);
    }

    if (toDate) {
      countSql += " AND DATE(gjp.createdAt) <= ?";
      dataSql += " AND DATE(gjp.createdAt) <= ?";
      countParams.push(toDate);
      dataParams.push(toDate);
    }

    // Search filtering - IMPROVED VERSION
    if (searchTerm) {
      const searchCondition = `
        AND (
          gjp.transactionId LIKE ?
          OR CONCAT(u.firstName, ' ', u.lastName) LIKE ?  -- Search concatenated name
          OR u.firstName LIKE ?
          OR u.lastName LIKE ?
          OR CONCAT(u.lastName, ' ', u.firstName) LIKE ?  -- Search reverse order
          OR os.englishName LIKE ?
          OR gjp.amount LIKE ?
        )
      `;
      countSql += searchCondition;
      dataSql += searchCondition;

      const searchValue = `%${searchTerm}%`;
      // Add searchValue for each condition (7 times)
      for (let i = 0; i < 7; i++) {
        countParams.push(searchValue);
        dataParams.push(searchValue);
      }
    }

    // Order by most recent first
    dataSql += " ORDER BY gjp.createdAt DESC";

    // Add pagination
    dataSql += " LIMIT ? OFFSET ?";
    dataParams.push(limit, offset);

    // Execute count query
    plantcare.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      // Execute data query
      plantcare.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }
        // Remove the firstName and lastName from final response if you don't want them
        const formattedResults = dataResults.map((item) => {
          const { firstName, lastName, ...rest } = item;
          return rest;
        });

        resolve({ items: formattedResults, total });
      });
    });
  });
};

exports.getAllCertificatePayments = (
  page,
  limit,
  searchTerm,
  fromDate,
  toDate,
) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let countSql = `
      SELECT COUNT(*) as total
      FROM certificationpayment cp
      LEFT JOIN users u ON cp.userId = u.id
      LEFT JOIN farmcluster fc ON cp.clusterId = fc.id
      WHERE 1=1
    `;

    let dataSql = `
      SELECT 
        cp.transactionId,
        cp.payType,
        CASE 
          WHEN cp.payType = 'Cluster' THEN fc.clsName
          ELSE CONCAT(u.firstName, ' ', u.lastName)
        END as farmerName,
        FORMAT(cp.amount, 2) as amount,
    DATE_FORMAT(cp.createdAt, '%Y-%m-%d %H:%i') as dateTime,
    DATE_FORMAT(cp.expireDate, '%Y-%m-%d') as expiryDate,
    CASE 
      WHEN cp.expireDate IS NULL OR cp.createdAt IS NULL THEN 'Expired'
      ELSE CONCAT(
        TIMESTAMPDIFF(MONTH, cp.createdAt, cp.expireDate),
        ' month',
        CASE WHEN TIMESTAMPDIFF(MONTH, cp.createdAt, cp.expireDate) != 1 THEN 's' ELSE '' END,
        ' ',
        DATEDIFF(
          cp.expireDate, 
          DATE_ADD(cp.createdAt, INTERVAL TIMESTAMPDIFF(MONTH, cp.createdAt, cp.expireDate) MONTH)
        ),
        ' day',
        CASE 
          WHEN DATEDIFF(
            cp.expireDate, 
            DATE_ADD(cp.createdAt, INTERVAL TIMESTAMPDIFF(MONTH, cp.createdAt, cp.expireDate) MONTH)
          ) != 1 THEN 's' 
          ELSE '' 
        END
          )
        END as validityPeriod
      FROM certificationpayment cp
      LEFT JOIN users u ON cp.userId = u.id
      LEFT JOIN farmcluster fc ON cp.clusterId = fc.id
      WHERE 1=1
    `;

    const countParams = [];
    const dataParams = [];

    // Date filtering
    if (fromDate) {
      countSql += " AND DATE(cp.createdAt) >= ?";
      dataSql += " AND DATE(cp.createdAt) >= ?";
      countParams.push(fromDate);
      dataParams.push(fromDate);
    }

    if (toDate) {
      countSql += " AND DATE(cp.createdAt) <= ?";
      dataSql += " AND DATE(cp.createdAt) <= ?";
      countParams.push(toDate);
      dataParams.push(toDate);
    }

    // Search filtering
    if (searchTerm) {
      const searchCondition = `
        AND (
          cp.transactionId LIKE ?
          OR u.firstName LIKE ?
          OR u.lastName LIKE ?
          OR CONCAT(u.firstName, ' ', u.lastName) LIKE ?
          OR fc.clsName LIKE ?
          OR cp.amount LIKE ?
        )
      `;
      countSql += searchCondition;
      dataSql += searchCondition;

      const searchValue = `%${searchTerm}%`;
      countParams.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
      );
      dataParams.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
      );
    }

    // Order by most recent first
    dataSql += " ORDER BY cp.createdAt DESC";

    // Add pagination
    dataSql += " LIMIT ? OFFSET ?";
    dataParams.push(limit, offset);

    // Execute count query
    plantcare.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      // Execute data query
      plantcare.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }

        resolve({ items: dataResults, total });
      });
    });
  });
};

// Get all agent commissions with user information and formatted range
exports.getAllAgentCommissions = (page, limit, searchTerm = "") => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let countSql = `SELECT COUNT(*) as total FROM agentcommission WHERE 1=1`;
    let dataSql = `
      SELECT 
        ac.id,
        ac.slot,
        ac.minRange,
        ac.maxRange,
        CONCAT(ac.minRange, '-', ac.maxRange) AS rangeText, -- formatted range
        ac.value,
        ac.modifyDate,
        ac.modifyBy,
        ac.createdAt,
        au.userName as modifyByName,
        au.mail as modifyByEmail
      FROM agentcommission ac
      LEFT JOIN agro_world_admin.adminusers au ON ac.modifyBy = au.id
      WHERE 1=1
    `;

    const countParams = [];
    const dataParams = [];

    // Search filtering
    if (searchTerm) {
      const searchCondition = `
        AND (
          ac.slot LIKE ?
          OR ac.minRange LIKE ?
          OR ac.maxRange LIKE ?
          OR ac.value LIKE ?
          OR au.userName LIKE ?
        )
      `;
      countSql += searchCondition;
      dataSql += searchCondition;

      const searchValue = `%${searchTerm}%`;
      countParams.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
      );
      dataParams.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
      );
    }

    // Order by minRange and maxRange for sequential ranges
    dataSql += " ORDER BY ac.minRange ASC, ac.maxRange ASC";

    // Add pagination
    dataSql += " LIMIT ? OFFSET ?";
    dataParams.push(limit, offset);

    // Execute count query
    marketPlace.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      // Execute data query
      marketPlace.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }

        resolve({
          items: dataResults,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        });
      });
    });
  });
};

// Get agent commission by ID
exports.getAgentCommissionById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        ac.id,
        ac.slot,
        ac.minRange,
        ac.maxRange,
        ac.value,
        ac.modifyDate,
        ac.modifyBy,
        ac.createdAt,
        au.userName as modifyByName,
        au.mail as modifyByEmail
      FROM agentcommission ac
      LEFT JOIN agro_world_admin.adminusers au ON ac.modifyBy = au.id
      WHERE ac.id = ?
    `;

    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        console.error("Error fetching agent commission:", err);
        return reject(err);
      }
      resolve(results[0] || null);
    });
  });
};

// Create new agent commission
exports.createAgentCommission = (commissionData) => {
  return new Promise((resolve, reject) => {
    const { minRange, maxRange, value, modifyBy } = commissionData;

    const sql = `
      INSERT INTO agentcommission (minRange, maxRange, value, modifyBy, modifyDate)
      VALUES (?, ?, ?, ?, NOW())
    `;

    marketPlace.query(
      sql,
      [minRange, maxRange, value, modifyBy],
      (err, results) => {
        if (err) {
          console.error("Error creating agent commission:", err);
          return reject(err);
        }

        // Get the newly created commission with user info
        this.getAgentCommissionById(results.insertId)
          .then((newCommission) => resolve(newCommission))
          .catch(reject);
      },
    );
  });
};

// Update agent commission with previous value check
exports.updateAgentCommission = (id, updateData) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Fetch existing commission
      const existingCommission = await this.getAgentCommissionById(id);
      if (!existingCommission) return resolve(null);

      const fields = [];
      const values = [];

      // Compare and include only changed fields
      if (
        updateData.slot !== undefined &&
        updateData.slot !== existingCommission.slot
      ) {
        fields.push("slot = ?");
        values.push(updateData.slot);
      }

      if (
        updateData.minRange !== undefined &&
        updateData.minRange !== existingCommission.minRange
      ) {
        fields.push("minRange = ?");
        values.push(updateData.minRange);
      }

      if (
        updateData.maxRange !== undefined &&
        updateData.maxRange !== existingCommission.maxRange
      ) {
        fields.push("maxRange = ?");
        values.push(updateData.maxRange);
      }

      if (
        updateData.value !== undefined &&
        parseFloat(updateData.value) !== parseFloat(existingCommission.value)
      ) {
        fields.push("value = ?");
        values.push(updateData.value);
      }

      // If nothing changed, just return existing row
      if (fields.length === 0) {
        return resolve(existingCommission);
      }

      // Include modifyBy and modifyDate
      if (updateData.modifyBy !== undefined) {
        fields.push("modifyBy = ?");
        values.push(updateData.modifyBy);
      }
      fields.push("modifyDate = NOW()");

      // Add id for WHERE clause
      values.push(id);

      const sql = `UPDATE agentcommission SET ${fields.join(
        ", ",
      )} WHERE id = ?`;

      // Execute update
      marketPlace.query(sql, values, (err, results) => {
        if (err) {
          console.error("Error updating agent commission:", err);
          return reject(err);
        }

        if (results.affectedRows === 0) return resolve(null);

        // Return updated row
        this.getAgentCommissionById(id).then(resolve).catch(reject);
      });
    } catch (err) {
      reject(err);
    }
  });
};

// Delete agent commission
exports.deleteAgentCommission = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM agentcommission WHERE id = ?`;

    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        console.error("Error deleting agent commission:", err);
        return reject(err);
      }
      resolve(results.affectedRows > 0);
    });
  });
};

// Check for overlapping ranges
exports.checkRangeOverlap = (minRange, maxRange, excludeId = null) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT COUNT(*) as count
      FROM agentcommission
      WHERE (
        (minRange <= ? AND maxRange >= ?) OR
        (minRange <= ? AND maxRange >= ?) OR
        (minRange >= ? AND maxRange <= ?)
      )
    `;

    const params = [minRange, minRange, maxRange, maxRange, minRange, maxRange];

    if (excludeId) {
      sql += " AND id != ?";
      params.push(excludeId);
    }

    marketPlace.query(sql, params, (err, results) => {
      if (err) {
        console.error("Error checking range overlap:", err);
        return reject(err);
      }
      resolve(results[0].count > 0);
    });
  });
};

exports.getAllFarmerPaymentDao = (date, bank) => {
  return new Promise((resolve, reject) => {
    const params = [];
    let sql = `
      SELECT 
        rfp.id,
        rfp.invNo,
        CONCAT(u.firstName, ' ', u.lastName) AS farmerName,
        u.NICnumber,
        u.phoneNumber,
        SUM(fpc.gradeAprice * fpc.gradeAquan + fpc.gradeBprice * fpc.gradeBquan + fpc.gradeCprice * fpc.gradeCquan) AS totalPayment,
        ub.bankName,
        ub.branchName,
        ub.accNumber,
        rfp.createdAt
      FROM registeredfarmerpayments rfp
      LEFT JOIN farmerpaymentscrops fpc ON rfp.id = fpc.registerFarmerId
      LEFT JOIN plant_care.users u ON rfp.userId = u.id
      LEFT JOIN plant_care.userbankdetails ub ON u.id = ub.userId
      WHERE 1=1
    `;

    if (date) {
      sql += ` AND DATE(rfp.createdAt) = ? `;
      params.push(date);
    }

    if (bank) {
      sql += ` AND ub.bankName = ? `;
      params.push(bank);
    }

    sql += ` 
      GROUP BY 
        rfp.id,
        rfp.invNo,
        u.firstName,
        u.lastName,
        u.NICnumber,
        u.phoneNumber,
        ub.bankName,
        ub.branchName,
        ub.accNumber,
        rfp.createdAt
      ORDER BY rfp.createdAt DESC `;

    collectionofficer.query(sql, params, (err, results) => {
      if (err) {
        console.error("Error fetching farmer payments:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.InsertPaymentHistoryDAO = (
  receivers,
  amount,
  payRef,
  xlLink,
  issueBy,
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO paymenthistory (receivers, amount, payRef, xlLink, issueBy)
      VALUES (?, ?, ?, ?, ?)
    `;

    const params = [receivers, amount, payRef, xlLink, issueBy];

    admin.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.UpdatePaymentHistoryDAO = (
  id,
  receivers,
  amount,
  payRef,
  xlLink,
  modifyBy,
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE paymenthistory 
      SET 
        receivers = ?,
        amount = ?,
        payRef = ?,
        xlLink = ?,
        modifyBy = ?
      WHERE id = ?
    `;

    const params = [receivers, amount, payRef, xlLink, modifyBy, id];

    admin.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.affectedRows === 0) {
        return reject(new Error("Payment history record not found"));
      }

      resolve(results);
    });
  });
};

exports.GetPaymentHistoryByIdDAO = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        ph.id,
        ph.receivers,
        ph.amount,
        ph.payRef,
        ph.xlLink,
        ph.issueBy,
        ph.modifyBy,
        ph.createdAt,
        issuer.userName AS issuerName,
        modifier.userName AS modifierName
      FROM paymenthistory ph
      LEFT JOIN adminusers issuer ON ph.issueBy = issuer.id
      LEFT JOIN adminusers modifier ON ph.modifyBy = modifier.id
      WHERE ph.id = ?
    `;

    admin.query(sql, [id], (err, results) => {
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

exports.GetAllPaymentHistoryDAO = (filters = {}) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        ph.id,
        ph.receivers,
        ph.amount,
        ph.payRef,
        ph.xlLink,
        ph.issueBy,
        ph.modifyBy,
        ph.createdAt,
        issuer.userName AS issuerName,
        issuer.mail AS issuerEmail,
        modifier.userName AS modifierName
      FROM paymenthistory ph
      LEFT JOIN adminusers issuer ON ph.issueBy = issuer.id
      LEFT JOIN adminusers modifier ON ph.modifyBy = modifier.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by receivers
    if (filters.receivers) {
      sql += ` AND ph.receivers = ?`;
      params.push(filters.receivers);
    }

    // Filter by issuedDate (single date)
    if (filters.issuedDate) {
      sql += ` AND DATE(ph.createdAt) = ?`;
      params.push(filters.issuedDate);
    }

    // Search filter
    if (filters.search) {
      sql += ` AND (
        ph.receivers LIKE ? OR 
        issuer.userName LIKE ? OR 
        ph.payRef LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Order by most recent first
    sql += ` ORDER BY ph.createdAt DESC`;

    admin.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.DeletePaymentHistoryDAO = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM paymenthistory WHERE id = ?`;

    admin.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.affectedRows === 0) {
        return reject(new Error("Payment history record not found"));
      }

      resolve(results);
    });
  });
};

exports.GetAllInvestmentRequestsDAO = (filters = {}) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        ir.id AS No,
        ir.jobId AS Request_ID,
        CONCAT(u.firstName, ' ', u.lastName) AS Farmer_Name,
        u.phoneNumber AS Phone_number,
        u.id AS Farmer_ID,
        u.district,
        co.empId,
        ir.publishStatus,
        CASE 
          WHEN ir.officerId IS NULL THEN 'Not Assigned'
          ELSE 'Assigned'
        END AS Status,
        COALESCE(co.empId, '--') AS Officer_ID,
        ir.nicFront AS NIC_Front_Image,
        ir.nicBack AS NIC_Back_Image,
        DATE_FORMAT(ir.createdAt, 'At %h:%i%p on %M %d, %Y') AS Request_Date_Time,
        DATE_FORMAT(ir.createdAt, '%M %d, %Y') AS Requested_On,
        COALESCE(ao.userName, '--') AS Assigned_By,
        ir.officerStatus
      FROM investmentrequest ir
      INNER JOIN plant_care.users u ON ir.farmerId = u.id
      LEFT JOIN plant_care.feildofficer co ON ir.officerId = co.id
      LEFT JOIN agro_world_admin.adminusers ao ON ir.assignedBy = ao.id
      WHERE ir.reqStatus = 'Pending'
    `;

    const params = [];

    // Filter by status (Not Assigned or Assigned)
    if (filters.status) {
      if (filters.status === "Not Assigned") {
        sql += ` AND ir.officerId IS NULL`;
      } else if (filters.status === "Assigned") {
        sql += ` AND ir.officerId IS NOT NULL`;
      }
    }

    // Search filter (searches in Request ID, Phone Number, Collection Officer EMP ID)
    if (filters.search) {
      sql += ` AND (
        ir.jobId LIKE ? OR 
        u.phoneNumber LIKE ? OR 
        co.empId LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Order by most recent first
    sql += ` ORDER BY ir.id`;

    investment.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.GetInvestmentRequestByIdDAO = (requestId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        ir.jobId AS Request_ID,
        CONCAT(u.firstName, ' ', u.lastName) AS Farmer_Name,
        u.NICnumber AS NIC_Number,
        u.phoneNumber AS Phone_number,
        cg.cropNameEnglish AS Crop,
        ir.extentac AS Extent,
        ir.extentha AS ExtentH,
        ir.extentp AS ExtentP,
        ir.investment AS Expected_Investment,
        ir.expectedYield AS Expected_Yield,
        DATE_FORMAT(ir.startDate, '%M %d, %Y') AS Expected_Start_Date,
        DATE_FORMAT(ir.createdAt, 'At %h:%i%p on %M %d, %Y') AS Request_Date_Time
      FROM investmentrequest ir
      INNER JOIN plant_care.users u ON ir.farmerId = u.id
      LEFT JOIN plant_care.cropgroup cg ON ir.cropId = cg.id
      WHERE ir.jobId = ?
      LIMIT 1
    `;

    investment.query(sql, [requestId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0] || null);
    });
  });
};

exports.GetApprovedInvestmentRequestByIdDAO = (requestId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        ir.jobId AS Request_ID,
        CONCAT(u.firstName, ' ', u.lastName) AS Farmer_Name,
        u.NICnumber AS NIC_Number,
        u.phoneNumber AS Phone_number,
        cg.cropNameEnglish AS Crop,
        CONCAT(
          COALESCE(ir.extentha, 0), ' Acres ',
          COALESCE(ir.extentac, 0), ' Perches'
        ) AS Extent,
        ir.investment AS Expected_Investment,
        ir.reqStatus,
        CONCAT(ir.expectedYield, 'kg') AS Expected_Yield,
        DATE_FORMAT(ir.startDate, '%M %d, %Y') AS Expected_Start_Date,
        DATE_FORMAT(ir.createdAt, 'At %h:%i%p on %M %d, %Y') AS Request_Date_Time
      FROM investmentrequest ir
      INNER JOIN plant_care.users u ON ir.farmerId = u.id
      LEFT JOIN plant_care.cropgroup cg ON ir.cropId = cg.id
      WHERE ir.id = ?
      LIMIT 1
    `;

    investment.query(sql, [requestId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0] || null);
    });
  });
};

exports.assignOfficerToInvestmentRequestDAO = (
  requestId,
  assignOfficerId,
  assignByUserId,
) => {
  return new Promise(async (resolve, reject) => {
    let connection;

    try {
      connection = await investment.promise().getConnection();
      await connection.beginTransaction();

      // Check if investment request exists
      const [requestExists] = await connection.query(
        `SELECT id FROM investmentrequest WHERE id = ?`,
        [requestId],
      );

      if (requestExists.length === 0) {
        await connection.rollback();
        return reject(new Error("Investment request not found"));
      }

      // Check if officer exists and is active
      const [officerExists] = await connection.query(
        `SELECT id FROM plant_care.feildofficer WHERE id = ? AND status = 'Approved'`,
        [assignOfficerId],
      );

      if (officerExists.length === 0) {
        await connection.rollback();
        return reject(new Error("Officer not found or not Approved"));
      }

      // Build dynamic update query
      let updateQuery = `
        UPDATE investmentrequest 
        SET officerId = ?, assignDate = NOW()
      `;
      const queryParams = [assignOfficerId];

      // Add assignBy if provided
      if (assignByUserId) {
        updateQuery += `, assignedBy = ?`;
        queryParams.push(assignByUserId);
      }

      updateQuery += ` WHERE id = ?`;
      queryParams.push(requestId);

      // Update the investment request with the assigned officer
      const [result] = await connection.query(updateQuery, queryParams);

      if (result.affectedRows === 0) {
        await connection.rollback();
        return reject(
          new Error("Investment request not found or no changes made"),
        );
      }

      await connection.commit();

      // Prepare response data
      const responseData = {
        requestId,
        assignOfficerId,
        assignDate: new Date(),
      };

      // Add assignBy to response if provided
      if (assignByUserId) {
        responseData.assignedBy = assignByUserId;
      }

      resolve(responseData);
    } catch (err) {
      if (connection) await connection.rollback();
      reject(err);
    } finally {
      if (connection) connection.release();
    }
  });
};

exports.getOfficersByDistrictAndRoleForInvestmentDAO = (
  district,
  jobRole,
  Farmer_ID,
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        fo.id,
        fo.empId,
        fo.firstName,
        fo.lastName,
        fo.JobRole,
        fo.distrct as district,
        fo.assignDistrict,
        (
          SELECT COUNT(*)
          FROM investmentrequest ir 
          WHERE ir.officerId = fo.id 
        ) AS jobCount
      FROM 
        plant_care.feildofficer fo
      INNER JOIN 
        plant_care.users u ON FIND_IN_SET(LOWER(u.district), LOWER(REPLACE(fo.assignDistrict, ' ', ''))) > 0
      WHERE 
        u.id = ?
        AND fo.JobRole = ?
        AND fo.status = 'Approved'
      ORDER BY 
        jobCount ASC, fo.firstName, fo.lastName
    `;

    const params = [Farmer_ID, jobRole];

    investment.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

exports.getAllPublishedProjectsDAO = (searchText) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT DISTINCT
        ir.id, 
        u.firstName, 
        u.lastName, 
        u.phoneNumber, 
        u.NICnumber AS farmerNic,
        cg.cropNameEnglish, 
        ir.assignDate, 
        ir.assignedBy, 
        ir.jobId, 
        ir.publishStatus, 
        ir.reqStatus, 
        ir.nicFront, 
        ir.nicBack,
        ir.extentha, 
        ir.extentac, 
        ir.extentp, 
        ir.expectedYield, 
        ir.startDate, 
        ir.investment, 
        COALESCE(air.defineShares, 0) AS defineShares, 
        COALESCE(( SELECT SUM(i.shares) FROM investment i WHERE i.reqId = ir.id AND i.invtStatus = 'Approved' ), 0) AS shares, 
        ir.publishDate, 
        au.userName AS publishedBy
      FROM investmentrequest ir
      LEFT JOIN plant_care.users u ON ir.farmerId = u.id
      LEFT JOIN plant_care.cropgroup cg ON ir.cropId = cg.id
      LEFT JOIN agro_world_admin.adminusers au ON ir.publishBy = au.id
      LEFT JOIN approvedinvestmentrequest air ON ir.id = air.reqId
      WHERE ir.reqStatus = 'Approved'
      AND ir.publishStatus = 'Published';
    `;

    const params = [];

    if (searchText) {
      sql += `
        AND (
          ir.jobId LIKE ?
          OR CONCAT(u.firstName, ' ', u.lastName) LIKE ?
          OR u.phoneNumber LIKE ?
        )
      `;

      const searchValue = `%${searchText}%`;
      params.push(searchValue, searchValue, searchValue);
    }

    investment.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

exports.GetAllRejectedInvestmentRequestsDAO = (filters = {}) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
    ir.id,
    ir.farmerId,
    ir.officerId,
    ir.jobId,
    ir.extentha,
    ir.extentac,
    ir.extentp,
    (ir.extentac + ir.extentha * 2.47105 + ir.extentp / 160) AS extentac,
    ir.investment,
    ir.expectedYield,
    ir.startDate,
    ir.nicFront,
    ir.nicBack,
    ir.assignDate,
    ir.publishDate,
    ir.assignedBy,
    ir.reqStatus,
    ir.reqCahangeTime,
    ir.publishStatus,
    ir.createdAt,
    rir.reason AS rejectionReason,
    rir.createdAt AS rejectedAt,
    u.firstName,
    u.lastName,
    u.phoneNumber,
    u.NICnumber,
    cg.cropNameEnglish,
    au.userName AS rejectedBy
FROM investments.investmentrequest ir
LEFT JOIN investments.rejectinvestmentrequest rir ON ir.id = rir.reqId
LEFT JOIN plant_care.users u ON ir.farmerId = u.id
LEFT JOIN plant_care.cropgroup cg ON ir.cropId = cg.id
LEFT JOIN agro_world_admin.adminusers au ON rir.rejectedBy = au.id
WHERE ir.reqStatus = 'Rejected'
    `;

    const params = [];

    // Only keep general search function (searches in both reqId and phoneNumber)
    if (filters.search) {
      sql += ` AND (ir.jobId LIKE ? OR u.phoneNumber LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    // Order by most recent rejection first
    sql += ` ORDER BY rir.createdAt DESC`;

    investment.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.GetAllApprovedInvestmentRequestsDAO = (filters = {}) => {
  console.log("filters", filters);
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        ir.id AS No,
        ir.jobId AS Request_ID,
        CONCAT(u.firstName, ' ', u.lastName) AS Farmer_Name,
        u.phoneNumber AS Phone_number,
        u.district,
        co.empId,
        COALESCE(ir.publishStatus, 'Draft') AS publishStatus,
        ir.nicFront AS NIC_Front_Image,
        ir.nicBack AS NIC_Back_Image,
        DATE_FORMAT(CONVERT_TZ(ir.reqCahangeTime, '+00:00', '+05:30'), '%h:%i%p on %M %d, %Y') AS Request_Date_Time,
        COALESCE(ao.userName, '--') AS Assigned_By,
        COALESCE(ao2.userName, '--') AS Approved_By,
        ( 
          SELECT JSON_OBJECT(
            'approveId',air.id,
            'totValue', air.totValue,
            'defineShares', air.defineShares,
            'minShare', air.minShare,
            'maxShare', air.maxShare,
            'defineBy', aou.userName,
            'definedAt', air.createdAt
         )
         FROM approvedinvestmentrequest air
         LEFT JOIN agro_world_admin.adminusers aou ON air.defineBy = aou.id
         WHERE air.reqId = ir.id
        ) AS approvedDetails
      FROM investmentrequest ir
      INNER JOIN plant_care.users u ON ir.farmerId = u.id
      LEFT JOIN plant_care.feildofficer co ON ir.officerId = co.id
      LEFT JOIN agro_world_admin.adminusers ao ON ir.assignedBy = ao.id
      LEFT JOIN agro_world_admin.adminusers ao2 ON ir.approvedBy = ao2.id
      WHERE ir.reqStatus = 'Approved'
    `;
    // DATE_FORMAT(ir.reqCahangeTime, '%h:%i%p on %M %d, %Y') AS Request_Date_Time,
    const params = [];

    // Filter by publish status (Draft or Published)
    if (filters.status) {
      sql += ` AND COALESCE(ir.publishStatus, 'Draft') = ?`;
      params.push(filters.status);
    }

    // Filter by shares division status
    if (filters.shares) {
      if (filters.shares === "Divided") {
        // Get records that have at least one row in approvedinvestmentrequest
        sql += ` AND EXISTS (
          SELECT 1 FROM approvedinvestmentrequest air 
          WHERE air.reqId = ir.id
        )`;
      } else if (filters.shares === "Not Divided") {
        // Get records that have no rows in approvedinvestmentrequest
        sql += ` AND NOT EXISTS (
          SELECT 1 FROM approvedinvestmentrequest air 
          WHERE air.reqId = ir.id
        )`;
      }
    }

    // Search filter (searches in Request ID, Phone Number, EMP ID)
    if (filters.search) {
      sql += ` AND (
        ir.jobId LIKE ? OR 
        u.phoneNumber LIKE ? OR 
        co.empId LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Order by most recent approval first
    sql += ` ORDER BY ir.createdAt DESC`;

    investment.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.UpdateInvestmentRequestPublishStatusDAO = (requestId, publishBy) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE investmentrequest 
      SET publishStatus = 'Published',
          publishDate = NOW(),
          publishBy = ?
      WHERE id = ?
    `;

    investment.query(sql, [publishBy, requestId], (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

exports.GetProjectInvesmentDAO = (filters = {}) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        ir.id,
        u.phoneNumber,
        cg.image AS cropGroupImage,
        cg.cropNameEnglish,
        ir.jobId,
        ai.defineShares,
        ( SELECT SUM(i.shares) FROM investment i WHERE i.reqId = ir.id AND i.invtStatus = 'Approved' ) AS fillShares
      FROM investmentrequest ir
      INNER JOIN plant_care.cropgroup cg ON ir.cropId = cg.id
      INNER JOIN plant_care.users u ON ir.farmerId = u.id
      LEFT JOIN approvedinvestmentrequest ai ON ir.id = ai.reqId
      WHERE ir.reqStatus = 'Approved' AND publishStatus = 'Published'
    `;

    const params = [];

    // Search filter (searches in ID, Phone Number, Crop Name English, and jobId)
    if (filters.search) {
      sql += ` AND (
        CAST(ir.id AS CHAR) LIKE ? OR 
        u.phoneNumber LIKE ? OR 
        cg.cropNameEnglish LIKE ? OR
        ir.jobId LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    sql += ` ORDER BY cg.cropNameEnglish, (fillShares/ai.defineShares) DESC`;

    investment.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getAllInvestmentsDao = (id, status, search) => {
  return new Promise((resolve, reject) => {
    let dataSql = `
    SELECT
        i.id,
        i.reqId,
        iu.regCode AS regCode,
        i.refCode,
        i.shares,
        i.totInvt,
        i.nicFront,
        i.nicBack,
        i.invtStatus,
        i.bankSlip,
        iu.phoneNumber,
        iu.phoneCode,
        i.createdAt
        FROM investment i 
        LEFT JOIN investmentusers iu  ON i.investerId = iu.id
        WHERE i.reqId = ?
    `;

    const params = [id];

    if (search) {
      dataSql += `
      AND ( 
        i.refCode LIKE ?
        OR iu.regCode LIKE ?
        OR iu.phoneNumber LIKE ?
       )
      `;

      const searchValue = `%${search}%`;
      params.push(searchValue, searchValue, searchValue);
    }

    if (status) {
      dataSql += `AND i.invtStatus = ?`;
      params.push(status);
    }

    dataSql += " ORDER BY i.createdAt DESC";

    investment.query(dataSql, params, (dataErr, dataResults) => {
      if (dataErr) {
        console.error("Error in data query:", dataErr);
        return reject(dataErr);
      }
      resolve({
        items: dataResults,
      });
    });
  });
};

exports.approveInvestmentRequestDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE investment
      SET invtStatus = 'Approved'
      WHERE id = ?
    `;

    investment.query(sql, [id], (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

exports.RejectInvestmentRequestDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE investment
      SET invtStatus = 'Rejected'
      WHERE id = ?
    `;

    investment.query(sql, [id], (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

exports.getInspectionDerailsDao = async (id) => {
  return new Promise((resolve, reject) => {
    const queries = [
      {
        sql: `SELECT * FROM inspectionpersonal WHERE reqId = ?`,
        key: "Personal",
      },
      { sql: `SELECT * FROM inspectionidproof WHERE reqId = ?`, key: "ID" },
      {
        sql: `SELECT * FROM inspectionfinance WHERE reqId = ?`,
        key: "Finance",
      },
      { sql: `SELECT * FROM inspectionland WHERE reqId = ?`, key: "Land" },
      {
        sql: `SELECT * FROM inspectioninvestment WHERE reqId = ?`,
        key: "Investment",
      },
      {
        sql: `SELECT * FROM inspectioncultivation WHERE reqId = ?`,
        key: "Cultivation",
      },
      {
        sql: `SELECT * FROM inspectioncropping WHERE reqId = ?`,
        key: "Cropping",
      },
      {
        sql: `SELECT * FROM inspectionprofit WHERE reqId = ?`,
        key: "ProfitRisk",
      },
      {
        sql: `SELECT * FROM inspectioneconomical WHERE reqId = ?`,
        key: "Economical",
      },
      { sql: `SELECT * FROM inspectionlabour WHERE reqId = ?`, key: "Labor" },
      {
        sql: `SELECT * FROM inspectionharveststorage WHERE reqId = ?`,
        key: "Harvest",
      },
    ];

    const result = {
      Personal: {},
      ID: {},
      Finance: {},
      Land: {},
      Investment: {},
      Cultivation: {},
      Cropping: {},
      ProfitRisk: {},
      Economical: {},
      Labor: {},
      Harvest: {},
    };

    let completedQueries = 0;

    queries.forEach((query, index) => {
      investment.query(query.sql, [id], (err, queryResult) => {
        if (err) {
          return reject(err);
        }

        // Extract the first record as object, or empty object if no results
        if (queryResult && queryResult.length > 0) {
          result[query.key] = queryResult[0];
        } else {
          result[query.key] = {};
        }

        completedQueries++;

        if (completedQueries === queries.length) {
          resolve(result);
        }
      });
    });
  });
};
exports.GetAllAuditedInvestmentRequestsDAO = (filters = {}) => {
  return new Promise((resolve, reject) => {
    let sql = `
    SELECT 
        ir.id AS No,
        ir.jobId AS Request_ID,
        CONCAT(u.firstName, ' ', u.lastName) AS Farmer_Name,
        u.phoneNumber AS Phone_number,
        ir.nicFront AS NIC_Front_Image,
        ir.nicBack AS NIC_Back_Image,
        co.empId,
        ir.auditedDate AS reqCahangeTime
    FROM investments.investmentrequest ir
    INNER JOIN plant_care.users u 
        ON ir.farmerId = u.id
    LEFT JOIN plant_care.feildofficer co 
        ON ir.officerId = co.id
    WHERE ir.reqStatus = 'Pending' AND ir.auditedDate IS NOT NULL

    `;

    const params = [];

    // Search filter (searches in Request ID, Phone Number, EMP ID)
    if (filters.search) {
      sql += ` AND (
        ir.jobId LIKE ? OR 
        u.phoneNumber LIKE ? OR 
        CONCAT(u.firstName, ' ', u.lastName) LIKE ? OR
        co.empId LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Order by most recent approval first
    sql += ` ORDER BY ir.createdAt DESC`;

    investment.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getDetailsForDivideShareDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
    SELECT
    ir.id,
    ir.auditedDate AS reqCahangeTime,
    ir.jobId,
    u.phoneNumber AS farmerPhone,
    fo.empId,
    CONCAT(fo.phoneCode1, ' ',fo.phoneNumber1) AS officerPhone,
    (COALESCE(cg.costFeild, 0)* ( ir.extentac + COALESCE(ir.extentha, 0)*2.47105 + COALESCE(extentp, 0)/160 )) AS totalValue,
    air.totValue, air.defineShares, air.maxShare, air.minShare
  FROM investments.investmentrequest ir
  LEFT JOIN plant_care.cropgroup cg ON ir.cropId = cg.id
  LEFT JOIN plant_care.users u ON ir.farmerId = u.id
  LEFT JOIN plant_care.feildofficer fo ON ir.officerId = fo.id
  LEFT JOIN investments.approvedinvestmentrequest air ON air.reqId = ir.id
      WHERE ir.id = ?
    `;

    investment.query(sql, [id], (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result[0]);
    });
  });
};

exports.devideSharesDao = (sharesData, adminId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO investments.approvedinvestmentrequest
      (reqId, totValue, defineShares, minShare, maxShare, defineBy)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
      sharesData.id,
      sharesData.totalValue,
      sharesData.numShares,
      sharesData.minimumShare,
      sharesData.maximumShare,
      adminId,
    ];

    investment.query(sql, values, (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

exports.ApproveRequestDao = (id, adminId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE investmentrequest ir
      SET ir.reqStatus = 'Approved', ir.reqCahangeTime = NOW(), ir.approvedBy = ?
      WHERE ir.id = ?
    `;

    investment.query(sql, [adminId, id], (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

exports.updateRejectReasonDao = (id, reason, adminId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO investments.rejectinvestmentrequest
      (reqId, reason, rejectedBy)
      VALUES (?, ?, ?)
    `;

    investment.query(sql, [id, reason, adminId], (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

exports.rejectRequestDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE investmentrequest ir
      SET ir.reqStatus = 'Rejected', ir.reqCahangeTime = NOW()
      WHERE ir.id = ?
    `;

    investment.query(sql, [id], (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

exports.editDevideSharesDao = (sharesData, adminId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE investments.approvedinvestmentrequest
      SET totValue = ?, defineShares = ?, minShare = ?, maxShare = ?, defineBy = ?, createdAt = NOW()
      WHERE reqId = ?
    `;

    const values = [
      sharesData.totalValue,
      sharesData.numShares,
      sharesData.minimumShare,
      sharesData.maximumShare,
      adminId,
      sharesData.id,
    ];

    investment.query(sql, values, (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

exports.getSalesAgentForFilterDao = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        id,
        empId
      FROM salesagent
    `;

    marketPlace.query(sql, (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

exports.getAgentCommitionsDao = (data) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT
        po.invNo,
        o.sheduleDate,
        po.deliveredTime,
        po.isPaid
    FROM processorders po
    INNER JOIN orders o ON po.orderId = o.id
    INNER JOIN marketplaceusers mu ON o.userId = mu.id 
    WHERE mu.salesAgent = ? AND (DATE(o.sheduleDate) BETWEEN ? AND ?) AND DATE(po.deliveredTime) < ?
    `;

    if (data.paymentStatus) {
      if (data.paymentStatus === "Completed") {
        sql += ` AND po.isPaid = 1 `;
      } else if (data.paymentStatus === "Pending") {
        sql += ` AND po.isPaid = 0 `;
      }
    }

    marketPlace.query(
      sql,
      [data.agentId, data.fromDate, data.toDate, data.deliveredDate],
      (err, result) => {
        if (err) {
          return reject(err);
        }
        resolve(result);
      },
    );
  });
};

exports.GetAllPensionRequestsDAO = (filters = {}) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        pr.id AS No,
        pr.id AS Request_ID,
        pr.userId AS User_ID,
        pr.fullName AS Farmer_Name,
        pr.nic AS NIC,
        pr.dob,
        pr.sucFullName AS Successor_Name,
        pr.sucType AS Successor_Type,
        pr.sucNic AS Successor_NIC,
        pr.sucdob AS Successor_DOB,
        pr.defaultPension,
        pr.reqStatus,
        pr.isFirstTime,
        pr.nicFront AS NIC_Front_Image,
        pr.nicBack AS NIC_Back_Image,
        pr.sucNicFront AS Successor_NIC_Front_Image,
        pr.sucNicBack AS Successor_NIC_Back_Image,
        CASE 
            WHEN pr.approveBy IS NULL THEN 'Not Approved'
            ELSE 'Approved'
        END AS Status,
        COALESCE(au.userName, '--') AS Approved_By_Name,
        COALESCE(pr.approveBy, '--') AS Approver_ID,
        pr.createdAt AS Request_Date_Time,
        pr.createdAt AS Requested_On,
        COALESCE(pr.approveTime) AS Approved_Date_Time
      FROM plant_care.pensionrequest pr
      LEFT JOIN agro_world_admin.adminusers au ON pr.approveBy = au.id
      WHERE pr.reqStatus NOT IN ('Approved')
    `;

    const params = [];

    // Filter by request status (To Review, Approved, Rejected)
    if (filters.status) {
      sql += ` AND pr.reqStatus = ?`;
      params.push(filters.status);
    }

    // Search only by farmer's NIC
    if (filters.search) {
      sql += ` AND pr.nic LIKE ?`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm);
    }

    // Order by most recent first
    sql += ` ORDER BY pr.createdAt DESC`;

    plantcare.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.GetPensionRequestByIdDAO = (id) => {
  return new Promise((resolve, reject) => {
    let sql = `
     SELECT 
    pr.id AS No,
    pr.id AS Request_ID,
    pr.fullName AS Farmer_Name,
    pr.nic AS NIC,
    pr.dob,
    pr.sucFullName AS Successor_Name,
    pr.sucType AS Successor_Type,
    pr.sucNic AS Successor_NIC,
    pr.sucdob AS Successor_DOB,
    pr.defaultPension,
    pr.reqStatus,
    pr.isFirstTime,
    pr.nicFront AS NIC_Front_Image,
    pr.nicBack AS NIC_Back_Image,
    pr.sucNicFront AS Successor_NIC_Front_Image,
    pr.sucNicBack AS Successor_NIC_Back_Image,
    pr.birthCrtFront AS Successor_birthCrtFront,
    pr.birthCrtBack AS Successor_birthCrtBack,
    co.empId,
    CASE 
        WHEN pr.approveBy IS NULL THEN 'Not Approved'
        ELSE 'Approved'
    END AS Status,
    COALESCE(au.userName, '--') AS Approved_By_Name,
    COALESCE(pr.approveBy, '--') AS Approver_ID,
    COALESCE(u.phoneNumber, '--') AS Phone_Number,
    COALESCE(co.empId, 'Farmer') AS Collection_Officer_EmpID,
    DATE_FORMAT(pr.createdAt, 'At %h:%i%p on %M %d, %Y') AS Request_Date_Time,
    DATE_FORMAT(pr.createdAt, '%M %d, %Y') AS Requested_On,
    COALESCE(DATE_FORMAT(pr.approveTime, 'At %h:%i%p on %M %d, %Y'), '--') AS Approved_Date_Time
FROM plant_care.pensionrequest pr
LEFT JOIN agro_world_admin.adminusers au ON pr.approveBy = au.id
LEFT JOIN users u ON pr.userId = u.id
LEFT JOIN collection_officer.collectionofficer co ON pr.officerId = co.id
WHERE pr.id = ?
    `;

    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0]);
    });
  });
};

exports.UpdatePensionRequestStatusDAO = (id, updateData) => {
  return new Promise((resolve, reject) => {
    const { reqStatus, approvedBy, approveTime } = updateData;

    let sql = `
      UPDATE plant_care.pensionrequest 
      SET 
        reqStatus = ?,
        approveBy = ?,
        approveTime = ?
      WHERE id = ?
    `;

    const params = [reqStatus, approvedBy, approveTime, id];

    plantcare.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.affectedRows === 0) {
        return resolve(null);
      }

      // Return updated record
      this.GetPensionRequestByIdDAO(id)
        .then((updatedRecord) => resolve(updatedRecord))
        .catch((error) => reject(error));
    });
  });
};

exports.getCultivationForPensionDao = (id) => {
  return new Promise((resolve, reject) => {
    let sql = `
     SELECT
        oc.id AS ongoingCultivationId,
        cv.varietyNameEnglish,
        cg.cropNameEnglish,
        (occ.extentac + occ.extentha * 2.47105 +  occ.extentp / 160 )  AS extentac,
        (SELECT COUNT(*) FROM slavecropcalendardays scd1 WHERE scd1.onCulscropID = occ.id) AS totalTasks,
        (SELECT COUNT(*) FROM slavecropcalendardays scd2 WHERE scd2.onCulscropID = occ.id AND scd2.status = 'completed') AS completedTasks,
        occ.createdAt
      FROM ongoingcultivations oc
      INNER JOIN ongoingcultivationscrops occ ON oc.id = occ.ongoingCultivationId
      LEFT JOIN cropcalender cc ON occ.cropCalendar = cc.id
      LEFT JOIN cropvariety cv ON cc.cropVarietyId = cv.id
      LEFT JOIN cropgroup cg ON cv.cropGroupId = cg.id
      WHERE oc.userId = ?
    `;

    plantcare.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getFarmerPensionDetailsDao = (page, limit, searchText) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let countSql = `
      SELECT COUNT(*) AS total
      FROM pensionrequest
      WHERE reqStatus = 'Approved'
    `;

    let dataSql = `
      SELECT 
        pr.id,
        pr.fullName,
        pr.nic,
        pr.fullName AS farmerFullName,
        u.phoneNumber,
        pr.dob,
        pr.sucType,
        pr.sucNic,
        pr.sucdob,
        pr.defaultPension,
        pr.reqStatus,
        au.userName AS approveBy,
        pr.approveTime,
        pr.createdAt
      FROM pensionrequest pr
      LEFT JOIN agro_world_admin.adminusers au ON pr.approveBy = au.id
      LEFT JOIN users u ON pr.userId = u.id
      WHERE pr.reqStatus = 'Approved'
    `;

    const countParams = [];
    const dataParams = [];

    if (searchText && searchText.trim() !== "") {
      const cond = ` AND nic LIKE ? `;
      countSql += cond;
      dataSql += cond;

      const pattern = `%${searchText}%`;
      countParams.push(pattern);
      dataParams.push(pattern);
    }

    dataSql += ` ORDER BY pr.approveTime DESC LIMIT ? OFFSET ?`;
    dataParams.push(parseInt(limit), parseInt(offset));

    plantcare.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) return reject(countErr);

      plantcare.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) return reject(dataErr);

        resolve({
          total: countResults[0].total,
          items: dataResults,
        });
      });
    });
  });
};

exports.getGocicareAllInvestmentUsersDao = (
  id,
  status,
  search,
  limit,
  offset,
) => {
  return new Promise((resolve, reject) => {
    // Count query for total records
    let countSql = `
    SELECT COUNT(*) as total
    FROM investmentusers iu
    `;

    // Data query for paginated results
    let dataSql = `
    SELECT
        iu.id,
        iu.regCode,
        iu.title,
        iu.userName,
        iu.phoneCode,
        iu.phoneNumber,
        iu.nic,
        iu.email,
        iu.address,
        iu.createdAt
    FROM investmentusers iu
    `;

    const params = [];
    const whereConditions = [];

    if (id) {
      whereConditions.push("iu.id = ?");
      params.push(id);
    }

    if (status) {
      whereConditions.push("iu.status = ?");
      params.push(status);
    }

    if (search) {
      whereConditions.push(`
        (iu.nic LIKE ? 
        OR CONCAT(iu.phoneCode, iu.phoneNumber) LIKE ?
        OR iu.userName LIKE ?
        OR iu.email LIKE ?)
      `);
      const searchValue = `%${search}%`;
      params.push(searchValue, searchValue, searchValue, searchValue);
    }

    // Add WHERE clause if there are conditions
    if (whereConditions.length > 0) {
      const whereClause = " WHERE " + whereConditions.join(" AND ");
      countSql += whereClause;
      dataSql += whereClause;
    }

    dataSql += " ORDER BY iu.createdAt DESC";

    // Add pagination if limit and offset are provided
    if (limit !== undefined && offset !== undefined) {
      dataSql += " LIMIT ? OFFSET ?";
    }

    // Execute count query first
    investment.query(countSql, params, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      // Prepare data query parameters including pagination
      const dataParams = [...params];
      if (limit !== undefined && offset !== undefined) {
        dataParams.push(limit, offset);
      }

      // Execute data query with pagination
      investment.query(dataSql, dataParams, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
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

// ───────────────────────────────────────────── Daos for the finance dashboard ─────────────────────────────────────────────

exports.getAllFinanceDashboardDataDao = () => {
  console.log("goviShop connection:", goviShop);
  return new Promise((resolve, reject) => {
    // ── Count Cards ──────────────────────────────────────────────────────────

    const pensionCountSql = `
      SELECT COUNT(*) AS count
      FROM pensionrequest
      WHERE reqStatus = 'To Review'
    `;

    const supplierUpgradeSql = `
      SELECT COUNT(*) AS count
      FROM shopowners
      WHERE currentPlan = 'Premium'
        AND accessStatus = 'Pending'
    `;

    const projectRequestSql = `
      SELECT COUNT(*) AS count
      FROM investmentrequest
      WHERE reqStatus = 'Pending'
    `;

    const publishedProjectSql = `
      SELECT COUNT(*) AS count
      FROM investmentrequest
      WHERE reqStatus = 'Approved'
        AND publishStatus = 'Published'
    `;

    const goviCareProIncomeSql = `
      SELECT
        COALESCE(SUM(
          mp.payment / CAST(SUBSTRING_INDEX(mp.plan, ' ', 1) AS UNSIGNED)
        ), 0) AS currentMonthIncome
      FROM membershippayment mp
      WHERE mp.activeStatus = 1
        AND CAST(SUBSTRING_INDEX(mp.plan, ' ', 1) AS UNSIGNED) > 0
        AND mp.createdAt  <= LAST_DAY(CURRENT_DATE())
        AND mp.expireDate >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
    `;

    const certificationsIncomeSql = `
      SELECT
        COALESCE(SUM(
          cp.amount / NULLIF(c.timeLine, 0)
        ), 0) AS currentMonthIncome
      FROM certificationpayment cp
      INNER JOIN certificates c ON cp.certificateId = c.id
      WHERE c.timeLine > 0
        AND cp.createdAt  <= LAST_DAY(CURRENT_DATE())
        AND cp.expireDate >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
    `;

    const collectionExpensesSql = `
      SELECT
        COALESCE(SUM(
          (COALESCE(fpc.gradeAprice, 0) * COALESCE(fpc.gradeAquan, 0)) +
          (COALESCE(fpc.gradeBprice, 0) * COALESCE(fpc.gradeBquan, 0)) +
          (COALESCE(fpc.gradeCprice, 0) * COALESCE(fpc.gradeCquan, 0))
        ), 0) AS currentMonthExpenses
      FROM farmerpaymentscrops fpc
      WHERE MONTH(fpc.createdAt) = MONTH(CURRENT_DATE())
        AND YEAR(fpc.createdAt)  = YEAR(CURRENT_DATE())
    `;

    const goviMartSalesIncomeSql = `
      SELECT
        COALESCE(SUM(o.fullTotal), 0) AS currentMonthIncome
      FROM orders o
      WHERE o.orderApp = 'Marketplace'
        AND MONTH(o.createdAt) = MONTH(CURRENT_DATE())
        AND YEAR(o.createdAt)  = YEAR(CURRENT_DATE())
    `;

    const salesDashIncomeSql = `
      SELECT
        COALESCE(SUM(o.fullTotal), 0) AS currentMonthIncome
      FROM orders o
      WHERE o.orderApp = 'Dash'
        AND MONTH(o.createdAt) = MONTH(CURRENT_DATE())
        AND YEAR(o.createdAt)  = YEAR(CURRENT_DATE())
    `;

    const returnedOrdersLossSql = `
  SELECT
    COALESCE(SUM(o.fullTotal), 0) AS currentMonthLoss
  FROM driverorders dro
  INNER JOIN market_place.processorders po ON dro.orderId = po.id
  INNER JOIN market_place.orders o ON po.orderId = o.id
  WHERE dro.drvStatus = 'Return Received'
    AND po.paymentMethod = 'Cash'
    AND MONTH(dro.handOverTime) = MONTH(CURRENT_DATE())
    AND YEAR(dro.handOverTime)  = YEAR(CURRENT_DATE())
`;

    const goviShopPremiumIncomeSql = `
      SELECT
        COALESCE(SUM(pp.planPrice), 0) AS currentMonthIncome
      FROM paymentplan pp
      WHERE MONTH(pp.createdAt) = MONTH(CURRENT_DATE())
        AND YEAR(pp.createdAt)  = YEAR(CURRENT_DATE())
    `;

    const goviShopOrderCommissionSql = `
      SELECT
        COALESCE(SUM(po.amount), 0) AS currentMonthCommission
      FROM processorders po
      INNER JOIN orders o ON po.orderId = o.id
      WHERE po.isPaid = 1
        AND MONTH(po.deliveredTime) = MONTH(CURRENT_DATE())
        AND YEAR(po.deliveredTime)  = YEAR(CURRENT_DATE())
    `;

    // ── Execute all queries across databases ──────────────────────────────────

    plantcare.query(pensionCountSql, (err1, pensionResult) => {
      if (err1) return reject("Error in pension count query: " + err1);

      goviShop.query(supplierUpgradeSql, (err2, supplierResult) => {
        if (err2)
          return reject("Error in supplier upgrade count query: " + err2);

        investment.query(projectRequestSql, (err3, projectResult) => {
          if (err3)
            return reject("Error in project request count query: " + err3);

          investment.query(publishedProjectSql, (err4, publishedResult) => {
            if (err4)
              return reject("Error in published project count query: " + err4);

            plantcare.query(goviCareProIncomeSql, (err5, goviCareResult) => {
              if (err5)
                return reject("Error in GoViCare pro income query: " + err5);

              plantcare.query(certificationsIncomeSql, (err6, certResult) => {
                if (err6)
                  return reject(
                    "Error in certifications income query: " + err6,
                  );

                collectionofficer.query(
                  collectionExpensesSql,
                  (err7, collectionResult) => {
                    if (err7)
                      return reject(
                        "Error in collection expenses query: " + err7,
                      );

                    marketPlace.query(
                      goviMartSalesIncomeSql,
                      (err8, goviMartResult) => {
                        if (err8)
                          return reject(
                            "Error in GoViMart sales income query: " + err8,
                          );

                        marketPlace.query(
                          salesDashIncomeSql,
                          (err9, salesDashResult) => {
                            if (err9)
                              return reject(
                                "Error in SalesDash income query: " + err9,
                              );

                            collectionofficer.query(
                              returnedOrdersLossSql,
                              (err10, returnedResult) => {
                                if (err10)
                                  return reject(
                                    "Error in returned orders loss query: " +
                                    err10,
                                  );

                                goviShop.query(
                                  goviShopPremiumIncomeSql,
                                  (err11, premiumResult) => {
                                    if (err11)
                                      return reject(
                                        "Error in GoViShop premium income query: " +
                                        err11,
                                      );

                                    marketPlace.query(
                                      goviShopOrderCommissionSql,
                                      (err12, commissionResult) => {
                                        if (err12)
                                          return reject(
                                            "Error in GoViShop order commission query: " +
                                            err12,
                                          );

                                        resolve({
                                          counts: {
                                            allPensionRequests:
                                              pensionResult[0].count,
                                            supplierUpgrades:
                                              supplierResult[0].count,
                                            allProjectRequests:
                                              projectResult[0].count,
                                            publishedProjects:
                                              publishedResult[0].count,
                                          },
                                          income: {
                                            goviCareProIncome:
                                              parseFloat(
                                                goviCareResult[0]
                                                  .currentMonthIncome,
                                              ) || 0,
                                            certificationsIncome:
                                              parseFloat(
                                                certResult[0]
                                                  .currentMonthIncome,
                                              ) || 0,
                                            collectionExpenses:
                                              parseFloat(
                                                collectionResult[0]
                                                  .currentMonthExpenses,
                                              ) || 0,
                                            goviMartSalesIncome:
                                              parseFloat(
                                                goviMartResult[0]
                                                  .currentMonthIncome,
                                              ) || 0,
                                            salesDashIncome:
                                              parseFloat(
                                                salesDashResult[0]
                                                  .currentMonthIncome,
                                              ) || 0,
                                            returnedOrdersLoss:
                                              parseFloat(
                                                returnedResult[0]
                                                  .currentMonthLoss,
                                              ) || 0,
                                            goviShopPremiumIncome:
                                              parseFloat(
                                                premiumResult[0]
                                                  .currentMonthIncome,
                                              ) || 0,
                                            goviShopOrderCommission:
                                              parseFloat(
                                                commissionResult[0]
                                                  .currentMonthCommission,
                                              ) || 0,
                                          },
                                        });
                                      },
                                    );
                                  },
                                );
                              },
                            );
                          },
                        );
                      },
                    );
                  },
                );
              });
            });
          });
        });
      });
    });
  });
};

exports.GetAllTransactionsDAO = (page, limit, status, date, searchItem) => {
  return new Promise((resolve, reject) => {
    const Sqlparams = [];
    const Counterparams = [];
    const offset = (page - 1) * limit;

    // SQL to count total records - Added missing JOINs
    let countSql = `
      SELECT COUNT(*) AS total
      FROM collection_officer.driverordertransaction dt
      LEFT JOIN collection_officer.driverordermain dom ON dt.drvOrderMainId = dom.id
      LEFT JOIN collection_officer.collectionofficer co ON dom.driverId = co.id
      WHERE 1 = 1
    `;

    // SQL to fetch paginated data
    let sql = `
      SELECT 
        dt.id, 
        dt.transCode AS transactionId,
        dt.transStatus AS status,
        CONCAT_WS(' ', co.firstNameEnglish, co.lastNameEnglish) AS name,
        co.empId AS driverId,
        co.phoneNumber01 AS phoneNumber,
        dt.transAmount AS amount,
        dt.paySlip AS document,
        dt.createdAt AS submittedAt,
        au.userName AS updatedBy,
        dt.updatedAt
      FROM collection_officer.driverordertransaction dt
      LEFT JOIN collection_officer.driverordermain dom ON dt.drvOrderMainId = dom.id
      LEFT JOIN collection_officer.collectionofficer co ON dom.driverId = co.id
      LEFT JOIN agro_world_admin.adminusers au ON dt.updatedBy = au.id
      WHERE 1 = 1
    `;

    // Add filter for status
    if (status) {
      countSql += " AND dt.transStatus = ? ";
      sql += " AND dt.transStatus = ? ";
      Sqlparams.push(status);
      Counterparams.push(status);
    }

    // Fixed category filter to use the correct alias
    if (date) {
      countSql += " AND DATE(dt.createdAt) = ? ";
      sql += " AND DATE(dt.createdAt) = ? ";
      Sqlparams.push(date);
      Counterparams.push(date);
    }

    // Add search functionality
    if (searchItem) {
      countSql += `
        AND ( dt.transCode LIKE ? OR co.empId LIKE ? OR CONCAT('0', co.phoneNumber01) LIKE ? )
      `;
      sql += `
        AND ( dt.transCode LIKE ? OR co.empId LIKE ? OR CONCAT('0', co.phoneNumber01) LIKE ? )
      `;
      const searchQuery = `%${searchItem}%`;
      Sqlparams.push(searchQuery, searchQuery, searchQuery);
      Counterparams.push(searchQuery, searchQuery, searchQuery);
    }

    // Add pagination
    sql += " ORDER BY dt.createdAt ASC LIMIT ? OFFSET ?";
    Sqlparams.push(parseInt(limit), parseInt(offset));

    // Execute count query to get total records
    collectionofficer.query(
      countSql,
      Counterparams,
      (countErr, countResults) => {
        if (countErr) {
          return reject(countErr);
        }

        const total = countResults[0]?.total || 0;

        // Execute main query to get paginated results
        collectionofficer.query(sql, Sqlparams, (dataErr, results) => {
          if (dataErr) {
            return reject(dataErr);
          }

          resolve({ results, total });
        });
      },
    );
  });
};

exports.getTransactionDocumentByIdDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        d.id,
        d.transAmount,
        d.paySlip,
        d.transStatus,
        c.id AS driverId,
        c.empId,
        c.firstNameEnglish,
        c.lastNameEnglish,
        c.phoneCode01,
        c.phoneNumber01
      FROM driverordertransaction d
      LEFT JOIN driverordermain dom ON d.drvOrderMainId = dom.id
      LEFT JOIN collectionofficer c ON dom.driverId = c.id
      WHERE d.id = ?;
    `;

    collectionofficer.query(sql, [id], (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

exports.updateTransactionStatusDao = (data) => {
  return new Promise((resolve, reject) => {
    const { id, transStatus, rejectReason, updatedBy } = data;

    collectionofficer.getConnection((err, connection) => {
      if (err) return reject(err);

      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          return reject(err);
        }

        const getSql = `
          SELECT drvOrderMainId
          FROM driverordertransaction
          WHERE id = ?
        `;

        connection.query(getSql, [id], (err, result) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              reject(err);
            });
          }

          if (result.length === 0) {
            return connection.rollback(() => {
              connection.release();
              reject(new Error("Transaction not found"));
            });
          }

          const drvOrderMainId = result[0].drvOrderMainId;

          const updateTransactionSql = `
            UPDATE driverordertransaction
            SET
                transStatus = ?,
                rejectReason = ?,
                updatedBy = ?,
                updatedAt = NOW()
            WHERE id = ?
          `;

          connection.query(
            updateTransactionSql,
            [
              transStatus,
              transStatus === "Rejected" ? rejectReason : null,
              updatedBy,
              id,
            ],
            (err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  reject(err);
                });
              }

              const isHandOver = transStatus === "Approved" ? 1 : 0;

              const updateMainSql = `
                  UPDATE driverordermain
                  SET isHandOver = ?
                  WHERE id = ?
                `;

              connection.query(
                updateMainSql,
                [isHandOver, drvOrderMainId],
                (err) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      reject(err);
                    });
                  }

                  connection.commit((err) => {
                    if (err) {
                      return connection.rollback(() => {
                        connection.release();
                        reject(err);
                      });
                    }

                    connection.release();
                    resolve(true);
                  });
                },
              );
            },
          );
        });
      });
    });
  });
};

exports.getTransactionOrdersDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        do.id AS driverOrdId,
        po.id,
        po.invNo,
        po.moneyPaid AS amount,
        do.earnPrice,
        dt.createdAt AS submittedAt
      FROM collection_officer.driverordertransaction dt
      LEFT JOIN collection_officer.driverordermain dom ON dt.drvOrderMainId = dom.id
      LEFT JOIN collection_officer.driverorders do ON dom.id = do.drvOrderMainId
      LEFT JOIN market_place.processorders po ON do.orderId = po.id
      WHERE dt.id = ? AND po.status = 'Delivered' AND po.paymentMethod = 'Cash' AND po.isPaid = 1;
    `;

    goviShop.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        const orders = results.map((order) => ({
          ...order,
          toReceive: order.amount - order.earnPrice,
        }));

        const totalToReceive = orders.reduce(
          (total, order) => total + order.toReceive,
          0,
        );

        resolve({
          orders,
          totalToReceive,
        });
      }
    });
  });
};

exports.getAllShortageSubmissionsDAO = (
  page,
  limit,
  status,
  purchasedAt,
  searchItem,
) => {
  return new Promise((resolve, reject) => {
    const sqlParams = [];
    const countParams = [];

    const offset = (page - 1) * limit;

    let countSql = `
      SELECT COUNT(*) AS total
      FROM shortageassigned sa
      LEFT JOIN shortage s ON sa.shortageassigned = s.id
      LEFT JOIN shortagepurchase sp ON sa.id = sp.srtAssignId
      LEFT JOIN market_place.marketplaceitems m ON s.mpItemId = m.id
      LEFT JOIN plant_care.cropvariety cv ON m.varietyId = cv.id
      LEFT JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      LEFT JOIN collectionofficer co ON sa.assignOfficerId = co.id
      LEFT JOIN distributedcenter dc ON co.distributedCenterId = dc.id
      LEFT JOIN agro_world_admin.adminusers au ON sp.markBy = au.id
      WHERE 1 = 1
    `;

    let sql = `
      SELECT
        cg.cropNameEnglish AS product,
        cg.image,
        sp.id,
        sp.prchQty,
        sp.reqStatus,
        sp.createdAt AS purchasedAt,
        co.empId,
        CONCAT_WS(' ', co.firstNameEnglish, co.lastNameEnglish) AS officerName,
        co.phoneCode01,
        co.phoneNumber01,
        dc.regCode,
        au.userName AS finalizedBy,
        sp.markAt AS finalizeAt
      FROM shortageassigned sa
      LEFT JOIN shortage s ON sa.shortageassigned = s.id
      LEFT JOIN shortagepurchase sp ON sa.id = sp.srtAssignId
      LEFT JOIN market_place.marketplaceitems m ON s.mpItemId = m.id
      LEFT JOIN plant_care.cropvariety cv ON m.varietyId = cv.id
      LEFT JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      LEFT JOIN collectionofficer co ON sa.assignOfficerId = co.id
      LEFT JOIN distributedcenter dc ON co.distributedCenterId = dc.id
      LEFT JOIN agro_world_admin.adminusers au ON sp.markBy = au.id
      WHERE 1 = 1
    `;

    // Status Filter
    if (status) {
      sql += ` AND sp.reqStatus = ? `;
      countSql += ` AND sp.reqStatus = ? `;

      sqlParams.push(status);
      countParams.push(status);
    }

    // Purchased Date Filter
    if (purchasedAt) {
      sql += ` AND DATE(sp.createdAt) = ? `;
      countSql += ` AND DATE(sp.createdAt) = ? `;

      sqlParams.push(purchasedAt);
      countParams.push(purchasedAt);
    }

    // Search
    if (searchItem) {
      const search = `%${searchItem}%`;

      sql += `
        AND (
          cg.cropNameEnglish LIKE ?
          OR co.empId LIKE ?
          OR CONCAT_WS(' ', co.firstNameEnglish, co.lastNameEnglish) LIKE ?
          OR dc.regCode LIKE ?
        )
      `;

      countSql += `
        AND (
          cg.cropNameEnglish LIKE ?
          OR co.empId LIKE ?
          OR CONCAT_WS(' ', co.firstNameEnglish, co.lastNameEnglish) LIKE ?
          OR dc.regCode LIKE ?
        )
      `;

      sqlParams.push(search, search, search, search);
      countParams.push(search, search, search, search);
    }

    sql += `
      ORDER BY sp.createdAt DESC, sp.id DESC
      LIMIT ? OFFSET ?
    `;

    sqlParams.push(parseInt(limit), parseInt(offset));

    collectionofficer.query(countSql, countParams, (countErr, countResult) => {
      if (countErr) {
        return reject(countErr);
      }

      const total = countResult[0].total;

      collectionofficer.query(sql, sqlParams, (err, results) => {
        if (err) {
          return reject(err);
        }

        resolve({
          results,
          total,
        });
      });
    });
  });
};

exports.getViewSubmissionDocumentDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        cg.cropNameEnglish AS product,
        sp.id,
        sp.prchQty,
        sp.prchPrice,
        sp.reqStatus,
        co.empId,
        co.phoneCode01,
        co.phoneNumber01,
        sp.slip
      FROM shortageassigned sa
      LEFT JOIN shortage s ON sa.shortageassigned = s.id
      LEFT JOIN shortagepurchase sp ON sa.id = sp.srtAssignId
      LEFT JOIN market_place.marketplaceitems m ON s.mpItemId = m.id
      LEFT JOIN plant_care.cropvariety cv ON m.varietyId = cv.id
      LEFT JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      LEFT JOIN collectionofficer co ON sa.assignOfficerId = co.id
      WHERE sp.id = ?;
    `;

    collectionofficer.query(sql, [id], (err, result) => {
      if (err) {
        return reject(err);
      }

      resolve(result);
    });
  });
};

exports.updateSubmissionStatusDao = (id, markedBy) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE shortagepurchase sp
      SET sp.reqStatus = 'Completed', sp.markAt = NOW(), sp.markBy = ?
      WHERE sp.id = ?
    `;

    collectionofficer.query(sql, [markedBy, id], (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

exports.viewCopTransactionDocumentDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
	      co.empId,
	      CONCAT(co.firstNameEnglish,' ',co.lastNameEnglish) AS officerName,
	      co.phoneCode01,
        co.phoneNumber01,
	      po.handOverPrice,
	      pt.transactionStatus,
	      pt.slip
      FROM pickuptransaction pt
      LEFT JOIN collectionofficer co ON pt.officerId = co.id
      LEFT JOIN pickuporders po ON pt.id = po.transId 
      WHERE pt.id = ?
    `;

    collectionofficer.query(sql, [id], (err, result) => {
      if (err) {
        return reject(err);
      }

      resolve(result);
    });
  });
};

exports.updateCopTransactionStatusDao = ({ id, updatedBy }) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE pickuptransaction
      SET
        transactionStatus = 'Completed',
        approvedBy = ?,
        approvedAt = NOW()
      WHERE id = ?
    `;

    collectionofficer.query(sql, [updatedBy, id], (err, result) => {
      if (err) {
        return reject(err);
      }

      resolve(result);
    });
  });
};