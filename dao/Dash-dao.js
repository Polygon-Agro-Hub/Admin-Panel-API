const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
  dash,
} = require("../startup/database");

const QRCode = require("qrcode");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const uploadFileToS3 = require("../middlewares/s3upload");
const { resolve } = require("path");

const Joi = require("joi");

// const getHouseDetails = () => `
//     CASE
//         WHEN c.buildingType = 'House' THEN h.houseNo
//         ELSE NULL
//     END AS houseHouseNo,
//     CASE
//         WHEN c.buildingType = 'House' THEN h.streetName
//         ELSE NULL
//     END AS houseStreetName,
//     CASE
//         WHEN c.buildingType = 'House' THEN h.city
//         ELSE NULL
//     END AS houseCity
// `;

// // Function to get apartment details if the customer lives in an apartment
// const getApartmentDetails = () => `
//     CASE
//         WHEN c.buildingType = 'Apartment' THEN a.buildingNo
//         ELSE NULL
//     END AS apartmentBuildingNo,
//     CASE
//         WHEN c.buildingType = 'Apartment' THEN a.buildingName
//         ELSE NULL
//     END AS apartmentBuildingName,
//     CASE
//         WHEN c.buildingType = 'Apartment' THEN a.unitNo
//         ELSE NULL
//     END AS apartmentUnitNo,
//     CASE
//         WHEN c.buildingType = 'Apartment' THEN a.floorNo
//         ELSE NULL
//     END AS apartmentFloorNo,
//     CASE
//         WHEN c.buildingType = 'Apartment' THEN a.houseNo
//         ELSE NULL
//     END AS apartmentHouseNo,
//     CASE
//         WHEN c.buildingType = 'Apartment' THEN a.streetName
//         ELSE NULL
//     END AS apartmentStreetName,
//     CASE
//         WHEN c.buildingType = 'Apartment' THEN a.city
//         ELSE NULL
//     END AS apartmentCity
// `;

// // Function to construct the SQL query
// const getAllCustomersQuery = () => `
//     SELECT
//         c.id,
//         c.cusId,
//         c.title,
//         c.firstName,
//         c.lastName,
//         c.phoneNumber,
//         c.email,
//         c.buildingType,
//         s.empId AS salesAgentEmpId,
//         s.firstName AS salesAgentFirstName,
//         s.lastName AS salesAgentLastName,
//         c.created_at,
//         ${getHouseDetails()},
//         ${getApartmentDetails()}
//     FROM customer c
//     LEFT JOIN salesagent s ON c.salesAgent = s.id
//     LEFT JOIN house h ON c.id = h.customerId AND c.buildingType = 'House'
//     LEFT JOIN apartment a ON c.id = a.customerId AND c.buildingType = 'Apartment'
//     ORDER BY c.created_at DESC
// `;

// // Function to execute the query and fetch customer data
// const getAllCustomers = () => {
//     return new Promise((resolve, reject) => {
//         marketPlace.query(getAllCustomersQuery(), (err, results) => {
//             if (err) {
//                 return reject(err);
//             }
//             resolve(results);
//         });
//     });
// };

const getAllSalesAgents = (page, limit, searchText, status) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let countSql = `
            SELECT COUNT(*) as total
            FROM salesagent
        `;

    let dataSql = `
            SELECT
                salesagent.id,
                salesagent.empId,
                salesagent.firstName,
                salesagent.lastName,
                salesagent.status,
                salesagent.phoneCode1,
                salesagent.phoneNumber1,
                salesagent.nic
            FROM salesagent
        `;

    const countParams = [];
    const dataParams = [];

    let whereConditions = []; // Store WHERE conditions

    if (searchText) {
      whereConditions.push(`
                (
                    salesagent.nic LIKE ?
                    OR salesagent.firstName LIKE ?
                    OR salesagent.lastName LIKE ?
                    OR salesagent.phoneNumber1 LIKE ?
                    OR salesagent.phoneCode1 LIKE ?
                    OR salesagent.empId LIKE ?
                    OR salesagent.status LIKE ?
                )
            `);

      const searchValue = `%${searchText}%`;
      countParams.push(
        searchValue,
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
        searchValue,
        searchValue
      );
    }

    if (status) {
      whereConditions.push(`salesagent.status = ?`);
      countParams.push(status);
      dataParams.push(status);
    }

    // Append WHERE conditions if any exist
    if (whereConditions.length > 0) {
      countSql += " WHERE " + whereConditions.join(" AND ");
      dataSql += " WHERE " + whereConditions.join(" AND ");
    }

    dataSql += " ORDER BY salesagent.createdAt DESC";

    // Add pagination at the end, so LIMIT and OFFSET are always numbers
    dataSql += " LIMIT ? OFFSET ?";
    dataParams.push(parseInt(limit), parseInt(offset)); // Ensure they are integers

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

        resolve({ items: dataResults, total });
      });
    });
  });
};

const deleteSalesAgent = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM salesagent WHERE id = ?";
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results.affectedRows);
      }
    });
  });
};

const getForCreateId = (role) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT empId FROM salesagent WHERE empId LIKE ? ORDER BY empId DESC LIMIT 1";
    marketPlace.query(sql, [`${role}%`], (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length > 0) {
        const numericPart = parseInt(results[0].empId.substring(4), 10);

        const incrementedValue = numericPart + 1;

        results[0].empId = incrementedValue.toString().padStart(5, "0");
        console.log(results[0].empId);
      }

      resolve(results);
    });
  });
};

const checkNICExist = (nic) => {
  return new Promise((resolve, reject) => {
    const sql = `
              SELECT COUNT(*) AS count 
              FROM salesagent 
              WHERE nic = ?
          `;

    marketPlace.query(sql, [nic], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].count > 0); // Return true if either NIC or email exists
    });
  });
};

const checkEmailExist = (email) => {
  return new Promise((resolve, reject) => {
    const sql = `
              SELECT COUNT(*) AS count 
              FROM salesagent 
              WHERE email = ?
          `;

    marketPlace.query(sql, [email], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].count > 0); // Return true if either NIC or email exists
    });
  });
};

const checkPhoneExist = (phoneNumber) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS count 
      FROM salesagent 
      WHERE phoneNumber1 = ? OR phoneNumber2 = ?
    `;

    marketPlace.query(sql, [phoneNumber, phoneNumber], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].count > 0); // Return true if the phone number exists in either field
    });
  });
};


const createSalesAgent = (officerData, profileImageUrl, newSalseAgentId) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Prepare data for QR code generation
      // const qrData = `
      //       {
      //           "empId": "${officerData.empId}",
      //       }
      //       `;

      // const qrCodeBase64 = await QRCode.toDataURL(qrData);
      // const qrCodeBuffer = Buffer.from(
      //   qrCodeBase64.replace(/^data:image\/png;base64,/, ""),
      //   "base64"
      // );
      // const qrcodeURL = await uploadFileToS3(
      //   qrCodeBuffer,
      //   `${officerData.empId}.png`,
      //   "collectionofficer/QRcode"
      // );
      // console.log(qrcodeURL);

      // If no image URL, set it to null
      const imageUrl = profileImageUrl || null; // Use null if profileImageUrl is not provided

      const sql = `
                  INSERT INTO salesagent (
                      firstName, lastName, empId, empType, phoneCode1, phoneNumber1, phoneCode2, phoneNumber2,
                      nic, email, houseNumber, streetName, city, district, province, country,
                      accHolderName, accNumber, bankName, branchName, image, status
                  ) VALUES (
                           ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                           ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?, 'Not Approved')
              `;

      // Database query with QR image data added
      marketPlace.query(
        sql,
        [
          officerData.firstName,
          officerData.lastName,
          newSalseAgentId,
          officerData.empType,
          officerData.phoneCode1,
          officerData.phoneNumber1,
          officerData.phoneCode2,
          officerData.phoneNumber2,
          officerData.nic,
          officerData.email,
          officerData.houseNumber,
          officerData.streetName,
          officerData.city,
          officerData.district,
          officerData.province,
          officerData.country,
          officerData.accHolderName,
          officerData.accNumber,
          officerData.bankName,
          officerData.branchName,
          imageUrl,
        ],
        (err, results) => {
          if (err) {
            console.log(err);
            return reject(err); // Reject promise if an error occurs
          }
          resolve(results); // Resolve the promise with the query results
        }
      );
    } catch (error) {
      reject(error); // Reject if any error occurs during QR code generation
    }
  });
};

const getSalesAgentDataById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
              SELECT 
                  *
              FROM 
                  salesagent
              WHERE 
                  id = ?`;

    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

const updateSalesAgentDetails = (
  id,
  firstName,
  lastName,
  empId,
  empType,
  phoneCode1,
  phoneNumber1,
  phoneCode2,
  phoneNumber2,
  nic,
  email,
  houseNumber,
  streetName,
  city,
  district,
  province,
  country,
  accHolderName,
  accNumber,
  bankName,
  branchName,
  profileImageUrl
) => {
  return new Promise((resolve, reject) => {
    let sql = `
               UPDATE salesagent
                  SET firstName = ?, lastName = ?, empId = ?, empType = ?, phoneCode1 = ?, phoneNumber1 = ?, phoneCode2 = ?, phoneNumber2 = ?,
                      nic = ?, email = ?, houseNumber = ?, streetName = ?, city = ?, district = ?, province = ?, country = ?,
                      accHolderName = ?, accNumber = ?, bankName = ?, branchName = ?, image = ? , status = 'Not Approved'
            `;
    let values = [
      firstName,
      lastName,
      empId,
      empType,
      phoneCode1,
      phoneNumber1,
      phoneCode2,
      phoneNumber2,
      nic,
      email,
      houseNumber,
      streetName,
      city,
      district,
      province,
      country,
      accHolderName,
      accNumber,
      bankName,
      branchName,
      profileImageUrl,
    ];

    sql += ` WHERE id = ?`;
    values.push(id);

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

const getSalesAgentEmailDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
              SELECT email, firstName, empId AS empId
              FROM salesagent
              WHERE id = ?
          `;
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      if (results.length > 0) {
        resolve({
          email: results[0].email, // Resolve with email
          firstName: results[0].firstName,
          empId: results[0].empId, // Resolve with employeeType (empId)
        });
      } else {
        resolve(null); // Resolve with null if no record is found
      }
    });
  });
};

const UpdateSalesAgentStatusAndPasswordDao = (params) => {
  return new Promise((resolve, reject) => {
    const sql = `
              UPDATE salesagent
              SET status = ?, password = ?, passwordUpdate = 0
              WHERE id = ?
          `;
    marketPlace.query(
      sql,
      [params.status, params.password, parseInt(params.id)],
      (err, results) => {
        if (err) {
          return reject(err); // Reject promise if an error occurs
        }
        resolve(results); // Resolve with the query results
      }
    );
  });
};

const SendGeneratedPasswordDao = async (email, password, empId, firstName) => {
  try {
    const doc = new PDFDocument();

    // Create a buffer to hold the PDF in memory
    const pdfBuffer = [];
    doc.on("data", pdfBuffer.push.bind(pdfBuffer));
    doc.on("end", () => { });

    const watermarkPath = "./assets/bg.png";
    doc.opacity(0.2).image(watermarkPath, 100, 300, { width: 400 }).opacity(1);

    doc
      .fontSize(20)
      .fillColor("#071a51")
      .text("Welcome to PolygonAgro (Pvt) Ltd - Registration Confirmation", {
        align: "center",
      });

    doc.moveDown();

    const lineY = doc.y;

    doc.moveTo(50, lineY).lineTo(550, lineY).stroke();

    doc.moveDown();

    doc.fontSize(12).text(`Dear ${firstName},`);

    doc.moveDown();

    doc
      .fontSize(12)
      .text(
        "Thank you for registering with us! We are excited to have you on board."
      );

    doc.moveDown();

    doc
      .fontSize(12)
      .text(
        "You have successfully created an account with PolygonAgro (Pvt) Ltd. Our platform will help you with all your agricultural needs, providing guidance, weather reports, asset management tools, and much more. We are committed to helping farmers like you grow and succeed.",
        {
          align: "justify",
        }
      );

    doc.moveDown();

    doc.fontSize(12).text(`Your User Name/ID: ${empId}`);
    doc.fontSize(12).text(`Your Password: ${password}`);

    doc.moveDown();

    doc
      .fontSize(12)
      .text(
        "If you have any questions or need assistance, feel free to reach out to our support team at polygonagro.inf@gmail.com",
        {
          align: "justify",
        }
      );

    doc.moveDown();

    doc.fontSize(12).text("We are here to support you every step of the way!", {
      align: "justify",
    });

    doc.moveDown();
    doc.fontSize(12).text(`Best Regards,`);
    doc.fontSize(12).text(`The PolygonAgro Team`);
    doc.fontSize(12).text(`PolygonAgro (Pvt) Ltd. | All rights reserved.`);
    doc.moveDown();
    doc.fontSize(12).text(`Address: No:14,`);
    doc.fontSize(12).text(`            Sir Baron Jayathilake Mawatha,`);
    doc.fontSize(12).text(`            Colombo 01.`);
    doc.moveDown();
    doc.fontSize(12).text(`Email: polygonagro.inf@gmail.com`);

    doc.end();

    // Wait until the PDF is fully created and available in the buffer
    await new Promise((resolve) => doc.on("end", resolve));

    const pdfData = Buffer.concat(pdfBuffer); // Concatenate the buffer data

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
    //   port: 465, // or 587
    //   secure: true,
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS,
    //   },
    //   tls: {
    //     rejectUnauthorized: false, // Allow self-signed certificates
    //   },
    // });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to PolygonAgro (Pvt) Ltd - Registration Confirmation",
      text: `Dear ${firstName},\n\nYour registration details are attached in the PDF.`,
      attachments: [
        {
          filename: `password_${empId}.pdf`, // PDF file name
          content: pdfData, // Attach the PDF buffer directly
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);

    return { success: true, message: "Email sent successfully!" };
  } catch (error) {
    console.error("Error sending email:", error);

    return { success: false, message: "Failed to send email.", error };
  }
};

const getAllSalesCustomers = (page, limit, searchText) => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    let countSql = `
              SELECT 
                COUNT(*) AS total
              FROM 
                  marketplaceusers CUS
              INNER JOIN 
                  salesagent SA ON CUS.salesAgent = SA.id AND CUS.isDashUser = 1
        `;

    let dataSql = `
            SELECT 
              CUS.id,
              CUS.cusId,
              CUS.phoneNumber, 
              CUS.firstName, 
              CUS.lastName, 
              CUS.buildingType,
              CUS.email,
              SA.empId,
              SA.firstName AS salesAgentFirstName,
              SA.lastName AS salesAgentLastName,
              CUS.created_at,
              (SELECT COUNT(*) FROM orders WHERE userId = CUS.id) AS totOrders,
              -- House details
              H.houseNo AS houseHouseNo,
              H.streetName AS houseStreetName,
              H.city AS houseCity,
              -- Apartment details
              A.buildingNo AS apartmentBuildingNo,
              A.buildingName AS apartmentBuildingName,
              A.unitNo AS apartmentUnitNo,
              A.houseNo AS apartmentHouseNo,
              A.streetName AS apartmentStreetName,
              A.city AS apartmentCity,
              A.floorNo AS apartmentFloorNo
            FROM 
                marketplaceusers CUS
            INNER JOIN 
                salesagent SA ON CUS.salesAgent = SA.id
            LEFT JOIN 
                house H ON CUS.id = H.customerId AND CUS.buildingType = 'House'
            LEFT JOIN 
                apartment A ON CUS.id = A.customerId AND CUS.buildingType = 'Apartment'
            WHERE
                 CUS.isDashUser = 1
        `;

    const countParams = [];
    const dataParams = [];

    if (searchText) {
      const searchCondition = `
                AND (
                    CUS.firstName LIKE ?
                    OR CUS.lastName LIKE ?
                    OR CUS.phoneNumber LIKE ?
                )
            `;
      countSql += searchCondition;
      dataSql += searchCondition;
      const searchValue = `%${searchText}%`;
      countParams.push(searchValue, searchValue, searchValue);
      dataParams.push(searchValue, searchValue, searchValue);
    }

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

        resolve({ items: dataResults, total });
      });
    });
  });
};

const getAllOrders = (
  page,
  limit,
  orderStatus,
  paymentMethod,
  paymentStatus,
  deliveryType,
  searchText,
  date
) => {
  return new Promise((resolve, reject) => {
    // Convert page and limit to numbers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    const offset = (page - 1) * limit;

    // Use consistent JOIN syntax in both queries
    let baseSql = `
      FROM orders o
      JOIN marketplaceusers c ON o.userId = c.id
      JOIN salesagent sa ON c.salesAgent = sa.id
      JOIN processorders po ON o.id = po.orderId
      WHERE o.orderApp = 'Dash'
    `;

    let countSql = `SELECT COUNT(*) as total ${baseSql}`;
    let dataSql = `
      SELECT
        po.id,
        po.InvNo AS invNo,
        po.status AS orderStatus,
        o.sheduleDate AS scheduleDate,
        po.paymentMethod,
        po.isPaid AS paymentStatus,
        o.discount AS fullDiscount,
        o.fullTotal,
        o.delivaryMethod AS deliveryType,
        o.sheduleType,
        o.sheduleTime,
        po.createdAt,
        c.cusId,
        c.firstName,
        c.lastName,
        sa.empId
      ${baseSql}
    `;

    const params = [];

    let whereConditions = [];

    if (searchText) {
      whereConditions.push(`
        (
          c.cusId LIKE ?
          OR c.firstName LIKE ?
          OR c.lastName LIKE ?
          OR po.invNo LIKE ?
          OR sa.empId LIKE ?
          OR o.delivaryMethod LIKE ?
          OR po.isPaid LIKE ?
          OR po.status LIKE ?
          OR po.paymentMethod LIKE ?
        )
      `);

      const searchValue = `%${searchText}%`;
      params.push(...Array(9).fill(searchValue));
    }


    if (orderStatus) {
      console.log("Order Status:", orderStatus);

      whereConditions.push(`po.status = ?`);
      params.push(orderStatus);
    }

    if (paymentMethod) {
      if (paymentMethod === "Online Payment") {
        whereConditions.push(`po.paymentMethod = ?`);
        params.push("Card");
      } else if (paymentMethod === "Pay By Cash") {
        whereConditions.push(`po.paymentMethod = ?`);
        params.push("Cash");
      }

    }

    if (paymentStatus !== undefined && paymentStatus !== "") {
      whereConditions.push(`po.isPaid = ?`);
      params.push(parseInt(paymentStatus));
    }

    if (deliveryType) {
      whereConditions.push(`o.delivaryMethod = ?`);
      params.push(deliveryType);
    }

    if (date) {
      whereConditions.push(`DATE(o.sheduleDate) = DATE(?)`);
      console.log(date);
      let formattedDate = '';
      const d = new Date(date);
      formattedDate = d.toISOString().split('T')[0];
      console.log(formattedDate);
      params.push(formattedDate);
    }

    // Append WHERE conditions if any exist
    if (whereConditions.length > 0) {
      const whereClause = " AND " + whereConditions.join(" AND ");
      countSql += whereClause;
      dataSql += whereClause;
    }

    dataSql += " ORDER BY po.createdAt DESC LIMIT ? OFFSET ?";
    console.log(dataSql);


    // Execute count query first
    marketPlace.query(countSql, params, (countErr, countResults) => {
      if (countErr) {
        console.error("Error in count query:", countErr);
        return reject(countErr);
      }

      const total = countResults[0].total;

      // Only proceed with data query if there are results
      if (total === 0 || offset >= total) {
        return resolve({ items: [], total });
      }

      // Add pagination parameters (limit and offset)
      const dataQueryParams = [...params, limit, offset];

      marketPlace.query(dataSql, dataQueryParams, (dataErr, dataResults) => {
        if (dataErr) {
          console.error("Error in data query:", dataErr);
          return reject(dataErr);
        }

        resolve({
          items: dataResults,
          total,
          currentPage: page,
          totalPages: Math.ceil(total / limit),
        });
      });
    });
  });
};

const GetAllSalesAgentComplainDAO = (
  page,
  limit,
  status,
  category,
  comCategory,
  searchText,
  replyStatus
) => {
  return new Promise((resolve, reject) => {
    const Sqlparams = [];
    const Counterparams = [];
    const offset = (page - 1) * limit;

    // SQL to count total records
    let countSql = `
      SELECT COUNT(*) AS total
      FROM dashcomplain dc
      LEFT JOIN salesagent u ON dc.saId = u.id
      LEFT JOIN agro_world_admin.complaincategory cc ON dc.complainCategory = cc.id
      LEFT JOIN agro_world_admin.adminroles ar ON cc.roleId = ar.id
      WHERE 1 = 1
    `;

    // SQL to fetch paginated data
    let sql = `
      SELECT 
        dc.id, 
        dc.refNo,
        u.nic AS NIC,
        u.firstName AS firstName,
        u.lastName AS lastName,
        cc.categoryEnglish AS complainCategory,
        ar.role,
        dc.createdAt,
        dc.adminStatus AS status,
        dc.reply,
        dc.complain,
        dc.language,
        u.empId AS agentId
      FROM dashcomplain dc
      LEFT JOIN salesagent u ON dc.saId = u.id
      LEFT JOIN agro_world_admin.complaincategory cc ON dc.complainCategory = cc.id
      LEFT JOIN agro_world_admin.adminroles ar ON cc.roleId = ar.id
      WHERE 1 = 1
    `;

    // Add filter for status
    if (status) {
      countSql += " AND dc.adminStatus = ? ";
      sql += " AND dc.adminStatus = ? ";
      Sqlparams.push(status);
      Counterparams.push(status);
    }

    if (replyStatus) {
      console.log(replyStatus);

      if (replyStatus === 'No') {
        countSql += " AND dc.reply IS NULL ";
        sql += " AND dc.reply IS NULL ";

      } else if (replyStatus === 'Yes') {
        countSql += " AND dc.reply IS NOT NULL ";
        sql += " AND dc.reply IS NOT NULL ";

      }

    }

    // Add filter for category (role)
    if (category) {
      countSql += " AND ar.role = ? ";
      sql += " AND ar.role = ? ";
      Sqlparams.push(category);
      Counterparams.push(category);
    }

    // Add filter for complain category
    if (comCategory) {
      countSql += " AND dc.complainCategory = ? ";
      sql += " AND dc.complainCategory = ? ";
      Sqlparams.push(comCategory);
      Counterparams.push(comCategory);
    }

    // Add search functionality
    if (searchText) {
      countSql += `
        AND (dc.refNo LIKE ? OR u.firstName LIKE ? OR u.lastName LIKE ? OR cc.categoryEnglish LIKE ?)
      `;
      sql += `
        AND (dc.refNo LIKE ? OR u.firstName LIKE ? OR u.lastName LIKE ? OR cc.categoryEnglish LIKE ?)
      `;
      const searchQuery = `%${searchText}%`;
      Sqlparams.push(searchQuery, searchQuery, searchQuery, searchQuery);
      Counterparams.push(searchQuery, searchQuery, searchQuery, searchQuery);
    }

    // Add pagination
    sql += " ORDER BY dc.createdAt DESC LIMIT ? OFFSET ?";
    Sqlparams.push(parseInt(limit), parseInt(offset));

    // Execute count query to get total records
    marketPlace.query(countSql, Counterparams, (countErr, countResults) => {
      if (countErr) {
        console.log(countErr);
        return reject(countErr);
      }

      const total = countResults[0]?.total || 0;

      // Execute main query to get paginated results
      marketPlace.query(sql, Sqlparams, (dataErr, results) => {
        if (dataErr) {
          console.log(dataErr);
          return reject(dataErr);
        }
        console.log(results);


        resolve({ results, total });
      });
    });
  });
};

const getComplainById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = ` 
    SELECT dc.id, dc.refNo, dc.createdAt, dc.language, dc.complain,dc.complainCategory,dc.reply, u.firstName AS firstName, u.lastName AS lastName,u.phoneCode1,  u.phoneNumber1, cc.categoryEnglish AS complainCategory
    FROM dashcomplain dc
    LEFT JOIN salesagent u ON dc.saId = u.id
    LEFT JOIN agro_world_admin.complaincategory cc ON dc.complainCategory = cc.id
    WHERE dc.id = ? 
    `;
    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

const sendComplainReply = (complainId, reply) => {
  return new Promise((resolve, reject) => {
    // Input validation
    if (!complainId) {
      return reject(new Error("Complain ID is required"));
    }

    if (reply === undefined || reply === null || reply.trim() === "") {
      return reject(new Error("Reply cannot be empty"));
    }

    const sql = `
      UPDATE dashcomplain 
      SET reply = ?, status = ?, adminStatus = ?, replyTime = NOW()
      WHERE id = ?
    `;

    const status = "Closed";
    const adminStatus = "Closed";
    const values = [reply, status, adminStatus, complainId];

    marketPlace.query(sql, values, (err, results) => {
      if (err) {
        console.error("Database error details:", err);
        return reject(err);
      }

      if (results.affectedRows === 0) {
        console.warn(`No record found with id: ${complainId}`);
        return reject(new Error(`No record found with id: ${complainId}`));
      }

      console.log("Update successful:", results);
      resolve({
        message: "Reply sent successfully",
        affectedRows: results.affectedRows,
      });
    });
  });
};

const checkNICExistSaEdit = (nic, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS count 
      FROM salesagent 
      WHERE nic = ? AND id != ?
    `;

    marketPlace.query(sql, [nic, id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].count > 0); // Return true if NIC exists on a different record
    });
  });
};

const checkPhoneExistSaEdit = (phoneNumber, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS count 
      FROM salesagent 
      WHERE (phoneNumber1 = ? OR phoneNumber2 = ?) AND id != ?
    `;

    marketPlace.query(sql, [phoneNumber, phoneNumber, id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].count > 0); // Return true if phone number exists on another record
    });
  });
};


const checkEmailExistSaEdit = (email, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS count 
      FROM salesagent 
      WHERE email = ? AND id != ?
    `;

    marketPlace.query(sql, [email, id], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].count > 0); // Return true if email exists on another record
    });
  });
};

const getUserOrdersDao = async (userId, status) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT DISTINCT
        P.id,
        P.invNo,
        O.sheduleType,
        O.sheduleDate,
        P.paymentMethod,
        P.isPaid,
        O.fullTotal,
        O.isPackage
      FROM processorders P
      JOIN orders O ON P.orderId = O.id
      WHERE O.userId = ? 
    `;

    console.log(status, "-------");

    if (status === "Assinged") {
      sql += " AND P.status = 'Ordered'";
    } else if (status === "Processing") {
      sql += " AND P.status = 'Processing'";
    } else if (status === "Delivered") {
      sql += " AND P.status = 'Delivered'";
    } else if (status === "Cancelled") {
      sql += " AND P.status = 'Cancelled'";
    } else if (status === "Faild") {
      sql += " AND P.status = 'Faild'";
    } else if (status === "On the way") {
      sql += " AND P.status = 'Faild'";
    }

    marketPlace.query(sql, [userId, status], (err, results) => {
      if (err) {
        console.log("Error", err);
        reject(err);
      } else {
        resolve(results);
        console.log("``````````result``````````", results);
      }
    });
  });
};

const genarateNewSalesAgentIdDao = async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT empId 
      FROM salesagent
      ORDER BY 
        CAST(SUBSTRING(empId FROM 4) AS UNSIGNED) DESC
      LIMIT 1
    `;
    marketPlace.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length === 0) {
        return resolve("SA00001");
      }

      const highestId = results[0].empId;

      // Extract the numeric part
      const prefix = highestId.substring(0, 3);
      const numberStr = highestId.substring(3);
      const number = parseInt(numberStr, 10);

      // Increment and format back to 5 digits
      const nextNumber = number + 1;
      const nextId = `${prefix}${nextNumber.toString().padStart(4, "0")}`; // "CCM00008"

      resolve(nextId);
    });
  });
};

const createSalesTarget = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO salesagentstars (salesagentId, date, target, completed, numOfStars)
      VALUES(
        ?,
        CURDATE(),
        (
          SELECT targetValue
          FROM target
          WHERE DATE(createdAt) <= CURDATE()
          ORDER BY createdAt DESC
          LIMIT 1
        ),
        0,
        0
      )
    `;

    marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        return reject(err);
      }
      // For INSERT operations, you might want to check affectedRows instead
      resolve(results.affectedRows > 0); // Return true if the insert was successful
    });
  });
};



module.exports = {
  GetAllSalesAgentComplainDAO,
  getAllSalesCustomers,
  getAllSalesAgents,
  deleteSalesAgent,
  getForCreateId,
  checkNICExist,
  checkEmailExist,
  checkPhoneExist,
  createSalesAgent,
  getSalesAgentDataById,
  updateSalesAgentDetails,
  SendGeneratedPasswordDao,
  UpdateSalesAgentStatusAndPasswordDao,
  getSalesAgentEmailDao,
  getAllOrders,
  getComplainById,
  sendComplainReply,
  checkPhoneExistSaEdit,
  checkNICExistSaEdit,
  checkEmailExistSaEdit,
  getUserOrdersDao,
  genarateNewSalesAgentIdDao,
  createSalesTarget
};
