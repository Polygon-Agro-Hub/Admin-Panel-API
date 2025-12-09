const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
  dash,
} = require("../startup/database");
const bcrypt = require("bcryptjs");
const { Upload } = require("@aws-sdk/lib-storage");
const Joi = require("joi");

exports.getAllDashboardData = () => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get dashboard statistics
      // Pro users: membership = 'Pro' AND expireDate > current date
      // Free users: membership = 'Basic' OR (membership = 'Pro' AND expireDate <= current date)
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
                }
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
        searchValue
      );
      dataParams.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
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
          COUNT(CASE WHEN MONTH(gj.sheduleDate) = MONTH(CURRENT_DATE()) 
            AND YEAR(gj.sheduleDate) = YEAR(CURRENT_DATE()) THEN 1 END) AS requestsThisMonth,
          COUNT(CASE WHEN DATE(gj.sheduleDate) = CURDATE() THEN 1 END) AS requestsToday
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

// Function for govi job dashboard data
exports.getAllGovijobDashboardData = () => {
  return new Promise(async (resolve, reject) => {
    try {
      // ===== 1️ Basic stats =====
      const statsQuery = `
        SELECT 
          COUNT(CASE WHEN MONTH(gj.sheduleDate) = MONTH(CURRENT_DATE()) 
            AND YEAR(gj.sheduleDate) = YEAR(CURRENT_DATE()) THEN 1 END) AS requestsThisMonth,
          COUNT(CASE WHEN DATE(gj.sheduleDate) = CURDATE() THEN 1 END) AS requestsToday
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
      // Monthly income = amount / timeline for each payment where expireDate covers the month
      const incomeQuery = `
        SELECT 
          COALESCE(SUM(
            CASE 
              WHEN MONTH(CURRENT_TIMESTAMP()) >= MONTH(cp.createdAt)
                AND YEAR(CURRENT_TIMESTAMP()) >= YEAR(cp.createdAt)
                AND (YEAR(CURRENT_TIMESTAMP()) * 12 + MONTH(CURRENT_TIMESTAMP())) 
                    <= (YEAR(cp.expireDate) * 12 + MONTH(cp.expireDate))
                AND c.timeLine > 0
              THEN cp.amount / c.timeLine
              ELSE 0
            END
          ), 0) as currentMonthIncome,
          COALESCE(SUM(
            CASE 
              WHEN MONTH(DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH)) >= MONTH(cp.createdAt)
                AND YEAR(DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH)) >= YEAR(cp.createdAt)
                AND (YEAR(DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH)) * 12 + 
                     MONTH(DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH))) 
                    <= (YEAR(cp.expireDate) * 12 + MONTH(cp.expireDate))
                AND c.timeLine > 0
              THEN cp.amount / c.timeLine
              ELSE 0
            END
          ), 0) as previousMonthIncome
        FROM certificationpayment cp
        INNER JOIN certificates c ON cp.certificateId = c.id
        WHERE cp.expireDate > DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH)
      `;

      // Get recent 6 payments with validity period calculation
      const paymentsQuery = `
        SELECT 
          cp.transactionId,
          CONCAT(u.firstName, ' ', u.lastName) as farmerName,
          c.srtName as certificateName,
          cp.payType,
          FORMAT(cp.amount, 2) as amount,
          DATE_FORMAT(cp.createdAt, '%Y-%m-%d %H:%i') as dateTime,
          DATE_FORMAT(cp.expireDate, '%Y-%m-%d') as expiryDate,
          TIMESTAMPDIFF(MONTH, CURRENT_TIMESTAMP(), cp.expireDate) as validityMonths
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
                  }
                );
              }
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
        gjp.createdAt as sortDate
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

    // Search filtering
    if (searchTerm) {
      const searchCondition = `
        AND (
          gjp.transactionId LIKE ?
          OR u.firstName LIKE ?
          OR u.lastName LIKE ?
          OR os.englishName LIKE ?
          OR gjp.amount LIKE ?
        )
      `;
      countSql += searchCondition;
      dataSql += searchCondition;

      const searchValue = `%${searchTerm}%`;
      countParams.push(searchValue, searchValue, searchValue, searchValue, searchValue);
      dataParams.push(searchValue, searchValue, searchValue, searchValue, searchValue);
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

        resolve({ items: dataResults, total });
      });
    });
  });
};

exports.getAllCertificatePayments = (page, limit, searchTerm, fromDate, toDate) => {
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
        CASE 
          WHEN cp.payType = 'Cluster' THEN fc.clsName
          ELSE CONCAT(u.firstName, ' ', u.lastName)
        END as farmerName,
        FORMAT(cp.amount, 2) as amount,
        DATE_FORMAT(cp.createdAt, '%d %b, %Y %h:%i%p') as dateTime,
        cp.expireDate,
        cp.createdAt as sortDate,
        CASE 
          WHEN cp.expireDate < NOW() THEN 'Expired'
          ELSE CONCAT(
            FLOOR(DATEDIFF(cp.expireDate, NOW()) / 30), ' months, ',
            MOD(DATEDIFF(cp.expireDate, NOW()), 30), ' days'
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
          OR fc.clsName LIKE ?
          OR cp.amount LIKE ?
        )
      `;
      countSql += searchCondition;
      dataSql += searchCondition;

      const searchValue = `%${searchTerm}%`;
      countParams.push(searchValue, searchValue, searchValue, searchValue, searchValue);
      dataParams.push(searchValue, searchValue, searchValue, searchValue, searchValue);
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
        searchValue
      );
      dataParams.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
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
      }
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
        ", "
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

exports.InsertPaymentHistoryDAO = (receivers, amount, payRef, xlLink, issueBy) => {
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


exports.UpdatePaymentHistoryDAO = (id, receivers, amount, payRef, xlLink, modifyBy) => {
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
        return reject(new Error('Payment history record not found'));
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
        return reject(new Error('Payment history record not found'));
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
        COALESCE(ao.userName, '--') AS Assigned_By
      FROM investmentrequest ir
      INNER JOIN users u ON ir.farmerId = u.id
      LEFT JOIN feildofficer co ON ir.officerId = co.id
      LEFT JOIN agro_world_admin.adminusers ao ON ir.assignedBy = ao.id
      WHERE ir.reqStatus = 'Pending'
    `;

    const params = [];

    // Filter by status (Not Assigned or Assigned)
    if (filters.status) {
      if (filters.status === 'Not Assigned') {
        sql += ` AND ir.officerId IS NULL`;
      } else if (filters.status === 'Assigned') {
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

    plantcare.query(sql, params, (err, results) => {
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
        cv.varietyNameEnglish AS Variety,
        cert.srtName AS Certificate,
        CONCAT(
          COALESCE(ir.extentha, 0), ' Acres ',
          COALESCE(ir.extentac, 0), ' Perches'
        ) AS Extent,
        ir.investment AS Expected_Investment,
        CONCAT(ir.expectedYield, 'kg') AS Expected_Yield,
        DATE_FORMAT(ir.startDate, '%M %d, %Y') AS Expected_Start_Date,
        DATE_FORMAT(ir.createdAt, 'At %h:%i%p on %M %d, %Y') AS Request_Date_Time
      FROM investmentrequest ir
      INNER JOIN users u ON ir.farmerId = u.id
      LEFT JOIN cropvariety cv ON ir.varietyId = cv.id
      LEFT JOIN cropgroup cg ON cv.cropGroupId = cg.id
      LEFT JOIN certificates cert ON ir.certificateId = cert.id
      WHERE ir.jobId = ?
      LIMIT 1
    `;

    plantcare.query(sql, [requestId], (err, results) => {
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
        cv.varietyNameEnglish AS Variety,
        cert.srtName AS Certificate,
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
      INNER JOIN users u ON ir.farmerId = u.id
      LEFT JOIN cropvariety cv ON ir.varietyId = cv.id
      LEFT JOIN cropgroup cg ON cv.cropGroupId = cg.id
      LEFT JOIN certificates cert ON ir.certificateId = cert.id
      WHERE ir.id = ?
      LIMIT 1
    `;

    plantcare.query(sql, [requestId], (err, results) => {
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
  assignByUserId
) => {
  return new Promise(async (resolve, reject) => {
    let connection;

    try {
      connection = await plantcare.promise().getConnection();
      await connection.beginTransaction();

      // Check if investment request exists
      const [requestExists] = await connection.query(
        `SELECT id FROM investmentrequest WHERE id = ?`,
        [requestId]
      );

      if (requestExists.length === 0) {
        await connection.rollback();
        return reject(new Error("Investment request not found"));
      }

      // Check if officer exists and is active
      const [officerExists] = await connection.query(
        `SELECT id FROM feildofficer WHERE id = ? AND status = 'Approved'`,
        [assignOfficerId]
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
      
      console.log('Assigning Officer:', assignByUserId, 'to Request:', requestId);

      // Add assignBy if provided
      if (assignByUserId) {
        updateQuery += `, assignedBy = ?`;
        queryParams.push(assignByUserId);
      }

      updateQuery += ` WHERE id = ?`;
      queryParams.push(requestId);

      console.log('Update Query:', updateQuery);
      console.log('Query Params:', queryParams);

      // Update the investment request with the assigned officer
      const [result] = await connection.query(updateQuery, queryParams);

      if (result.affectedRows === 0) {
        await connection.rollback();
        return reject(new Error("Investment request not found or no changes made"));
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

exports.getOfficersByDistrictAndRoleForInvestmentDAO = (district, jobRole) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        fo.id,
        fo.empId,
        fo.firstName,
        fo.lastName,
        fo.JobRole,
        fo.distrct as district,
        (
          SELECT COUNT(*)
          FROM investmentrequest ir 
          WHERE ir.officerId = fo.id 
        ) AS jobCount
      FROM 
        feildofficer fo
      WHERE 
        fo.distrct LIKE ?
        AND fo.JobRole = ?
        AND fo.status = 'Approved'
      ORDER BY 
        jobCount ASC, fo.firstName, fo.lastName
    `;

    const params = [`%${district}%`, jobRole];

    plantcare.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};


exports.getAllPublishedProjectsDAO = (searchText) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT ir.id, u.firstName, u.lastName, u.phoneNumber, u.NICnumber AS farmerNic,
        cv.varietyNameEnglish, cg.cropNameEnglish, ir.assignDate, ir.assignedBy, 
        ir.jobId, ir.publishStatus, ir.reqStatus, ir.nicFront, ir.nicBack,
        ir.extentac, ir.expectedYield, ir.startDate, ir.investment, 
        c.srtName, ir.publishDate, au.userName AS publishedBy
      FROM plant_care.investmentrequest ir
      LEFT JOIN plant_care.users u ON ir.farmerId = u.id
      LEFT JOIN plant_care.cropvariety cv ON ir.varietyId = cv.id
      LEFT JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      LEFT JOIN plant_care.certificates c ON ir.certificateId = c.id
      LEFT JOIN agro_world_admin.adminusers au ON ir.publishBy = au.id
      WHERE ir.reqStatus = 'Approved'
      AND ir.publishStatus = 'Published'
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

    plantcare.query(sql, params, (err, results) => {
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
        ir.varietyId,
        ir.certificateId,
        ir.farmerId,
        ir.officerId,
        ir.jobId,
        ir.extentha,
        ir.extentac,
        ir.extentp,
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
        cv.varietyNameEnglish,
        cg.cropNameEnglish,
        c.srtName AS certificateName,
        fo.empId AS officerEmpId
      FROM plant_care.investmentrequest ir
      LEFT JOIN plant_care.rejectinvestmentrequest rir ON ir.id = rir.reqId
      LEFT JOIN plant_care.users u ON ir.farmerId = u.id
      LEFT JOIN plant_care.cropvariety cv ON ir.varietyId = cv.id
      LEFT JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      LEFT JOIN plant_care.certificates c ON ir.certificateId = c.id
      LEFT JOIN plant_care.feildofficer fo ON ir.officerId = fo.id
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

    admin.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};


exports.GetAllApprovedInvestmentRequestsDAO = (filters = {}) => {
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
        DATE_FORMAT(ir.createdAt, '%h:%i%p on %M %d, %Y') AS Request_Date_Time,
        COALESCE(ao.userName, '--') AS Assigned_By
      FROM investmentrequest ir
      INNER JOIN users u ON ir.farmerId = u.id
      LEFT JOIN feildofficer co ON ir.officerId = co.id
      LEFT JOIN agro_world_admin.adminusers ao ON ir.assignedBy = ao.id
      WHERE ir.reqStatus = 'Approved'
    `;

    const params = [];

    // Filter by publish status (Draft or Published)
    if (filters.status) {
      sql += ` AND COALESCE(ir.publishStatus, 'Draft') = ?`;
      params.push(filters.status);
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

    plantcare.query(sql, params, (err, results) => {
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

    plantcare.query(sql, [publishBy, requestId], (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};