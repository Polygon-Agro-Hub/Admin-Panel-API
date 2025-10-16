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
