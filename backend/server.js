const express = require('express');
const cors = require('cors');
const carregarVariaveisDeAmbiente = require('./config/env');

carregarVariaveisDeAmbiente();

const pool = require('./config/db');
const veiculosRoutes = require('./routes/veiculos');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({
        mensagem: 'API FrotaGesta funcionando'
    });
});

app.use('/veiculos', veiculosRoutes);

if (process.env.NODE_ENV !== 'test') {
    const PORT = Number(process.env.PORT) || 5000;

    app.listen(PORT, () => {
        console.log(`Servidor FrotaGesta rodando na porta ${PORT}`);
    });

    pool.query('SELECT NOW() AS agora')
        .then(() => console.log('Conexao com PostgreSQL realizada com sucesso'))
        .catch((erro) => console.error('Erro ao conectar ao PostgreSQL:', erro.message));
}

module.exports = app;
