const express = require('express');
const pool = require('../config/db');
const validarPlaca = require('../validarPlaca');

const router = express.Router();

function normalizarPlaca(placa) {
    return String(placa)
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
}

function validarId(id) {
    return /^\d+$/.test(String(id)) && Number(id) > 0;
}

// GET /veiculos
router.get('/', async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT * FROM veiculos ORDER BY id ASC'
        );

        return res.status(200).json(resultado.rows);
    } catch (erro) {
        console.error('Erro ao listar veiculos:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao listar veiculos'
        });
    }
});

// GET /veiculos/:id
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    if (!validarId(id)) {
        return res.status(400).json({
            mensagem: 'ID de veiculo invalido'
        });
    }

    try {
        const resultado = await pool.query(
            'SELECT * FROM veiculos WHERE id = $1',
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensagem: 'Veiculo nao encontrado'
            });
        }

        return res.status(200).json(resultado.rows[0]);
    } catch (erro) {
        console.error('Erro ao buscar veiculo:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao buscar veiculo'
        });
    }
});

// POST /veiculos
router.post('/', async (req, res) => {
    let {
        placa,
        marca,
        modelo,
        ano,
        quilometragem
    } = req.body;

    if (!placa || !marca || !modelo) {
        return res.status(400).json({
            mensagem: 'Placa, marca e modelo sao obrigatorios'
        });
    }

    placa = normalizarPlaca(placa);

    if (!validarPlaca(placa)) {
        return res.status(400).json({
            mensagem: 'Placa invalida'
        });
    }

    const anoNumero =
        ano === undefined || ano === null || ano === ''
            ? null
            : Number(ano);

    const quilometragemNumero =
        quilometragem === undefined ||
        quilometragem === null ||
        quilometragem === ''
            ? 0
            : Number(quilometragem);

    if (
        anoNumero !== null &&
        (!Number.isInteger(anoNumero) ||
            anoNumero < 1900 ||
            anoNumero > 2100)
    ) {
        return res.status(400).json({
            mensagem: 'Ano invalido'
        });
    }

    if (
        !Number.isFinite(quilometragemNumero) ||
        quilometragemNumero < 0
    ) {
        return res.status(400).json({
            mensagem: 'Quilometragem invalida'
        });
    }

    try {
        const resultado = await pool.query(
            `INSERT INTO veiculos
            (placa, marca, modelo, ano, quilometragem)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [
                placa,
                String(marca).trim(),
                String(modelo).trim(),
                anoNumero,
                quilometragemNumero
            ]
        );

        return res.status(201).json({
            mensagem: 'Veiculo cadastrado com sucesso',
            veiculo: resultado.rows[0]
        });
    } catch (erro) {
        if (erro.code === '23505') {
            return res.status(409).json({
                mensagem: 'Ja existe um veiculo com essa placa'
            });
        }

        console.error('Erro ao cadastrar veiculo:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao cadastrar veiculo'
        });
    }
});

// PUT /veiculos/:id
router.put('/:id', async (req, res) => {
    const { id } = req.params;

    let {
        placa,
        marca,
        modelo,
        ano,
        quilometragem
    } = req.body;

    if (!validarId(id)) {
        return res.status(400).json({
            mensagem: 'ID de veiculo invalido'
        });
    }

    if (!placa || !marca || !modelo) {
        return res.status(400).json({
            mensagem: 'Placa, marca e modelo sao obrigatorios'
        });
    }

    placa = normalizarPlaca(placa);

    if (!validarPlaca(placa)) {
        return res.status(400).json({
            mensagem: 'Placa invalida'
        });
    }

    const anoNumero =
        ano === undefined || ano === null || ano === ''
            ? null
            : Number(ano);

    const quilometragemNumero =
        quilometragem === undefined ||
        quilometragem === null ||
        quilometragem === ''
            ? 0
            : Number(quilometragem);

    if (
        anoNumero !== null &&
        (!Number.isInteger(anoNumero) ||
            anoNumero < 1900 ||
            anoNumero > 2100)
    ) {
        return res.status(400).json({
            mensagem: 'Ano invalido'
        });
    }

    if (
        !Number.isFinite(quilometragemNumero) ||
        quilometragemNumero < 0
    ) {
        return res.status(400).json({
            mensagem: 'Quilometragem invalida'
        });
    }

    try {
        const resultado = await pool.query(
            `UPDATE veiculos
             SET placa = $1,
                 marca = $2,
                 modelo = $3,
                 ano = $4,
                 quilometragem = $5
             WHERE id = $6
             RETURNING *`,
            [
                placa,
                String(marca).trim(),
                String(modelo).trim(),
                anoNumero,
                quilometragemNumero,
                id
            ]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensagem: 'Veiculo nao encontrado'
            });
        }

        return res.status(200).json({
            mensagem: 'Veiculo atualizado com sucesso',
            veiculo: resultado.rows[0]
        });
    } catch (erro) {
        if (erro.code === '23505') {
            return res.status(409).json({
                mensagem: 'Ja existe um veiculo com essa placa'
            });
        }

        console.error('Erro ao atualizar veiculo:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao atualizar veiculo'
        });
    }
});

// DELETE /veiculos/:id
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (!validarId(id)) {
        return res.status(400).json({
            mensagem: 'ID de veiculo invalido'
        });
    }

    try {
        const resultado = await pool.query(
            'DELETE FROM veiculos WHERE id = $1 RETURNING *',
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensagem: 'Veiculo nao encontrado'
            });
        }

        return res.status(200).json({
            mensagem: 'Veiculo excluido com sucesso',
            veiculo: resultado.rows[0]
        });
    } catch (erro) {
        console.error('Erro ao excluir veiculo:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao excluir veiculo'
        });
    }
});

module.exports = router;