// config/db.js

const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    password: '123',
    host: 'localhost',
    database: 'frotagesta',
    port: 5432
});

module.exports = pool;