const {
  admin,
  plantcare,
  collectionofficer,
  marketPlace,
} = require("../startup/database");
const { Upload } = require("@aws-sdk/lib-storage");
const Joi = require("joi");
const PDFDocument = require("pdfkit");
const path = require("path");
const nodemailer = require("nodemailer");

exports.getAdminUsersByPosition = () => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT p.positions AS positionName, COUNT(a.id) AS adminUserCount
            FROM adminusers a
            JOIN adminposition p ON a.position = p.id
            GROUP BY p.positions
          `;
    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);
      const formattedResult = results.reduce((acc, item) => {
        acc[item.positionName] = item;
        return acc;
      }, {});
      // console.log('formatterResult-->', formattedResult);
      resolve(formattedResult); // Resolve the promise with the query results
    });
  });
};

exports.getNewAdminUsers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
              SELECT COUNT(*) AS newAdminUserCount FROM adminusers WHERE DATE(created_at) = CURDATE();

            `;
    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results); // Resolve the promise with the query results
    });
  });
};

//not use
exports.getAllAdminUsers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS TotalAdminUserCount FROM adminusers;
            `;
    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.getCollectionOfficersByPosition = () => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT 
                CASE 
                   WHEN jobRole = 'Collection Centre Head' AND companyId = '1' AND status = 'Approved' THEN 'CCH'
                    WHEN jobRole = 'Collection Centre Manager' AND companyId = '1' AND status = 'Approved' THEN 'CCM'
                    WHEN jobRole = 'Collection Officer' AND companyId = '1' AND status = 'Approved' THEN 'COO'
                    WHEN jobRole = 'Customer Officer' AND companyId = '1' AND status = 'Approved' THEN 'CUO'
                END AS job,
                COUNT(id) AS officerCount
            FROM collectionofficer
            GROUP BY job;

            `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result--->', results);
      const formattedResult = results.reduce((acc, item) => {
        acc[item.job] = item;
        return acc;
      }, {});

      resolve(formattedResult); // Resolve the promise with the query results
    });
  });
};

exports.getNewCollectionOfficers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
              SELECT COUNT(*) AS count FROM collectionofficer WHERE DATE(createdAt) = CURDATE() AND companyId = '1' AND status = 'Approved';

            `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result collectionofficer count', results[0]);

      resolve(results[0].count); // Resolve the promise with the query results
    });
  });
};

//not usefull
exports.getAllCollectionOfficers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS totalOfficerCount FROM collectionofficer;
            `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      console.log("result", results);

      resolve(results); // Resolve the promise with the query results
    });
  });
};

exports.getActiveCollectionOfficers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS activeOfficerCount FROM collectionofficer WHERE  companyId = '1' AND status = 'Approved';
            `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results[0].activeOfficerCount); // Resolve the promise with the query results
    });
  });
};

exports.getPlantCareUserByQrRegistration = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        CASE 
            WHEN farmerQr IS NOT NULL AND farmerQr <> '' THEN 'QrCode'
            ELSE 'notQrCode'
        END AS qrStatus,
        COUNT(*) AS count
      FROM users
      GROUP BY qrStatus;
            `;
    plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);
      const formattedResult = results.reduce((acc, item) => {
        acc[item.qrStatus] = item;
        return acc;
      }, {});
      // console.log('formatterResult-->', formattedResult);

      resolve(formattedResult); // Resolve the promise with the query results
    });
  });
};

exports.getNewPlantCareUsers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
         SELECT COUNT(*) AS newPlantCareUserCount FROM users WHERE DATE(created_at) = CURDATE()

            `;
    plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results[0].newPlantCareUserCount); // Resolve the promise with the query results
    });
  });
};

exports.getActivePlantCareUsers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS activePlantCareUserCount FROM users WHERE activeStatus = 'active'
            `;
    plantcare.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results[0].activePlantCareUserCount); // Resolve the promise with the query results
    });
  });
};

exports.getActiveSalesAgents = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS activeSalesAgents FROM salesagent WHERE status = 'active'
            `;
    marketPlace.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results[0]); // Resolve the promise with the query results
    });
  });
};

exports.getNewSalesAgents = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS newSalesAgents FROM salesagent WHERE DATE(createdAt) = CURDATE() 

            `;
    marketPlace.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results[0]); // Resolve the promise with the query results
    });
  });
};

exports.getAllSalesAgents = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS totalSaleAgents FROM salesagent
    `;
    marketPlace.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('result', results);

      resolve(results[0]); // Resolve the promise with the query results
    });
  });
};

exports.getTodayRegAdmin = () => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT COUNT(*) AS todayCount
            FROM adminusers
            WHERE DATE(created_at) = CURDATE() 
          `;
    admin.query(sql, (err, results) => {
      if (err) {
        return reject(err); // Reject promise if an error occurs
      }
      // console.log('Today ->', results);

      resolve(results[0]); // Resolve the promise with the query results
    });
  });
};

// Get all field officers with filters
exports.getAllFieldOfficers = (filters = {}) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT * 
      FROM plant_care.feildofficer
      WHERE 1=1
    `;

    const params = [];

    // Apply filters
    if (filters.status && filters.status !== "") {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }

    if (filters.district && filters.district !== "") {
      sql += ` AND distrct = ?`;
      params.push(filters.district);
    }

    if (filters.role && filters.role !== "") {
      sql += ` AND JobRole = ?`;
      params.push(filters.role);
    }

    if (filters.language && filters.language !== "") {
      sql += ` AND language LIKE ?`;
      params.push(`%${filters.language}%`);
    }

    if (filters.search && filters.search !== "") {
      sql += ` AND (empId LIKE ? OR nic LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    sql += ` ORDER BY createdAt DESC`;

    console.log("SQL Query:", sql);
    console.log("Query Parameters:", params);

    admin.query(sql, params, (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return reject(err);
      }
      console.log("Results found:", results.length);
      resolve(results);
    });
  });
};

// Get officer email & name by ID
exports.getFieldOfficerEmailDao = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT f.email, f.firstName, f.empId
      FROM plant_care.feildofficer f
      WHERE f.id = ?
    `;
    plantcare.query(sql, [id], (err, results) => {
      if (err) return reject(err);
      if (results.length > 0) {
        resolve({
          email: results[0].email,
          firstName: results[0].firstName,
          empId: results[0].empId,
        });
      } else {
        resolve(null);
      }
    });
  });
};

// Update status and password
exports.UpdateFieldOfficerStatusAndPasswordDao = (params) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE plant_care.feildofficer
      SET status = ?, password = ?, passwordUpdated = 0
      WHERE id = ?
    `;
    plantcare.query(
      sql,
      [params.status, params.password, parseInt(params.id)],
      (err, results) => {
        if (err) return reject(err);
        resolve(results);
      }
    );
  });
};

// Send generated password email with attached PDF
exports.SendGeneratedPasswordDao = async (
  email,
  password,
  empId,
  firstName
) => {
  try {
    const doc = new PDFDocument();
    const pdfBuffer = [];
    doc.on("data", pdfBuffer.push.bind(pdfBuffer));
    doc.on("end", () => {});

    // Watermark background
    const watermarkPath = path.resolve(__dirname, "../assets/bg.png");
    doc.opacity(0.2).image(watermarkPath, 100, 300, { width: 400 }).opacity(1);

    // Title
    doc
      .fontSize(20)
      .fillColor("#071a51")
      .text("Welcome to PolygonAgro (Pvt) Ltd - Registration Confirmation", {
        align: "center",
      });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Body content
    doc.fontSize(12).text(`Dear ${firstName},`);
    doc.moveDown();
    doc
      .text(
        "Thank you for registering with us! We are excited to have you onboard."
      )
      .moveDown()
      .text(
        "You have successfully created an account with PolygonAgro (Pvt) Ltd. Our platform provides agricultural support, guidance, and digital tools to help you grow and succeed.",
        { align: "justify" }
      )
      .moveDown()
      .text(`Your User Name/ID: ${empId}`)
      .text(`Your Password: ${password}`)
      .moveDown()
      .text(
        "If you need assistance, please reach out to our support team at polygonagro.inf@gmail.com",
        { align: "justify" }
      )
      .moveDown()
      .text("Best Regards,")
      .text("The PolygonAgro Team")
      .text("PolygonAgro (Pvt) Ltd. | All rights reserved.")
      .moveDown()
      .text("Address: No:14, Sir Baron Jayathilake Mawatha, Colombo 01.")
      .text("Email: polygonagro.inf@gmail.com");

    doc.end();
    await new Promise((resolve) => doc.on("end", resolve));
    const pdfData = Buffer.concat(pdfBuffer);

    // Mail transport
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        family: 4,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to PolygonAgro (Pvt) Ltd - Registration Confirmation",
      text: `Dear ${firstName},\n\nYour registration details are attached in the PDF.`,
      attachments: [
        {
          filename: `password_${empId}.pdf`,
          content: pdfData,
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

// Get Distribution Officers by Position
exports.getDistributionOfficersByPosition = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        CASE 
          WHEN jobRole = 'Distribution Centre Head' AND companyId = '2' AND status = 'Approved' THEN 'DCH'
          WHEN jobRole = 'Distribution Centre Manager' AND companyId = '2' AND status = 'Approved' THEN 'DCM'
          WHEN jobRole = 'Distribution Officer' AND companyId = '2' AND status = 'Approved' THEN 'DOO'
        END AS job,
        COUNT(id) AS officerCount
      FROM collectionofficer
      WHERE jobRole IN ('Distribution Centre Head', 'Distribution Centre Manager', 'Distribution Officer')
      GROUP BY job;
    `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      const formattedResult = results.reduce((acc, item) => {
        acc[item.job] = item;
        return acc;
      }, {});
      resolve(formattedResult);
    });
  });
};

// Get New Distribution Officers (registered today)
exports.getNewDistributionOfficers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS count 
      FROM collectionofficer 
      WHERE DATE(createdAt) = CURDATE() 
        AND companyId = '2' 
        AND status = 'Approved'
        AND jobRole IN ('Distribution Centre Head', 'Distribution Centre Manager', 'Distribution Officer');
    `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].count);
    });
  });
};

// Get Active Distribution Officers
exports.getActiveDistributionOfficers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS activeOfficerCount 
      FROM collectionofficer 
      WHERE companyId = '2' 
        AND status = 'Approved'
        AND jobRole IN ('Distribution Centre Head', 'Distribution Centre Manager', 'Distribution Officer');
    `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].activeOfficerCount);
    });
  });
};

// Get Total Distribution Officers (all statuses)
exports.getTotalDistributionOfficers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT COUNT(*) AS totalOfficerCount 
      FROM collectionofficer 
      WHERE jobRole IN ('Distribution Centre Head', 'Distribution Centre Manager', 'Distribution Officer');
    `;
    collectionofficer.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].totalOfficerCount);
    });
  });
};
