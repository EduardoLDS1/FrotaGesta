const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use('/veiculos', require('./routes/veiculos'));
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
    console.error(err.message);
    res.status(500).json({ erro: 'Não foi possível concluir a operação.' });
});
if (require.main === module) {
    app.listen(process.env.PORT || 5000, () => console.log('API FrotaGesta iniciada.'));
}
module.exports = app;
