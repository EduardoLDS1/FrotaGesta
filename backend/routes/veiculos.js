const router = require('express').Router();
const pool = require('../config/db');
const validarPlaca = require('../validarPlaca');

function validar(body) {
    const { placa, marca, modelo, ano, quilometragem } = body || {};
    const erros = {};
    const normalizada = typeof placa === 'string' ? placa.trim().toUpperCase() : '';
    if (!validarPlaca(normalizada)) erros.placa = 'Use uma placa como ABC1234 ou ABC1D23.';
    for (const [campo, valor] of Object.entries({ marca, modelo })) {
        if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > 100)
            erros[campo] = 'Informe de 1 a 100 caracteres.';
    }
    if (ano !== null && ano !== undefined && (!Number.isInteger(ano) || ano < 1900 || ano > 2100))
        erros.ano = 'Informe um ano inteiro entre 1900 e 2100.';
    if (typeof quilometragem !== 'number' || !Number.isFinite(quilometragem) || quilometragem < 0 || quilometragem > 9999999999.99 || Math.abs(quilometragem * 100 - Math.round(quilometragem * 100)) > 0.001)
        erros.quilometragem = 'Informe uma quilometragem válida, positiva ou zero, com até duas casas decimais.';
    return { erros, dados: [normalizada, typeof marca === 'string' ? marca.trim() : '', typeof modelo === 'string' ? modelo.trim() : '', ano ?? null, quilometragem] };
}
function falha(err, res) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Já existe um veículo com essa placa.', campos: { placa: 'Essa placa já está cadastrada.' } });
    if (err.code === '23503') return res.status(409).json({ erro: 'Este veículo possui registros vinculados e não pode ser excluído.' });
    console.error('Falha na operação de veículos:', err.code || err.message);
    return res.status(500).json({ erro: 'Não foi possível acessar os veículos. Verifique a conexão e a configuração do banco.' });
}
router.param('id', (req, res, next, id) => {
    if (!/^[1-9][0-9]*$/.test(id) || Number(id) > 2147483647) return res.status(400).json({ erro: 'ID inválido.' });
    next();
});
router.get('/', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM veiculos ORDER BY id DESC')).rows); }
    catch (err) { falha(err, res); }
});
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM veiculos WHERE id = $1', [req.params.id]);
        return rows[0] ? res.json(rows[0]) : res.status(404).json({ erro: 'Veículo não encontrado.' });
    } catch (err) { falha(err, res); }
});
router.post('/', async (req, res) => {
    const { erros, dados } = validar(req.body);
    if (Object.keys(erros).length) return res.status(400).json({ erro: 'Revise os campos informados.', campos: erros });
    try {
        const { rows } = await pool.query('INSERT INTO veiculos (placa, marca, modelo, ano, quilometragem) VALUES ($1,$2,$3,$4,$5) RETURNING *', dados);
        res.status(201).json(rows[0]);
    } catch (err) { falha(err, res); }
});
router.put('/:id', async (req, res) => {
    const { erros, dados } = validar(req.body);
    if (Object.keys(erros).length) return res.status(400).json({ erro: 'Revise os campos informados.', campos: erros });
    try {
        const { rows } = await pool.query('UPDATE veiculos SET placa=$1, marca=$2, modelo=$3, ano=$4, quilometragem=$5, updated_at=NOW() WHERE id=$6 RETURNING *', [...dados, req.params.id]);
        return rows[0] ? res.json(rows[0]) : res.status(404).json({ erro: 'Veículo não encontrado.' });
    } catch (err) { falha(err, res); }
});
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await pool.query('DELETE FROM veiculos WHERE id=$1', [req.params.id]);
        return rowCount ? res.status(204).end() : res.status(404).json({ erro: 'Veículo não encontrado.' });
    } catch (err) { falha(err, res); }
});
module.exports = router;
