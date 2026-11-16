const router = require('express').Router();
const pool = require('../config/db');
const { exigir, texto, data, id, transacao, atividade } = require('../lib/utils');
const { decimal, pagamento } = require('../lib/frota');
const validarPlaca = require('../validarPlaca');
const { administrador } = require('../lib/auth');
const CAMPOS = 'placa,marca,modelo,ano,quilometragem,combustivel,situacao_aquisicao,data_aquisicao,valor_compra,valor_entrada,valor_parcela,total_parcelas,parcelas_pagas,observacoes_financeiras,primeiro_vencimento,situacao_operacional,revisao_prevista_data,revisao_prevista_km';
function cadastro(b) {
  const placa = texto(b.placa, 7).toUpperCase();
  exigir(validarPlaca(placa), 'Use uma placa como ABC1234 ou ABC1D23.');
  const ano = b.ano ?? null;
  exigir(ano === null || (Number.isInteger(ano) && ano >= 1900 && ano <= 2100), 'Informe um ano de 1900 a 2100.');
  const combustivel = b.combustivel || 'Gasolina';
  exigir(['Gasolina','Etanol','Diesel','Flex','GNV','Elétrico','Outro'].includes(combustivel), 'Combustível inválido.');
  const situacao=b.situacao_operacional || 'Ativo';
  exigir(['Ativo','Inativo','Indisponível'].includes(situacao),'Situação operacional inválida.');
  const previsao=b.revisao_prevista_data || null;
  if(previsao) data(previsao);
  const previsaoKm=b.revisao_prevista_km === undefined || b.revisao_prevista_km === null || b.revisao_prevista_km === ''
    ? null : decimal(b.revisao_prevista_km, 'a quilometragem da revisão');
  return [placa, texto(b.marca, 100), texto(b.modelo, 100), ano,
    decimal(b.quilometragem, 'a quilometragem'), combustivel, ...pagamento(b),situacao,previsao,previsaoKm];
}
router.get('/', async (req, res) => res.json((await pool.query(`
  SELECT v.*, CASE
    WHEN EXISTS(SELECT 1 FROM manutencoes m WHERE m.veiculo_id=v.id AND m.excluido=FALSE AND m.status='Em andamento') THEN 'Em manutenção'
    WHEN EXISTS(SELECT 1 FROM viagens t WHERE t.veiculo_id=v.id AND t.chegada_em IS NULL) THEN 'Em viagem'
    WHEN v.situacao_operacional <> 'Ativo' THEN v.situacao_operacional
    ELSE 'Disponível' END AS status,
    (SELECT MAX(data) FROM manutencoes m WHERE m.veiculo_id=v.id AND m.excluido=FALSE) AS ultima_manutencao
  FROM veiculos v WHERE ($1::boolean=TRUE OR v.excluido=FALSE) ORDER BY v.id DESC
`, [req.query.historico === '1'])).rows));
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM veiculos WHERE id=$1 AND excluido=FALSE', [id(req.params.id)]);
  exigir(rows[0], 'Veículo não encontrado.', 404);
  res.json(rows[0]);
});
router.post('/', async (req, res) => {
  const dados = cadastro(req.body);
  res.status(201).json(await transacao(async (c) => {
    const { rows } = await c.query(`INSERT INTO veiculos (${CAMPOS}) VALUES (${dados.map((_, i) => '$' + (i+1)).join(',')}) RETURNING *`, dados);
    if (rows[0].primeiro_vencimento) await c.query('UPDATE veiculos SET parcela_inicio_automatica=$1 WHERE id=$2', [Number(rows[0].parcelas_pagas)+1,rows[0].id]);
    await atividade(c, req.usuario, 'Veículos', `Veículo ${rows[0].placa} cadastrado.`);
    return rows[0];
  }));
});
router.put('/:id', async (req, res) => {
  const dados = cadastro(req.body), chave = id(req.params.id);
  res.json(await transacao(async (c) => {
    const veiculo = (await c.query('SELECT * FROM veiculos WHERE id=$1 AND excluido=FALSE FOR UPDATE', [chave])).rows[0];
    exigir(veiculo, 'Veículo não encontrado.', 404);
    exigir(Number(dados[4]) >= Number(veiculo.quilometragem), 'Não é permitido diminuir o odômetro do veículo.', 409);
    const parcelasNoHistorico = (await c.query('SELECT COUNT(*)::int AS quantidade FROM despesas_veiculos WHERE veiculo_id=$1 AND parcela_contabilizada=TRUE', [chave])).rows[0].quantidade;
    exigir((dados[6] === 'Financiado' && dados[12] >= parcelasNoHistorico) || parcelasNoHistorico === 0,
      'Não altere a aquisição ou as parcelas pagas para menos do que o histórico de financiamentos registrados.', 409);
    const aberta = (await c.query('SELECT id FROM viagens WHERE veiculo_id=$1 AND chegada_em IS NULL', [chave])).rows[0];
    exigir(!aberta || Number(dados[4]) === Number(veiculo.quilometragem), 'Finalize a viagem antes de alterar a quilometragem.', 409);
    exigir(!aberta || dados[15] === 'Ativo', 'Finalize a viagem antes de inativar ou indisponibilizar o veículo.',409);
    const cobrancas = (await c.query('SELECT COUNT(*)::int AS n FROM despesas_veiculos WHERE veiculo_id=$1 AND gerada_automaticamente=TRUE', [chave])).rows[0].n;
    if (cobrancas) exigir(dados[6] === veiculo.situacao_aquisicao &&
      dados[14] === new Date(veiculo.primeiro_vencimento).toISOString().slice(0,10),
      'Existem cobranças mensais: mantenha o tipo de contrato e o primeiro vencimento. Pode alterar o valor mensal.', 409);
    const campos = CAMPOS.split(',');
    const { rows } = await c.query(`UPDATE veiculos SET ${campos.map((nome, i) => nome + '=$' + (i+1)).join(',')},updated_at=NOW() WHERE id=$${dados.length+1} RETURNING *`, [...dados, chave]);
    if (rows[0].primeiro_vencimento && !veiculo.parcela_inicio_automatica)
      await c.query('UPDATE veiculos SET parcela_inicio_automatica=$1 WHERE id=$2', [Number(rows[0].parcelas_pagas)+1,chave]);
    await atividade(c, req.usuario, 'Veículos', `Veículo ${rows[0].placa} atualizado.`);
    return rows[0];
  }));
});
router.delete('/:id', administrador, async (req, res) => {
  const chave = id(req.params.id);
  await transacao(async (c) => {
    const v = (await c.query('SELECT id,placa FROM veiculos WHERE id=$1 AND excluido=FALSE FOR UPDATE',[chave])).rows[0];
    exigir(v, 'Veículo não encontrado.', 404);
    const viagem = (await c.query('SELECT 1 FROM viagens WHERE veiculo_id=$1 AND chegada_em IS NULL LIMIT 1',[chave])).rows[0];
    exigir(!viagem, 'Finalize a viagem em andamento antes de excluir o veículo.',409);
    const manutencao = (await c.query("SELECT 1 FROM manutencoes WHERE veiculo_id=$1 AND excluido=FALSE AND status='Em andamento' LIMIT 1",[chave])).rows[0];
    exigir(!manutencao, 'Conclua a manutenção em andamento antes de excluir o veículo.',409);
    await c.query('UPDATE veiculos SET excluido=TRUE,updated_at=NOW() WHERE id=$1',[chave]);
    await atividade(c,req.usuario,'Veículos',`Veículo ${v.placa} retirado da frota; histórico preservado.`);
  });
  res.status(204).end();
});
module.exports = router;
