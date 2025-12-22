const mysql = require('mysql2');
require('dotenv').config();

// NOTE: For serverless environments, keep connectionLimit low to avoid exhausting DB connections due to multiple cold starts.
// Consider using a DB proxy or serverless-optimized library for production workloads.

const admin = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME_AD,
  port: process.env.DB_PORT,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 5,
  maxIdle: 6, 
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay : 0,
});

const plantcare = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME_PC,
  port: process.env.DB_PORT,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 5,
  maxIdle: 6, 
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay : 0,
});


const collectionofficer = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME_CO,
  port: process.env.DB_PORT,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 5,
  maxIdle: 6, 
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay : 0,
});

const marketPlace = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME_MP,
  port: process.env.DB_PORT,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 5,
  maxIdle: 6, 
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay : 0,
});


const investment = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME_INV,
  port: process.env.DB_PORT,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 5,
  maxIdle: 6, 
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay : 0,
});


module.exports = {admin, plantcare, collectionofficer, marketPlace, investment};