const router = require('express').Router();
const pool = require('../config/db');
const { sincronizar } = require('../lib/recorrencia');
const { administrador } = require('../lib/auth');
const { data, exigir, id } = require('../lib/utils');
router.get('/dashboard', async (req,res) => {
  const [totais,atividades,alertas,revisoes] = await Promise.all([
    pool.query(`SELECT (SELECT COUNT(*)::int FROM veiculos WHERE excluido=FALSE) AS veiculos,
      (SELECT COUNT(DISTINCT m.veiculo_id)::int FROM manutencoes m JOIN veiculos v ON v.id=m.veiculo_id
        WHERE m.excluido=FALSE AND m.status='Em andamento' AND v.excluido=FALSE) AS em_manutencao,
      (SELECT COUNT(*)::int FROM produtos WHERE excluido=FALSE AND quantidade<=estoque_minimo) AS alertas,
      (SELECT COUNT(*)::int FROM viagens WHERE chegada_em IS NULL) AS viagens_abertas,
      (SELECT COUNT(*)::int FROM veiculos WHERE excluido=FALSE AND
        (revisao_prevista_data<=CURRENT_DATE OR revisao_prevista_km<=quilometragem)) AS revisoes_pendentes`),
    pool.query('SELECT * FROM atividades ORDER BY id DESC LIMIT 20'),
    pool.query('SELECT id,nome,modelo,quantidade,estoque_minimo FROM produtos WHERE excluido=FALSE AND quantidade<=estoque_minimo ORDER BY quantidade,nome'),
    pool.query(`SELECT id,placa,modelo,quilometragem,revisao_prevista_data,revisao_prevista_km FROM veiculos WHERE excluido=FALSE AND
      (revisao_prevista_data<=CURRENT_DATE OR revisao_prevista_km<=quilometragem) ORDER BY placa`)
  ]);
  res.json({...totais.rows[0], atividades:atividades.rows, produtos_baixos:alertas.rows,revisoes_pendentes_lista:revisoes.rows});
});
router.get('/relatorios', administrador, async (req,res) => {
  const tipo=req.query.tipo||'frota';
  exigir(['custos','estoque','movimentacoes','frota','viagens','despesas','contratos','consolidado'].includes(tipo),'Relatório inválido.');
  const veiculo=req.query.veiculo_id?id(req.query.veiculo_id):null;
  if(tipo==='estoque') {
    const {rows}=await pool.query('SELECT id,nome,modelo,codigo,categoria,fornecedor,quantidade,estoque_minimo,valor_unitario,quantidade*valor_unitario AS valor_total FROM produtos WHERE excluido=FALSE ORDER BY nome');
    return res.json({tipo,linhas:rows});
  }
  const de=data(req.query.de),ate=data(req.query.ate);
  exigir(de<=ate,'A data inicial deve ser anterior ou igual à final.');
  const params=[de,ate,veiculo];
  if(tipo==='custos') {
    const {rows}=await pool.query(`SELECT to_char(m.data,'YYYY-MM') AS mes,SUM(CASE WHEN m.custo_inclui_pecas THEN m.custo ELSE m.custo+COALESCE((SELECT SUM(i.quantidade*i.valor_unitario) FROM manutencao_itens i WHERE i.manutencao_id=m.id),0) END) AS total
      FROM manutencoes m WHERE m.excluido=FALSE AND m.data BETWEEN $1::date AND $2::date
      AND ($3::int IS NULL OR m.veiculo_id=$3) GROUP BY to_char(m.data,'YYYY-MM') ORDER BY mes`,params);
    const detalhes=(await pool.query(`SELECT m.id,m.data,v.placa,m.tipo,m.servico,m.custo,m.status,COALESCE((SELECT SUM(i.quantidade*i.valor_unitario) FROM manutencao_itens i WHERE i.manutencao_id=m.id),0) AS custo_pecas
      FROM manutencoes m JOIN veiculos v ON v.id=m.veiculo_id WHERE m.excluido=FALSE
      AND m.data BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR m.veiculo_id=$3)
      ORDER BY m.data,m.id`,params)).rows;
    return res.json({tipo,de,ate,linhas:rows,detalhes,observacao:'Custos operacionais registrados nas manutenções. Confira os pagamentos comprovados no relatório financeiro.'});
  }
  if(tipo==='movimentacoes') {
    const {rows}=await pool.query(`SELECT m.created_at,m.tipo,p.nome,p.modelo,m.quantidade,m.saldo_posterior,m.motivo,u.nome AS usuario
      FROM movimentacoes m JOIN produtos p ON p.id=m.produto_id JOIN usuarios u ON u.id=m.usuario_id
      WHERE (m.created_at AT TIME ZONE 'America/Campo_Grande')::date BETWEEN $1::date AND $2::date
      ORDER BY m.created_at,m.id`,[de,ate]);
    return res.json({tipo,de,ate,linhas:rows});
  }
  await sincronizar();
  if(tipo==='despesas'||tipo==='contratos') {
    const {rows}=await pool.query(`SELECT d.id,d.veiculo_id,d.data AS vencimento,d.data_pagamento,v.placa,v.modelo,
      d.categoria,d.valor,d.litros,d.viagem_id,d.descricao,d.situacao_pagamento,d.gerada_automaticamente,
      ${req.usuario.role==='admin'?"d.comprovante_nome, (d.comprovante_arquivo IS NOT NULL) AS tem_comprovante":"NULL::text AS comprovante_nome, FALSE AS tem_comprovante"}
      FROM despesas_veiculos d JOIN veiculos v ON v.id=d.veiculo_id
      WHERE (CASE WHEN d.situacao_pagamento='Pago' THEN COALESCE(d.data_pagamento,d.data) ELSE d.data END)
      BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR d.veiculo_id=$3)
      AND ($4::boolean=FALSE OR d.categoria IN ('Financiamento','Aluguel')) ORDER BY d.data,d.id`,[...params,tipo==='contratos']);
    return res.json({tipo,de,ate,veiculo_id:veiculo,linhas:rows});
  }
  if(tipo==='viagens') {
    const {rows}=await pool.query(`SELECT t.id,t.saida_em,t.chegada_em,v.placa,t.motorista,t.destino,t.finalidade,
      t.km_saida,t.km_chegada,(t.km_chegada-t.km_saida) AS km_percorridos,t.valor_combustivel
      FROM viagens t JOIN veiculos v ON v.id=t.veiculo_id
      WHERE t.chegada_em IS NOT NULL AND (t.chegada_em AT TIME ZONE 'America/Campo_Grande')::date
      BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR t.veiculo_id=$3)
      ORDER BY t.chegada_em,t.id`,params);
    return res.json({tipo,de,ate,linhas:rows});
  }
  if(tipo==='consolidado') {
    const periodicidade=req.query.periodicidade||'mensal';
    exigir(['semanal','mensal','anual'].includes(periodicidade),'Periodicidade inválida.');
    const unidade={semanal:'week',mensal:'month',anual:'year'}[periodicidade];
    const {rows}=await pool.query(`SELECT to_char(date_trunc('${unidade}',COALESCE(d.data_pagamento,d.data)::timestamp),'YYYY-MM-DD') AS periodo_inicio,
      v.id AS veiculo_id,v.placa,v.modelo,d.categoria,COUNT(*)::int AS lancamentos,SUM(d.valor) AS total
      FROM despesas_veiculos d JOIN veiculos v ON v.id=d.veiculo_id WHERE d.situacao_pagamento='Pago'
      AND COALESCE(d.data_pagamento,d.data) BETWEEN $1::date AND $2::date
      AND ($3::int IS NULL OR d.veiculo_id=$3)
      GROUP BY periodo_inicio,v.id,v.placa,v.modelo,d.categoria
      ORDER BY periodo_inicio,v.placa,d.categoria`,params);
    return res.json({tipo,de,ate,periodicidade,veiculo_id:veiculo,linhas:rows,
      total_geral:rows.reduce((n,r)=>n+Number(r.total),0)});
  }
  const {rows}=await pool.query(`
    SELECT v.id,v.placa,v.marca,v.modelo,v.situacao_aquisicao,v.excluido,v.valor_compra,v.valor_entrada,
      v.valor_parcela,v.total_parcelas,v.parcelas_pagas,
      GREATEST(0,v.total_parcelas-v.parcelas_pagas)*v.valor_parcela AS saldo_financiamento_previsto,
      COALESCE(m.total,0) AS manutencoes,
      COALESCE(d.combustivel,0) AS combustivel,COALESCE(d.manutencao,0) AS manutencao_despesas,
      COALESCE(d.pecas,0) AS pecas,COALESCE(d.financiamento,0) AS financiamento,
      COALESCE(d.aluguel,0) AS aluguel,COALESCE(d.outros,0) AS outras_despesas,
      COALESCE(d.financiamento_pendente,0) AS financiamento_pendente,
      COALESCE(d.aluguel_pendente,0) AS aluguel_pendente,
      COALESCE(d.total_pago,0) AS custo_total,
      COALESCE(d.financiamento_pendente,0)+COALESCE(d.aluguel_pendente,0) AS custo_previsto,
      COALESCE(t.km,0) AS km_percorridos,
      CASE WHEN v.data_aquisicao BETWEEN $1::date AND $2::date
        THEN CASE WHEN v.situacao_aquisicao='Quitado' THEN v.valor_compra
                  WHEN v.situacao_aquisicao='Financiado' THEN v.valor_entrada ELSE 0 END ELSE 0 END AS investimento_inicial,
      CASE WHEN t.km > 0 THEN ROUND(COALESCE(d.total_pago,0)/t.km,2) ELSE NULL END AS custo_por_km
    FROM veiculos v
    LEFT JOIN LATERAL (SELECT SUM(CASE WHEN custo_inclui_pecas THEN custo ELSE custo+COALESCE((SELECT SUM(i.quantidade*i.valor_unitario) FROM manutencao_itens i WHERE i.manutencao_id=manutencoes.id),0) END) AS total FROM manutencoes WHERE veiculo_id=v.id AND excluido=FALSE
      AND data BETWEEN $1::date AND $2::date) m ON TRUE
    LEFT JOIN LATERAL (SELECT
      SUM(valor) FILTER (WHERE categoria='Combustível' AND situacao_pagamento='Pago') AS combustivel,
      SUM(valor) FILTER (WHERE categoria='Manutenção' AND situacao_pagamento='Pago') AS manutencao,
      SUM(valor) FILTER (WHERE categoria='Peças' AND situacao_pagamento='Pago') AS pecas,
      SUM(valor) FILTER (WHERE categoria='Financiamento' AND situacao_pagamento='Pago') AS financiamento,
      SUM(valor) FILTER (WHERE categoria='Aluguel' AND situacao_pagamento='Pago') AS aluguel,
      SUM(valor) FILTER (WHERE categoria NOT IN ('Combustível','Manutenção','Peças','Financiamento','Aluguel') AND situacao_pagamento='Pago') AS outros,
      SUM(valor) FILTER (WHERE categoria='Financiamento' AND situacao_pagamento='Pendente') AS financiamento_pendente,
      SUM(valor) FILTER (WHERE categoria='Aluguel' AND situacao_pagamento='Pendente') AS aluguel_pendente,
      SUM(valor) FILTER (WHERE situacao_pagamento='Pago') AS total_pago
      FROM despesas_veiculos WHERE veiculo_id=v.id AND
      (CASE WHEN situacao_pagamento='Pago' THEN COALESCE(data_pagamento,data) ELSE data END)
      BETWEEN $1::date AND $2::date) d ON TRUE
    LEFT JOIN LATERAL (SELECT SUM(km_chegada-km_saida) AS km FROM viagens
      WHERE veiculo_id=v.id AND chegada_em IS NOT NULL
      AND (chegada_em AT TIME ZONE 'America/Campo_Grande')::date BETWEEN $1::date AND $2::date) t ON TRUE
    WHERE ($3::int IS NULL OR v.id=$3) ORDER BY v.placa`,params);
  res.json({tipo,de,ate,linhas:rows,observacao:
    'Total realizado = despesas marcadas como pagas (inclui lançamentos antigos sem comprovante). Custos operacionais de manutenção e valores de aquisição declarados aparecem separadamente, evitando dupla contagem. Cobranças pendentes não entram no total.'});
});
module.exports=router;
