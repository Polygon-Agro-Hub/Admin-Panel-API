const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
  investment,
  goviShop,
} = require("../startup/database");
const nodemailer = require("nodemailer");

// -----------------------------------------------------------------------------------
//example dao check line 19 instance (goviShop.query) carefully before copy pasting
//------------------------------------------------------------------------------------

// exports.forexample = () => {
//   return new Promise((resolve, reject) => {
//     const sql = `
//       SELECT os.id, os.englishName, os.tamilName, os.sinhalaName, os.srvFee,
//              au.userName AS modifiedByUser
//       FROM plant_care.officerservices AS os
//       LEFT JOIN agro_world_admin.adminusers AS au
//         ON os.modifyBy = au.id
//       WHERE os.isValid = 1
//     `;

//     goviShop.query(sql, (err, results) => {
//       if (err) {
//         reject(err);
//       } else {
//         resolve(results); // each row will now include modifiedByUser
//       }
//     });
//   });
// };

exports.getAllGoviShopUsers = (search, currentPlanFilter) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        su.id,
        su.shopName,
        su.ownername,
        su.shopPhone,
        su.email,
        su.nic,
        su.adress,
        su.brImg,
        su.longitude,
        su.latitude,
        su.isAvailable,
        su.currentPlan,
        su.userStatus,
        su.acticatedBy,
        su.acticatedAt,
        su.createdAt,
        au.userName AS activatedByUser,
        pp.planPrice,
        pp.expireDate AS currentPlanExpireDate,
        pp.createdAt AS paymentCreatedAt,
        CASE 
          WHEN pp.expireDate < NOW() THEN 'expired'
          WHEN pp.expireDate >= NOW() THEN 'active'
          ELSE 'no_payment'
        END AS planStatus,
        DATEDIFF(pp.expireDate, NOW()) AS daysRemaining
      FROM shopusers su
      LEFT JOIN agro_world_admin.adminusers au ON su.acticatedBy = au.id
      LEFT JOIN (
        SELECT 
          userId,
          planPrice,
          expireDate,
          createdAt
        FROM paymentplan pp1
        WHERE createdAt = (
          SELECT MAX(createdAt)
          FROM paymentplan pp2
          WHERE pp2.userId = pp1.userId
        )
      ) pp ON su.id = pp.userId
    `;

    const values = [];
    const whereConditions = [];

    // Add search condition if search parameter is provided
    if (search) {
      whereConditions.push(
        `(su.shopName LIKE ? OR su.nic LIKE ? OR su.shopPhone LIKE ?)`,
      );
      values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Add currentPlan filter if provided
    if (currentPlanFilter) {
      whereConditions.push(`su.currentPlan = ?`);
      values.push(currentPlanFilter);
    }

    // Add WHERE clause if there are any conditions
    if (whereConditions.length > 0) {
      sql += ` WHERE ` + whereConditions.join(" AND ");
    }

    sql += " ORDER BY su.createdAt DESC";

    goviShop.query(sql, values, (err, results) => {
      if (err) return reject(err);

      // Add additional processing to mark expired plans if needed
      const processedResults = results.map((user) => ({
        ...user,
        isPlanExpired: user.planStatus === "expired",
        planExpiryStatus: user.planStatus,
        daysUntilExpiry: user.daysRemaining || 0,
      }));

      resolve({
        total: results.length,
        shopUsers: processedResults,
        expiredCount: processedResults.filter((u) => u.isPlanExpired).length,
        activeCount: processedResults.filter((u) => u.planStatus === "active")
          .length,
      });
    });
  });
};

exports.getGoviShopUserById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        su.id,
        su.shopName,
        su.ownername,
        su.shopPhone,
        su.email,
        su.nic,
        su.adress,
        su.brImg,
        su.longitude,
        su.latitude,
        su.isAvailable,
        su.currentPlan,
        su.userStatus,
        su.acticatedBy,
        su.acticatedAt,
        su.createdAt,
        au.userName AS activatedByUser
      FROM shopusers su
      LEFT JOIN agro_world_admin.adminusers au ON su.acticatedBy = au.id
      WHERE su.id = ?
    `;

    goviShop.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results[0]);
    });
  });
};

exports.deleteGoviShopUser = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM shopusers WHERE id = ?";
    goviShop.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results.affectedRows > 0);
    });
  });
};

exports.viewGoviShopSupplierByIdDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        su.id,
        su.shopName,
        su.email,
        su.createdAt,
        su.shopPhone,
        su.adress,
        su.brImg,
        su.latitude,
        su.longitude,
        su.ownername,
        su.nic,
        su.currentPlan,
        pp.planPrice,
        pp.expireDate,
        CASE
          WHEN pp.expireDate IS NULL THEN 'NO_PLAN'
          WHEN pp.expireDate < CURDATE() THEN 'EXPIRED'
          ELSE 'ACTIVE'
        END AS planStatus
      FROM shopusers su
      LEFT JOIN (
        SELECT 
          pp1.userId,
          pp1.planPrice,
          pp1.expireDate,
          pp1.createdAt
        FROM paymentplan pp1
        INNER JOIN (
          SELECT 
            userId,
            MAX(createdAt) AS maxCreatedAt
          FROM paymentplan
          GROUP BY userId
        ) latest
        ON pp1.userId = latest.userId
        AND pp1.createdAt = latest.maxCreatedAt
      ) pp ON su.id = pp.userId
      WHERE su.id = ?
    `;

    goviShop.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};

exports.getAllShowViewActionDAO = (status, searchText) => {
  return new Promise((resolve, reject) => {
    let countSql = `
      SELECT COUNT(*) as total 
       FROM govi_shop.shopusers su
       LEFT JOIN agro_world_admin.adminusers a ON su.acticatedBy = a.id
    `;

    let dataSql = `
      SELECT
        su.id,
        su.shopName, 
        su.ownername, 
        su.shopPhone, 
        su.nic, 
        su.userStatus, 
        su.acticatedAt, 
        a.userName 
      FROM govi_shop.shopusers su 
      LEFT JOIN agro_world_admin.adminusers a ON su.acticatedBy = a.id
    `;

    const params = [];

    let whereConditions = [];

    if (searchText) {
      whereConditions.push(`
          (
            su.shopName LIKE ?
            OR su.nic LIKE ?
            OR su.shopPhone LIKE ?
          )
        `);

      const searchValue = `%${searchText}%`;
      params.push(...Array(3).fill(searchValue));
    }

    if (status) {
      whereConditions.push(`su.userStatus = ?`);
      params.push(status);
    }

    // Append WHERE conditions if any exist
    if (whereConditions.length > 0) {
      const whereClause = " WHERE " + whereConditions.join(" AND ");
      countSql += whereClause;
      dataSql += whereClause;
    }

    dataSql += " ORDER BY su.createdAt DESC";

    // Execute count query first
    goviShop.query(countSql, params, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      goviShop.query(dataSql, params, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }

        resolve({
          items: dataResults,
          total,
        });
      });
    });
  });
};

exports.goviShopViewDocumentDAO = (id) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT
        id,
        shopName,
        ownername,
        shopPhone,
        nic,
        userStatus,
        brImg,
        paySlip
      FROM shopusers
      WHERE id = ?
    `;

    goviShop.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
};

exports.updateGoviShopUserStatusDAO = (id, status) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE shopusers
      SET userStatus = ?
      WHERE id = ?
    `;

    goviShop.query(sql, [status, id], (err, results) => {
      if (err) return reject(err);
      resolve(results.affectedRows > 0);
    });
  });
};

exports.getGoviShopUserByIdDAO = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, shopName, ownername, shopPhone, email
      FROM shopusers
      WHERE id = ?
    `;
    goviShop.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results[0] || null);
    });
  });
};

exports.sendGoviShopRenewalEmailDAO = async (id) => {
  const shopUser = await exports.getGoviShopUserByIdDAO(id);

  if (!shopUser?.email) {
    console.warn(`⚠️ No email found for shop user ID: ${id}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const loginUrl = "../assets/govishop logo.png";

  const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background-color: #f0f0f0; font-family: Arial, sans-serif; }
    .wrapper { padding: 40px 20px; background-color: #f0f0f0; }
    .container {
      max-width: 580px; margin: 0 auto; background-color: #ffffff;
      border-radius: 10px; overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    }

    /* ── Header ── */
    .header {
      text-align: center;
      padding: 28px 20px 20px;
      border-bottom: 1px solid #e8e8e8;
    }
    .header img {
      width: 64px; height: 64px; object-fit: contain;
    }
    .header .brand {
      font-size: 15px; font-weight: bold;
      color: #E87722; margin-top: 6px;
      letter-spacing: 0.3px;
    }

    /* ── Title ── */
    .title-bar {
      padding: 22px 36px 18px;
      border-bottom: 1px solid #e8e8e8;
      text-align: center;
    }
    .title-bar p {
      font-size: 16px; font-weight: bold;
      color: #111111; line-height: 1.5;
    }

    /* ── Body ── */
    .body {
      padding: 28px 40px 10px;
      color: #333333; font-size: 14px;
      line-height: 1.8; text-align: justify;
    }
    .body p { margin-bottom: 8px; }

    /* ── Login Button ── */
    .btn-wrap {
      text-align: center;
      padding: 24px 40px 18px;
    }
    .btn {
      display: block;
      background-color: #E87722;
      color: #ffffff !important;
      text-decoration: none;
      padding: 15px 0;
      width: 100%;
      border-radius: 6px;
      font-size: 15px;
      font-weight: bold;
      text-align: center;
      letter-spacing: 0.5px;
    }

    /* ── Fallback ── */
    .fallback {
      padding: 0 40px 16px;
      font-size: 13px; color: #444;
      line-height: 1.6;
    }
    .fallback a {
      color: #1a73e8; word-break: break-all;
      text-decoration: underline;
    }
    .fallback-box {
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 10px 14px;
      margin-top: 8px;
      background-color: #fafafa;
    }

    /* ── Sign off ── */
    .sign {
      padding: 18px 40px 24px;
      font-size: 14px; color: #333;
      line-height: 1.8;
    }
    .sign strong { display: block; font-weight: bold; }

    /* ── Footer ── */
    .footer {
      background-color: #f7f7f7;
      border-top: 1px solid #e8e8e8;
      text-align: center;
      padding: 18px 20px;
      font-size: 12px;
      color: #999999;
      line-height: 1.8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">

      <!-- Header -->
      <div class="header">
        <img src="https://your-logo-url.com/govishop-logo.png" alt="GoViShop Logo" />
        <div class="brand">GoViShop</div>
      </div>

      <!-- Title -->
      <div class="title-bar">
        <p>Welcome to Govishop Premium &ndash; Payment Received Successfully</p>
      </div>

      <!-- Body -->
      <div class="body">
        <p>Dear <strong>${shopUser.ownername}</strong>,</p>
        <p>Warm greetings, and congratulations on joining Govishop as a Premium Member!</p>
        <p>We are delighted to welcome you to the Govishop community and thank you for choosing to upgrade your experience with our Premium Membership.</p>
        <p>This email is to confirm that your registration has been completed successfully and your payment for the Premium Package has been received.</p>
        <p>Your Premium Membership is now active.</p>
      </div>

      <!-- Login Button -->
      <div class="btn-wrap">
        <a href="${loginUrl}" class="btn">Login</a>
      </div>

      <!-- Fallback -->
      <div class="fallback">
        <p>If the button doesn't work, copy and paste the link into your browser :</p>
        <div class="fallback-box">
          <a href="${loginUrl}">${loginUrl}</a>
        </div>
      </div>

      <!-- Sign off -->
      <div class="sign">
        Thank you,
        <strong>GoViShop Team</strong>
      </div>

      <!-- Footer -->
      <div class="footer">
        @ 2026 Polygon Holdings Limited. All Rights Reserved.<br />
        Please note that this is an automated message.
      </div>

    </div>
  </div>
</body>
</html>
`;

  await transporter.sendMail({
    from: `"GoViShop Team" <${process.env.EMAIL_USER}>`,
    to: shopUser.email,
    subject: "Welcome to Govishop Premium – Payment Received Successfully",
    html: htmlTemplate,
  });

  console.log(`✅ Renewal email sent to ${shopUser.email}`);
};
