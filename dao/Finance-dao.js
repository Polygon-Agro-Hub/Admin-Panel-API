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

              plantcare.query(monthlyStatsQuery, (err5, monthlyStatsResults) => {
                if (err5) return reject("Error in monthly stats query: " + err5);

                // Combine all results
                const dashboardData = {
                  stats: statsResults[0],
                  income: incomeResults[0],
                  recentPayments: paymentsResults,
                  enrollments: enrollmentsResults,
                  monthlyStatistics: monthlyStatsResults
                };

                resolve(dashboardData);
              });
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
      countParams.push(searchValue, searchValue, searchValue, searchValue, searchValue, searchValue);
      dataParams.push(searchValue, searchValue, searchValue, searchValue, searchValue, searchValue);
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
        if (err1) return reject('Error in stats query: ' + err1);

        plantcare.query(incomeQuery, (err2, incomeResults) => {
          if (err2) return reject('Error in income query: ' + err2);

          plantcare.query(recentPaymentsQuery, (err3, paymentsResults) => {
            if (err3) return reject('Error in recent payments query: ' + err3);

            plantcare.query(monthlyStatsQuery, (err4, monthlyStatsResults) => {
              if (err4) return reject('Error in monthly stats query: ' + err4);

              const dashboardData = {
                stats: statsResults[0],
                income: incomeResults[0],
                recentPayments: paymentsResults,
                monthlyStatistics: monthlyStatsResults
              };

              resolve(dashboardData);
            });
          });
        });
      });
    } catch (error) {
      reject('Error executing Govijob dashboard queries: ' + error);
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
        if (err1) return reject('Error in stats query: ' + err1);

        plantcare.query(incomeQuery, (err2, incomeResults) => {
          if (err2) return reject('Error in income query: ' + err2);

          plantcare.query(recentPaymentsQuery, (err3, paymentsResults) => {
            if (err3) return reject('Error in recent payments query: ' + err3);

            plantcare.query(monthlyStatsQuery, (err4, monthlyStatsResults) => {
              if (err4) return reject('Error in monthly stats query: ' + err4);

              const dashboardData = {
                stats: statsResults[0],
                income: incomeResults[0],
                recentPayments: paymentsResults,
                monthlyStatistics: monthlyStatsResults
              };

              resolve(dashboardData);
            });
          });
        });
      });
    } catch (error) {
      reject('Error executing Govijob dashboard queries: ' + error);
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

            plantcare.query(certificateTypesQuery, (err4, certificateTypesResults) => {
              if (err4) return reject("Error in certificate types query: " + err4);

              plantcare.query(monthlyStatsQuery, (err5, monthlyStatsResults) => {
                if (err5) return reject("Error in monthly stats query: " + err5);

                // Combine all results
                const dashboardData = {
                  stats: statsResults[0],
                  income: incomeResults[0],
                  recentPayments: paymentsResults,
                  certificateTypes: certificateTypesResults,
                  monthlyStatistics: monthlyStatsResults
                };

                resolve(dashboardData);
              });
            });
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