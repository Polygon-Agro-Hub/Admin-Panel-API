const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
  investment,
  goviShop,
} = require("../startup/database");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const uploadFileToS3 = require("../middlewares/s3upload");
const PDFDocument = require("pdfkit");

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

exports.getAllGoviShopUsers = (limit, offset, search, currentPlanFilter) => {
  return new Promise((resolve, reject) => {
    // Base SQL for data query
    let dataSql = `
      SELECT 
        su.id,
        su.ownername,
        su.shopPhone,
        su.email,
        su.nic,
        su.currentPlan AS pricePlan,
        su.accessStatus AS paymentStatus,
        isActivated AS expireStatus,
        DATE_ADD(su.activatedAt, INTERVAL 330 MINUTE) AS activatedAt,
        su.onbordStatus,
        DATE_ADD(su.createdAt, INTERVAL 330 MINUTE) AS createdAt
        
      FROM govi_shop.shopowners su 
      WHERE su.isAvailable = 1
    `;

    // Base SQL for count query
    let countSql = `
      SELECT COUNT(*) as total 
      FROM govi_shop.shopowners su
      WHERE su.isAvailable = 1
      
    `;

    const dataParams = [];
    const countParams = [];

    // Add search condition if search parameter is provided
    if (search) {

      countSql += `AND (su.nic LIKE ? OR su.shopPhone LIKE ?)`
      dataSql += `AND (su.nic LIKE ? OR su.shopPhone LIKE ?)`
      const searchValue = `%${search}%`;
      dataParams.push(searchValue, searchValue);
      countParams.push(searchValue, searchValue);
    }

    // Add currentPlan filter if provided
    if (currentPlanFilter) {

      countSql += `AND su.currentPlan = ?`
      dataSql += `AND su.currentPlan = ?`
      dataParams.push(currentPlanFilter);
      countParams.push(currentPlanFilter);
    }

    // Add order by and pagination to data query
    dataSql += " ORDER BY su.createdAt DESC LIMIT ? OFFSET ?";
    dataParams.push(parseInt(limit), parseInt(offset));

    // First execute count query to get total records
    goviShop.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) return reject(countErr);

      const total = countResults[0].total;

      // Then execute data query with pagination
      goviShop.query(dataSql, dataParams, (dataErr, results) => {
        if (dataErr) return reject(dataErr);

        // const processedResults = results.map((user) => ({
        //   ...user,
        //   isPlanExpired: user.planStatus === "expired",
        //   planExpiryStatus: user.planStatus,
        //   daysUntilExpiry: user.daysRemaining || 0,
        // }));

        resolve({
          total: total,
          shopUsers: results
        });
      });
    });
  });
};

exports.getGoviShopUserById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        su.id
      FROM govi_shop.shopowners su
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
    const sql = "UPDATE govi_shop.shopowners SET isAvailable = 0 WHERE id = ?";
    goviShop.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      resolve(results.affectedRows > 0);
    });
  });
};

exports.InsertReason = (id, reason) => {
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO govi_shop.removeownerreson (`ownerId`, `reason`) VALUES (?, ?)";
    goviShop.query(sql, [id, reason], (err, results) => {
      if (err) return reject(err);
      resolve(results.affectedRows > 0);
    });
  });
};


exports.getShopOwnerEmailDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
        SELECT 
          su.email, su.ownername AS ownerName
        FROM govi_shop.shopowners su
        WHERE su.id = ?
        `;
    collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      if (results.length > 0) {
        resolve({
          email: results[0].email, // Resolve with email
          ownerName: results[0].ownerName
        });
      } else {
        resolve(null); // Resolve with null if no record is found
      }
    });
  });
};

exports.createGoviShopUser = (supplierData, adminId, accessStatus) => {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Generate date part (YYMMDD)
      const today = new Date();
      const yy = String(today.getFullYear()).slice(-2);
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");

      const datePart = `${yy}${mm}${dd}`;
      const prefix = `GSID${datePart}`;

      // 2. Get last regCode for today
      const getLastCodeSql = `
        SELECT regCode 
        FROM govi_shop.shopowners 
        WHERE regCode LIKE ? 
        ORDER BY regCode DESC 
        LIMIT 1
      `;

      collectionofficer.query(
        getLastCodeSql,
        [`${prefix}%`],
        (err, result) => {
          if (err) {
            console.log(err);
            return reject(err);
          }

          let newSequence = "001";

          if (result.length > 0) {
            const lastCode = result[0].regCode; // e.g. GSID240326001
            const lastNumber = parseInt(lastCode.slice(-3)); // get 001
            newSequence = String(lastNumber + 1).padStart(3, "0");
          }

          const newRegCode = `${prefix}${newSequence}`;

          console.log('newRegCode', newRegCode)

          // 3. Insert query (add regCode column)
          const insertSql = `
            INSERT INTO govi_shop.shopowners (
              ownername, shopPhone, email, nic, isAvailable, currentPlan, 
              onbordStatus, onbordedAdmin, regCode, accessStatus, isActivated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          collectionofficer.query(
            insertSql,
            [
              supplierData.fullName,
              supplierData.mobileNumber,
              supplierData.email,
              supplierData.nic,
              1,
              supplierData.selectedSubscription,
              "Admin",
              adminId,
              newRegCode,
              accessStatus,
              'Active'

            ],
            (err, results) => {
              if (err) {
                console.log(err);
                return reject(err);
              }
              console.log('results', results.insertId)
              resolve({
                results: results.insertId
              });
            }
          );
        }
      );
    } catch (error) {
      reject(error);
    }
  });
};

exports.insertUserPaymentDetails = (slipUrl, id) => {
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO govi_shop.paymentplan (`ownerId`, `paymentSlip`) VALUES (?, ?)";
    goviShop.query(sql, [id, slipUrl], (err, results) => {
      if (err) return reject(err);
      resolve(results.affectedRows > 0);
    });
  });
};


exports.SendGeneratedPasswordDao = async (
  email,
  password,
  phone,
  name,
  subscription
) => {
  try {
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    const pdfBuffer = [];
    doc.on("data", pdfBuffer.push.bind(pdfBuffer));

    /* ---------- LOGO ---------- */
    const logo = path.resolve(__dirname, "../assets/govishop.png");
    doc.image(logo, 255, 60, { width: 70 });

    /* ---------- TITLE ---------- */
    doc
      .font("Helvetica-Bold")
      .fillColor("#02072C")
      .fontSize(14)
      .text(
        `Welcome to GoViShop – Your ${subscription} Plan is Activated`,
        80, 140,
        { align: "center", width: 440 }
      );

    /* ---------- DIVIDER ---------- */
    doc
      .moveTo(80, 180)
      .lineTo(520, 180)
      .strokeColor("#E5E7EB")
      .stroke();

    /* ---------- BODY ---------- */
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#02072C")
      .text(`Dear ${name},`, 80, 200);

    doc.moveDown();

    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#02072C")
      .text("Warm greetings from GoViShop!", { width: 440 });

    doc.moveDown(0.5);

    doc
      .lineGap(6)
      .text(
        `We are pleased to inform you that your ${subscription} Plan has been successfully activated, and your account has been created.`,
        { width: 440 }
      );

    doc
      .lineGap(6)
      .text(
        `Welcome to the GoViShop community! You can now start exploring our platform and enjoy the features available under your plan.`,
        { width: 440 }
      );

    doc.text("Your login details are as follows:", { width: 440 });

    /* ---------- CREDENTIAL BOX ---------- */
    const boxY = doc.y + 10;

    doc
      .roundedRect(80, boxY, 440, 60, 6)
      .fill("#FDE3C6");

    doc
      .fillColor("#000000")
      .fontSize(12)
      .text(`Username: ${phone} / ${email}`, 95, boxY + 15);

    doc.text(`Temporary Password: ${password}`, 95, boxY + 35);

    /* ---------- SECURITY NOTE ---------- */
    doc
      .fillColor("#02072C")
      .lineGap(6)
      .fontSize(12)
      .text(
        "For security reasons, we strongly recommend that you change your password after your first login.",
        80,
        boxY + 80,
        { width: 440 }
      );

    doc.text("To get started, simply log in using the link below:", {
      width: 440,
    });

    /* ---------- LOGIN BUTTON ---------- */
    const btnY = doc.y + 15;

    doc
      .roundedRect(80, btnY, 440, 40, 8)
      .fill("#FF7A00");

    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("Login", 80, btnY + 13, {
        width: 440,
        align: "center",
      });

    doc.link(80, btnY, 440, 40, "https://GoViShop-link.com");   // ← clickable overlay

    doc.moveDown(2);

    /* ---------- FALLBACK LINK ---------- */
    doc
      .font("Helvetica")
      .fillColor("#02072C")
      .fontSize(12)
      .text(
        "If the button doesn't work, copy and paste the link into your browser:",
        80, doc.y,
        { width: 440 }
      );

    doc.moveDown(0.5);

    /* ---------- URL BOX ---------- */
    const urlBoxY = doc.y;

    doc
      .roundedRect(80, urlBoxY, 440, 38, 6)
      .fill("#FAFAFA")
      .stroke("#E5E7EB");

    doc
      .fillColor("#3177FF")
      .font("Helvetica")
      .fontSize(12)
      .text("https://GoViShop-link.com", 95, urlBoxY + 13, {
        width: 420,
        underline: true,
      });

    doc.moveDown(2);

    /* ---------- FOOTER ---------- */
    doc
      .fillColor("#02072C")
      .fontSize(12)
      .lineGap(0)
      .text("Thank you,", 80);

    doc.moveDown(0.4);

    doc
      .font("Helvetica-Bold")
      .text("GoViShop Team", 80);

    const cardBottomY = doc.y + 30;
    const cardHeight = cardBottomY - 40;

    doc.save();

    doc
      .roundedRect(40, 40, 515, cardHeight, 10)
      .stroke("#e5e7eb");
    doc.restore();

    /* ---------- BOTTOM NOTE (outside card) ---------- */
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#666666")
      .text(
        "@ 2026 Polygon Holdings Limited. All Rights Reserved.",
        80,
        cardBottomY + 15,
        { align: "center", width: 440 }
      );
    doc.moveDown(1);


    doc
      .fillColor('#868686')
      .text("Please note that this is an automated message.", {
        align: "center",
        width: 440,
      });

    doc.end();
    await new Promise((resolve) => doc.on("end", resolve));

    const pdfData = Buffer.concat(pdfBuffer);

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465, // or 587 for TLS
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        family: 4,
      },
    });

    // const transporter = nodemailer.createTransport({
    //   host: "smtp.gmail.com",
    //   port: 587,
    //   secure: false,
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS,
    //   },
    //   tls: { rejectUnauthorized: false },
    // });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to GoViShop – Your Account is Ready",
      text: `Dear ${name},\n\nYour login details are attached.`,
      attachments: [
        {
          filename: `Login_Details_${name}.pdf`,
          content: pdfData,
        },
      ],
    });

    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error };
  }
};

exports.updateGovieShopPassword = (password, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
            UPDATE shopowners
            SET password = ?, isPasswordChanged = 0
            WHERE id = ?
        `;
    goviShop.query(sql, [password, id], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      resolve(results); // Resolve with the query results
    }
    );
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

exports.getAllShowViewActionDAO = (page, limit, status, searchText, allSuppliers) => {
  const offset = (page - 1) * limit;
  return new Promise((resolve, reject) => {

    let whereClause = `WHERE 1=1 AND so.isAvailable = 1`;

    if (!allSuppliers) {
      whereClause += ` AND so.accessStatus IN ('Pending', 'Rejected') `
    }

    console.log('whereClause', whereClause)

    let countSql = `
      SELECT COUNT(*) as total 
       FROM govi_shop.shopowners so
    `;

    let dataSql = `
      SELECT
        so.id,
        so.ownername, 
        so.nic, 
        so.shopPhone, 
        so.isActivated,
        so.accessStatus,
        so.currentPlan,
        DATE_ADD(so.activatedAt, INTERVAL '5:30' HOUR_MINUTE) AS activatedAt, 
        a.userName AS updatedAt
      FROM govi_shop.shopowners so 
      LEFT JOIN agro_world_admin.adminusers a ON so.activatedBy = a.id

    `;

    const params = [];
    const countParams = [];

    let whereConditions = [];

    // if (searchText) {
    //   whereConditions.push(`
    //       (
    //         su.shopName LIKE ?
    //         OR su.nic LIKE ?
    //         OR su.shopPhone LIKE ?
    //       )
    //     `);

    //   const searchValue = `%${searchText}%`;
    //   params.push(...Array(3).fill(searchValue));
    //   countParams.push(...Array(3).fill(searchValue));
    // }

    if (status) {
      if (status === 'Deactivate') whereConditions.push(` so.accessStatus = 'Pending' `);
      else if (status === 'Rejected') whereConditions.push(` so.accessStatus = 'Rejected' `);
    }

    // Append WHERE conditions if any exist
    if (whereConditions.length > 0) {
      whereClause += ' AND ' + whereConditions.join(" AND ");
    }

    countSql += whereClause;
    dataSql += whereClause;

    dataSql += " ORDER BY so.createdAt DESC";

    dataSql += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    console.log('dataSql', dataSql)

    // Execute count query first
    goviShop.query(countSql, countParams, (countErr, countResults) => {
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
          so.id,
          so.ownername,
          so.shopPhone,
          so.nic,
          so.accessStatus,
          so.isActivated,
          so.currentPlan,
          pp.paymentSlip,
          pp.planPrice
      FROM shopowners so
      LEFT JOIN paymentplan pp ON so.id = pp.ownerId AND pp.id = ( SELECT MAX(id) FROM paymentplan WHERE ownerId = so.id)
      WHERE so.id = ?;
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
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const logoPath = path.join(__dirname, "..", "assets", "logo.png");
  const logoExists = fs.existsSync(logoPath);

  // ✅ FIX 1: Support a hosted logo URL as fallback (set LOGO_URL in your .env)
  const logoUrl = process.env.LOGO_URL || "";

  if (!logoExists && !logoUrl) {
    console.warn(
      "⚠️ Logo file not found and no LOGO_URL set. Using text fallback.",
    );
  }

  const loginUrl = process.env.LOGIN_URL || "https://www.govishop.com/login";

  // Decide which logo markup to use:
  // 1. Embedded CID (attached file) — best for most email clients
  // 2. Hosted URL — reliable fallback when file is missing
  // 3. Plain text fallback
  let logoMarkup;
  if (logoExists) {
    logoMarkup = `<img src="cid:logo" alt="GoViShop Logo" width="64" height="64" style="width:64px;height:64px;object-fit:contain;display:block;margin:0 auto;" />`;
  } else if (logoUrl) {
    logoMarkup = `<img src="${logoUrl}" alt="GoViShop Logo" width="64" height="64" style="width:64px;height:64px;object-fit:contain;display:block;margin:0 auto;" />`;
  } else {
    logoMarkup = `<h2 style="color:#E87722;margin:0;font-size:22px;">GoViShop</h2>`;
  }

  const plainText = `
Dear ${shopUser.ownername},

Congratulations on joining GoViShop as a Premium Member!

We are delighted to welcome you to the GoViShop community and thank you
for choosing to upgrade your experience with our Premium Membership.

This email is to confirm that your registration has been completed
successfully and your payment for the Premium Package has been received.
Your Premium Membership is now active.

Login to your account here:
${loginUrl}

If you have any questions, feel free to contact us at support@govishop.com.

Thank you,
GoViShop Team

@ 2026 Polygon Holdings Limited. All Rights Reserved.
Please note that this is an automated message.
  `.trim();

  // ✅ FIX 2: Title alignment corrected to left (matching design image)
  const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to GoViShop Premium</title>
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
      padding: 28px 20px 16px;
    }
    .header .brand {
      font-size: 15px; font-weight: bold;
      color: #E87722; margin-top: 6px;
      letter-spacing: 0.3px;
    }

    /* ── Title ── */
    .title-bar {
      padding: 10px 40px 6px;
      background-color: #ffffff;
      text-align: center;             /* ✅ FIXED: was "center", now "left" to match design */
    }
    .title-bar p {
      font-size: 16px; font-weight: bold;
      color: #111111;
      line-height: 1.5;
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
      background: linear-gradient(to right, #f0a500, #E87722);
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
      padding: 18px 40px 28px;
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

      <!-- Header: Logo + Brand -->
      <div class="header">
        ${logoMarkup}
        <div class="brand">GoViShop</div>
      </div>

      <!-- Title: LEFT-ALIGNED as per design -->
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

  const mailOptions = {
    from: `"GoViShop Team" <noreply@govishop.com>`,
    replyTo: `support@govishop.com`,
    to: shopUser.email,
    subject: "Welcome to Govishop Premium – Payment Received Successfully",
    text: plainText,
    html: htmlTemplate,
  };

  // ✅ Attach logo file only when it exists (CID embedding)
  if (logoExists) {
    mailOptions.attachments = [
      {
        filename: "logo.png",
        path: logoPath,
        cid: "logo",
      },
    ];
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `✅ Renewal email sent to ${shopUser.email} | MessageId: ${info.messageId}`,
    );
  } catch (error) {
    console.error(
      `❌ Failed to send renewal email to ${shopUser.email}:`,
      error.message,
    );
    throw error;
  }
};

exports.deleteGoviShopSupplierDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
            UPDATE shopusers
            SET isAvailable = 0
            WHERE id = ?
        `;
    goviShop.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};


exports.GetAllShopsByOwnerDAO = (
  id,
  page,
  limit,
  accessStatus,
  approval,
  bussinessType,
  searchItem,
) => {
  return new Promise((resolve, reject) => {
    const Sqlparams = [id];
    const Counterparams = [id];
    const offset = (page - 1) * limit;

    // SQL to count total records - Added missing JOINs
    let countSql = `
      SELECT COUNT(*) AS total
      FROM govi_shop.govishops gs
      WHERE gs.ownerId = ?
    `;

    // SQL to fetch paginated data
    let sql = `
      SELECT 
        gs.id, 
        gs.shopName,
        gs.shopType,
        gs.email,
        gs.phone,
        DATE_ADD(gs.updatedAt, INTERVAL 330 MINUTE) AS updatedAt,
        gs.shopTypeImg AS logo,
        gs.isActive,
        gs.approvedStatus
      FROM govi_shop.govishops gs
      WHERE gs.ownerId = ?
    `;

    if (accessStatus) {

      const active = accessStatus === 'Active' ? 1 : 0;
      countSql += " AND gs.isActive = ? ";
      sql += " AND gs.isActive = ? ";
      Sqlparams.push(active);
      Counterparams.push(active);
    }

    // Add filter for status
    if (approval) {
      countSql += " AND gs.approvedStatus = ? ";
      sql += " AND gs.approvedStatus = ? ";
      Sqlparams.push(approval);
      Counterparams.push(approval);
    }

    // Fixed category filter to use the correct alias
    if (bussinessType) {
      countSql += " AND gs.shopType = ? ";
      sql += " AND gs.shopType = ? ";
      Sqlparams.push(bussinessType);
      Counterparams.push(bussinessType);
    }

    // Add search functionality
    if (searchItem) {
      countSql += " AND ( gs.shopName LIKE ? OR gs.phone LIKE ? )";
      sql += " AND ( gs.shopName LIKE ? OR gs.phone LIKE ? )";
      const searchQuery = `%${searchItem}%`;
      Sqlparams.push(searchQuery, searchQuery);
      Counterparams.push(searchQuery, searchQuery);
    }

    // Add pagination
    sql += " ORDER BY gs.updatedAt DESC LIMIT ? OFFSET ?";
    Sqlparams.push(parseInt(limit), parseInt(offset));

    console.log('sql', sql)

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
      }
    );
  });
};

exports.checkExistShopOwnerDao = (nic) => {
  return new Promise((resolve, reject) => {
    const sql = `
          SELECT *
          FROM govi_shop.shopowners
          WHERE nic = ?
      `;

    collectionofficer.query(sql, [nic], (err, results) => {
      if (err) {
        return reject(err);
      }
      let validationResult = false;
      if (results.length > 0) {
        validationResult = true;
      }
      resolve(validationResult);
    });
  });
};

exports.checkExistEmailsDao = (email) => {
  return new Promise((resolve, reject) => {
    const sql = `
          SELECT *
          FROM govi_shop.shopowners
          WHERE email = ?
      `;

    collectionofficer.query(sql, [email], (err, results) => {
      if (err) {
        return reject(err);
      }
      let validationResult = false;
      if (results.length > 0) {
        validationResult = true;
      }
      resolve(validationResult);
    });
  });
};

exports.checkExistPhoneDao = (phone1) => {
  return new Promise((resolve, reject) => {
    const sql = `
          SELECT *
          FROM govi_shop.shopowners
          WHERE shopPhone = ?
      `;

    collectionofficer.query(sql, [phone1, phone1], (err, results) => {
      if (err) {
        return reject(err);
      }
      let validationResult = false;
      if (results.length > 0) {
        validationResult = true;
      }
      resolve(validationResult);
    });
  });
};

exports.getGoViShopSupplierById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        su.id,
        su.ownername AS fullName,
        su.email,
        su.nic,
        su.shopPhone AS mobileNumber

      FROM govi_shop.shopowners su
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


exports.checkExistShopOwnerDao = (nic, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT *
      FROM govi_shop.shopowners
      WHERE nic = ? AND id != ?       
    `;

    collectionofficer.query(sql, [nic, id], (err, results) => {
      if (err) return reject(err);
      resolve(results.length > 0);
    });
  });
};

exports.checkExistEmailsDao = (email, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT *
      FROM govi_shop.shopowners
      WHERE email = ? AND id != ?  
    `;

    collectionofficer.query(sql, [email, id], (err, results) => {
      if (err) return reject(err);
      resolve(results.length > 0);
    });
  });
};

exports.checkExistPhoneDao = (phone1, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT *
      FROM govi_shop.shopowners
      WHERE shopPhone = ? AND id != ?  
    `;

    collectionofficer.query(sql, [phone1, id], (err, results) => {
      if (err) return reject(err);
      resolve(results.length > 0);
    });
  });
};

exports.updateGoviShopUser = (supplierData) => {

  return new Promise((resolve, reject) => {
    let sql = `
      UPDATE govi_shop.shopowners
      SET 
        ownerName = ?, shopPhone = ?, email = ?, nic = ?
      WHERE id = ?
    `;

    const values = [
      supplierData.ownerName,
      supplierData.shopPhone,
      supplierData.email,
      supplierData.nic,
      supplierData.id
    ];

    collectionofficer.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }
      console.log("GoViShop Supplier details updated successfully");
      console.log("Affected rows:", results.affectedRows);
      resolve(results);
    });
  });
};

exports.GetAllShopRequestsDAO = (
  page,
  limit,
  approval,
  bussinessType,
  searchItem,
) => {
  return new Promise((resolve, reject) => {
    const Sqlparams = [];
    const Counterparams = [];
    const offset = (page - 1) * limit;

    // SQL to count total records - Added missing JOINs
    let countSql = `
      SELECT COUNT(*) AS total
      FROM govi_shop.govishops gs
      LEFT JOIN govi_shop.shopowners so ON gs.ownerId = so.id
      WHERE gs.approvedStatus != 'Approved'
    `;

    // SQL to fetch paginated data
    let sql = `
      SELECT 
        gs.id, 
        gs.shopName,
        gs.shopType,
        gs.email,
        gs.phone,
        DATE_ADD(gs.updatedAt, INTERVAL 330 MINUTE) AS updatedAt,
        gs.shopTypeImg AS logo,
        gs.isActive,
        gs.approvedStatus,
        so.ownerName,
        so.shopPhone As ownerPhone
      FROM govi_shop.govishops gs
      LEFT JOIN govi_shop.shopowners so ON gs.ownerId = so.id
      WHERE gs.approvedStatus != 'Approved'
    `;

    // Add filter for status
    if (approval) {
      countSql += " AND gs.approvedStatus = ? ";
      sql += " AND gs.approvedStatus = ? ";
      Sqlparams.push(approval);
      Counterparams.push(approval);
    }

    // Fixed category filter to use the correct alias
    if (bussinessType) {
      countSql += " AND gs.shopType = ? ";
      sql += " AND gs.shopType = ? ";
      Sqlparams.push(bussinessType);
      Counterparams.push(bussinessType);
    }

    // Add search functionality
    if (searchItem) {
      countSql += `
        AND ( gs.shopName LIKE ? OR gs.phone LIKE ? )
      `;
      sql += `
        AND ( gs.shopName LIKE ? OR gs.phone LIKE ? )
      `;
      const searchQuery = `%${searchItem}%`;
      Sqlparams.push(searchQuery, searchQuery);
      Counterparams.push(searchQuery, searchQuery);
    }

    // Add pagination
    sql += " ORDER BY gs.updatedAt DESC LIMIT ? OFFSET ?";
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
      }
    );
  });
};

exports.getGoViShopById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        gs.id,
        gs.shopName,
        gs.email,
        gs.address,
        gs.phone AS mobileNumber

      FROM govi_shop.govishops gs
      WHERE gs.id = ?
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