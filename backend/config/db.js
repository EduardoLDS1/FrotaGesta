const { Pool } = require('pg');
// Configure as variáveis PG* no ambiente ou use npm start com backend/.env.
module.exports = new Pool({
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'frotagesta',
    port: Number(process.env.PGPORT || 5432),
    connectionTimeoutMillis: 5000,
});
