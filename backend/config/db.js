const { Pool } = require("pg");
module.exports = new Pool({
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST || "localhost",
  database: process.env.PGDATABASE || "frotagesta",
  port: Number(process.env.PGPORT || 5432),
  connectionTimeoutMillis: 5000,
});
