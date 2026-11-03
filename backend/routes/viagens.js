const router = require('express').Router();
const pool = require('../config/db');
const { exigir, texto, id, transacao, atividade } = require('../lib/utils');
const { decimal, opcional } = require('../lib/frota');
const COLUNAS = `t.*,v.placa,v.modelo, CASE WHEN t.km_chegada IS NOT NULL THEN t.km_chegada-t.km_saida END AS km_percorridos,
 CASE WHEN t.km_chegada IS NOT NULL AND t.consumo_medio IS NOT NULL AND t.preco_litro IS NOT NULL
 THEN ROUND((t.km_chegada-t.km_saida)/t.consumo_medio*t.preco_litro,2) END AS custo_estimado`;
router.get('/', async (req, res) => res.json((await pool.query(`SELECT ${COLUNAS} FROM viagens t JOIN veiculos v ON v.id=t.veiculo_id ORDER BY t.saida_em DESC,t.id DESC LIMIT 500`)).rows));
router.post('/', async (req, res) => {
  const b = req.body, chave = id(b.veiculo_id), km = decimal(b.km_saida, 'a quilometragem de saída');
  const motorista = texto(b.motorista, 120), destino = texto(b.destino, 180), finalidade = texto(b.finalidade || '', 300, false);
  res.status(201).json(await transacao(async (c) => {
    const v = (await c.query('SELECT * FROM veiculos WHERE id=$1 FOR UPDATE', [chave])).rows[0];
    exigir(v, 'Veículo não encontrado.', 404);
    exigir(km >= Number(v.quilometragem), 'O odômetro da saída não pode ser menor que o último registrado.', 409);
    exigir(!(await c.query('SELECT 1 FROM viagens WHERE veiculo_id=$1 AND chegada_em IS NULL', [chave])).rows.length, 'Este veículo já tem uma viagem aberta.', 409);
    exigir(!(await c.query("SELECT 1 FROM manutencoes WHERE veiculo_id=$1 AND excluido=FALSE AND status='Em andamento'", [chave])).rows.length, 'Veículo em manutenção não pode iniciar viagem.', 409);
    const r = await c.query('INSERT INTO viagens(veiculo_id,motorista,destino,finalidade,km_saida) VALUES($1,$2,$3,$4,$5) RETURNING *', [chave,motorista,destino,finalidade,km]);
    await c.query('UPDATE veiculos SET quilometragem=$1,updated_at=NOW() WHERE id=$2', [km,chave]);
    await atividade(c, req.usuario, 'Viagens', `Saída ${r.rows[0].id} iniciada para ${v.placa}.`);
    return r.rows[0];
  }));
});
router.put('/:id/finalizar', async (req, res) => {
  const chave = id(req.params.id), km = decimal(req.body.km_chegada, 'a quilometragem de chegada');
  const observacoes = texto(req.body.observacoes || '', 500, false);
  res.json(await transacao(async (c) => {
    const encontrado = (await c.query('SELECT veiculo_id FROM viagens WHERE id=$1', [chave])).rows[0];
    exigir(encontrado, 'Viagem não encontrada.', 404);
    const v = (await c.query('SELECT * FROM veiculos WHERE id=$1 FOR UPDATE', [encontrado.veiculo_id])).rows[0];
    const t = (await c.query('SELECT * FROM viagens WHERE id=$1 FOR UPDATE', [chave])).rows[0];
    exigir(!t.chegada_em, 'Viagem já finalizada.', 409);
    exigir(km >= Number(t.km_saida) && km >= Number(v.quilometragem), 'Quilometragem final menor que a inicial ou que o odômetro atual.', 409);
    const consumo = opcional(req.body.consumo_medio,'a média em km/l',{min:0.001,max:9999.999,casas:3});
    const preco = opcional(req.body.preco_litro,'o preço do litro',{min:0.01,max:99999999.99});
    exigir(v.combustivel === 'Elétrico' || (consumo !== null && preco !== null),
      'Informe consumo médio (km/l) e preço por litro ao finalizar.', 400);
    const r = await c.query('UPDATE viagens SET km_chegada=$1,chegada_em=NOW(),observacoes=$2,consumo_medio=$4,preco_litro=$5 WHERE id=$3 RETURNING *', [km,observacoes,chave,consumo,preco]);
    await c.query('UPDATE veiculos SET quilometragem=$1,updated_at=NOW() WHERE id=$2', [km,t.veiculo_id]);
    await atividade(c, req.usuario, 'Viagens', `Retorno da viagem ${chave} registrado: ${Number(km-Number(t.km_saida)).toFixed(2)} km (${v.placa}).`);
    return r.rows[0];
  }));
});
module.exports = router;
