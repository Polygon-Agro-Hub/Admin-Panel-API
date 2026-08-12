require("dotenv").config();

// console.log("Environment Variables:");
// console.log("----------------------");
// console.log("PORT:", process.env.PORT);
// console.log("DB_HOST:", process.env.DB_HOST);
// console.log("DB_USER:", process.env.DB_USER);
// console.log("DB_PASSWORD:", process.env.DB_PASSWORD);
// console.log("DB_NAME_AD:", process.env.DB_NAME_AD);
// console.log("DB_NAME_PC:", process.env.DB_NAME_PC);
// console.log("DB_NAME_CO:", process.env.DB_NAME_CO);
// console.log("DB_NAME_MP:", process.env.DB_NAME_MP);
// console.log("DB_NAME_DS:", process.env.DB_NAME_DS);
// console.log("AUTHOR:", process.env.AUTHOR);
// console.log("MARKETPRICE:", process.env.MARKETPRICE);
// console.log("JWT_SECRET:", process.env.JWT_SECRET);
// console.log("EMAIL_USER:", process.env.EMAIL_USER);
// console.log("EMAIL_PASS:", process.env.EMAIL_PASS);
// console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID);
// console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY);
// console.log('AWS_REGION:', process.env.AWS_REGION);
// console.log('AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME);
// console.log("----------------------");

const express = require('express');
const http = require("http");
const { Server } = require("socket.io");
const { admin, plantcare, collectionofficer, marketPlace, investment, goviShop } = require('./startup/database');
const routes = require('./routes/Admin');
const collectionOfficerRoutes = require('./routes/CollectionOfficer');
const routesNewws = require('./routes/News');
const CollectionCenterRoutes = require('./routes/CollectionCenter');
const MarketPrice = require('./routes/MarketPrice');
const MarketPlace = require('./routes/MarketPlace');
const CropCalendar = require('./routes/CropCalendar');
const Permission = require('./routes/Permission');
const ComplainCategory = require('./routes/ComplainCategory');
const Stakeholder = require('./routes/stakeholder');
const SalesAgentDash = require('./routes/SalesAgentDash');
const TargetRoutes = require('./routes/Target');
const ProcumentRoutes = require('./routes/Procuments');
const DispatchRoutes = require('./routes/Dispatch');
const DistributionRoutes = require('./routes/DistributionRoutes')
const GoviLinkRoutes = require('./routes/GoviLink')
const CertificateCompanyRoutes = require('./routes/CertificateCompany')
const financeRoutes = require("./routes/finance");
const GoviShopRoutes = require("./routes/GoviShop");
const upload = require("./routes/upload.router");

const heathRoutes = require("./routes/heathRoutes");
const DashRoutes = require("./routes/Dash");

// Import the cron job function
const { pickupOrdersReturnCornjob } = require('./corn-jobs/pickupOrdersReturnCornjob');

require("dotenv").config();
const cors = require("cors");
const bodyParser = require('body-parser');

// Add base path for all routes
const BASE_PATH = "/agro-api/admin-api";

const app = express();

// const server = http.createServer(app);
// const io = new Server(server, {
//   path: `${BASE_PATH}/socket.io`,
//   cors: {
//     origin: "*",
//     methods: ["GET", "POST"]
//   }
// });

// io.on("connection", (socket) => {
//   console.log("⚡ Client connected to Socket.IO:", socket.id);

//   socket.on("join_row", (rowId) => {
//     socket.join(`row_${rowId}`);
//     console.log(`Socket ${socket.id} joined room row_${rowId}`);
//   });

//   socket.on("disconnect", () => {
//     console.log("🔌 Client disconnected from Socket.IO:", socket.id);
//   });
// });

// Attach io instance to express app
// app.set("io", io);


const port = process.env.PORT || 3000;



// Enable CORS for all routes
app.use(
  cors({
    origin: "*", // For development. Use specific origins in production
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

admin.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting to the database in index.js (admin):", err);
    return;
  }
  console.log("Connected to the MySQL database in server.js (admin).  ✅  ");
  connection.release();
});

plantcare.getConnection((err, connection) => {
  if (err) {
    console.error(
      "Error connecting to the database in index.js (plantcare):",
      err
    );
    return;
  }
  console.log(
    "Connected to the MySQL database in server.js (plantcare).  ✅  "
  );
  connection.release();
});

collectionofficer.getConnection((err, connection) => {
  if (err) {
    console.error(
      "Error connecting to the database in index.js (collectionofficer):",
      err
    );
    return;
  }
  console.log(
    "Connected to the MySQL database in server.js.(collectionofficer)  ✅  "
  );
  connection.release();
});

marketPlace.getConnection((err, connection) => {
  if (err) {
    console.error(
      "Error connecting to the database in index.js (marketPlace):",
      err
    );
    return;
  }
  console.log(
    "Connected to the MySQL database in server.js.(marketPlace)  ✅  "
  );
  connection.release();
});

investment.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting to the database in index.js (investments):", err);
    return;
  }
  console.log("Connected to the MySQL database in server.js.(investments)  ✅  ");
  connection.release();
});

goviShop.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting to the database in index.js (goviShop):", err);
    return;
  }
  console.log("Connected to the MySQL database in server.js.(goviShop)  ✅  ");
  connection.release();
});

//corn jobs
pickupOrdersReturnCornjob();




app.use("", heathRoutes);
// app.use(cors());
app.use(BASE_PATH + process.env.AUTHOR, routes);

app.use(BASE_PATH + process.env.AUTHOR, collectionOfficerRoutes);
app.use(BASE_PATH + process.env.AUTHOR, routesNewws);
app.use(BASE_PATH + process.env.AUTHOR, CollectionCenterRoutes);
app.use(BASE_PATH + process.env.MARKETPRICE, MarketPrice);
app.use(BASE_PATH + '/api/market-place', MarketPlace);
app.use(BASE_PATH + '/api/crop-calendar', CropCalendar);
app.use(BASE_PATH + '/api/permission', Permission);
app.use(BASE_PATH + '/api/complain', ComplainCategory);
app.use(BASE_PATH + '/api/stakeholder', Stakeholder);
app.use(BASE_PATH + '/api/sales-agent-dash', SalesAgentDash);
app.use(BASE_PATH + '/api/dash', DashRoutes);
app.use(BASE_PATH + '/api/target', TargetRoutes)
app.use(BASE_PATH + '/api/procument', ProcumentRoutes)
app.use(BASE_PATH + '/api/dispatch', DispatchRoutes)
app.use(BASE_PATH + '/api/distribution', DistributionRoutes)
app.use(BASE_PATH + '/api/govi-link', GoviLinkRoutes)
app.use(BASE_PATH + '/api/certificate-company', CertificateCompanyRoutes)
app.use(BASE_PATH + '/api/finance', financeRoutes)
app.use(BASE_PATH + '/api/shop', GoviShopRoutes)
app.use(BASE_PATH + '/api/upload', upload);

app.use("/uploads", express.static("uploads"));

app.get(BASE_PATH + "/test", (req, res) => {
  res.send(new Date().toLocaleString());
  console.log("test route is working");
});

// Attach io and mainApp to server instance
// server.io = io;
// server.app = app;

app.listen(port, () => {
  console.log(`⏰ Time: ${new Date().toLocaleString()}`);
  console.log(`Server running on http://localhost:${port}`);
});

module.exports = app;
