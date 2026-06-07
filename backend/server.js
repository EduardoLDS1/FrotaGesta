const express = require('express');
const app = express();

const pool = require('./config/db');
const veiculosRoutes = require('./routes/veiculos');

app.use('/veiculos', veiculosRoutes);

if (process.env.NODE_ENV !== 'test') {
    pool.query('SELECT NOW()')
        .then(res => console.log(res.rows))
        .catch(err => console.log(err));

    app.listen(5000, () => {
        console.log('Servidor rodando');
    });
}

module.exports = app;