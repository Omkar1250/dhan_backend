const mysql = require('mysql2/promise');
require('dotenv').config();


// myapp → only RM & Admin
const myapp = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: "myapp",  // default DB
});

// dhanDB → all other tables
const dhanDB = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: "dhanDB",
});

module.exports = { myapp, dhanDB };
