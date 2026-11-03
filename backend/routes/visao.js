const router = require('express').Router();
const pool = require('../config/db');
const { sincronizar } = require('../lib/recorrencia');
const { data, exigir, id } = require('../lib/utils');
router.get('/dashboard', async (req,res) => {
  const [totais,atividades,alertas] = await Promise.all([
    pool.query(`SELECT (SELECT COUNT(*)::int FROM veiculos) AS veiculos,
      (SELECT COUNT(DISTINCT veiculo_id)::int FROM manutencoes WHERE excluido=FALSE AND status='Em andamento') AS em_manutencao,
      (SELECT COUNT(*)::int FROM produtos WHERE excluido=FALSE AND quantidade<=estoque_minimo) AS alertas,
      (SELECT COUNT(*)::int FROM viagens WHERE chegada_em IS NULL) AS viagens_abertas`),
    pool.query('SELECT * FROM atividades ORDER BY id DESC LIMIT 20'),
    pool.query('SELECT id,nome,modelo,quantidade,estoque_minimo FROM produtos WHERE excluido=FALSE AND quantidade<=estoque_minimo ORDER BY quantidade,nome')
  ]);
  res.json({...totais.rows[0], atividades:atividades.rows, produtos_baixos:alertas.rows});
});
router.get('/relatorios',async (req,res) => {
  const tipo=req.query.tipo || 'frota';
  exigir(['custos','estoque','movimentacoes','frota','viagens','despesas','contratos'].includes(tipo),'Tipo de relatório inválido.');
  const veiculo=req.query.veiculo_id ? id(req.query.veiculo_id) : null;
  if (tipo==='estoque') {
    const {rows}=await pool.query('SELECT id,nome,modelo,quantidade,estoque_minimo,valor_unitario,quantidade*valor_unitario AS valor_total FROM produtos WHERE excluido=FALSE ORDER BY nome');
    return res.json({tipo,linhas:rows});
  }
  const de=data(req.query.de),ate=data(req.query.ate);
  exigir(de<=ate,'A data inicial deve ser anterior ou igual à data final.');
  const params=[de,ate,veiculo];
  if(tipo==='custos') {
    const {rows}=await pool.query(`SELECT to_char(m.data,'YYYY-MM') AS mes,SUM(m.custo) AS total FROM manutencoes m
      WHERE m.excluido=FALSE AND m.data BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR m.veiculo_id=$3)
      GROUP BY to_char(m.data,'YYYY-MM') ORDER BY mes`,params);
    const detalhes=await pool.query(`SELECT m.id,m.data,v.placa,m.tipo,m.servico,m.custo,m.status FROM manutencoes m
      JOIN veiculos v ON v.id=m.veiculo_id WHERE m.excluido=FALSE AND m.data BETWEEN $1::date AND $2::date
      AND ($3::int IS NULL OR m.veiculo_id=$3) ORDER BY m.data,m.id`,params);
    return res.json({tipo,de,ate,veiculo_id:veiculo,linhas:rows,detalhes:detalhes.rows});
  }
  if(tipo==='movimentacoes') {
    const {rows}=await pool.query(`SELECT m.created_at,m.tipo,p.nome,p.modelo,m.quantidade,m.saldo_posterior,m.motivo,u.nome AS usuario
      FROM movimentacoes m JOIN produtos p ON p.id=m.produto_id JOIN usuarios u ON u.id=m.usuario_id
      WHERE (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1::date AND $2::date ORDER BY m.created_at,m.id`,[de,ate]);
    return res.json({tipo,de,ate,linhas:rows});
  }
  await sincronizar();
  if (tipo==='despesas'||tipo==='contratos') {
    const {rows}=await pool.query(`SELECT d.id,d.veiculo_id,d.data AS vencimento,d.data_pagamento,v.placa,v.modelo,
      d.categoria,d.valor,d.litros,d.viagem_id,d.descricao,d.situacao_pagamento,d.gerada_automaticamente,
      d.comprovante_nome, (d.comprovante_arquivo IS NOT NULL) AS tem_comprovante
      FROM despesas_veiculos d JOIN veiculos v ON v.id=d.veiculo_id
      WHERE (CASE WHEN d.situacao_pagamento='Pago' THEN COALESCE(d.data_pagamento,d.data) ELSE d.data END)
        BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR d.veiculo_id=$3)
        AND ($4::boolean=FALSE OR d.categoria IN ('Financiamento','Aluguel'))
      ORDER BY d.data,d.id`,[...params,tipo==='contratos']);
    return res.json({tipo,de,ate,veiculo_id:veiculo,linhas:rows});
  }
  if(tipo==='viagens') {
    const {rows}=await pool.query(`SELECT t.id,t.saida_em,t.chegada_em,v.placa,t.motorista,t.destino,t.finalidade,
      t.km_saida,t.km_chegada,(t.km_chegada-t.km_saida) AS km_percorridos,t.consumo_medio,t.preco_litro,
      CASE WHEN t.consumo_medio IS NOT NULL AND t.preco_litro IS NOT NULL
        THEN ROUND((t.km_chegada-t.km_saida)/t.consumo_medio*t.preco_litro,2) END AS custo_estimado
      FROM viagens t JOIN veiculos v ON v.id=t.veiculo_id
      WHERE t.chegada_em IS NOT NULL AND (t.chegada_em AT TIME ZONE 'America/Campo_Grande')::date
        BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR t.veiculo_id=$3)
      ORDER BY t.chegada_em,t.id`,params);
    return res.json({tipo,de,ate,veiculo_id:veiculo,linhas:rows});
  }
  const {rows}=await pool.query(`
    SELECT v.id,v.placa,v.marca,v.modelo,v.situacao_aquisicao,v.valor_compra,v.valor_entrada,
      v.valor_parcela,v.total_parcelas,v.parcelas_pagas,v.primeiro_vencimento,
      GREATEST(0,v.total_parcelas-v.parcelas_pagas)*v.valor_parcela AS saldo_financiamento_previsto,
      COALESCE(m.total,0) AS manutencoes,
      COALESCE(d.combustivel,0) AS combustivel,
      COALESCE(d.financiamento,0) AS financiamento,
      COALESCE(d.aluguel,0) AS aluguel,
      COALESCE(d.outros,0) AS outras_despesas,
      COALESCE(d.financiamento_pendente,0) AS financiamento_pendente,
      COALESCE(d.aluguel_pendente,0) AS aluguel_pendente,
      COALESCE(t.km,0) AS km_percorridos,
      COALESCE(t.estimado,0) AS combustivel_estimado,
      CASE WHEN v.data_aquisicao BETWEEN $1::date AND $2::date
        THEN CASE WHEN v.situacao_aquisicao='Quitado' THEN v.valor_compra
                  WHEN v.situacao_aquisicao='Financiado' THEN v.valor_entrada ELSE 0 END
        ELSE 0 END AS investimento_inicial,
      COALESCE(m.total,0)+COALESCE(d.combustivel,0)+COALESCE(d.financiamento,0)+
      COALESCE(d.aluguel,0)+COALESCE(d.outros,0)+
      CASE WHEN v.data_aquisicao BETWEEN $1::date AND $2::date
        THEN CASE WHEN v.situacao_aquisicao='Quitado' THEN v.valor_compra
                  WHEN v.situacao_aquisicao='Financiado' THEN v.valor_entrada ELSE 0 END ELSE 0 END AS custo_total,
      COALESCE(d.financiamento_pendente,0)+COALESCE(d.aluguel_pendente,0) AS custo_previsto,
      CASE WHEN t.km > 0 THEN ROUND((COALESCE(m.total,0)+COALESCE(d.combustivel,0)+
        COALESCE(d.financiamento,0)+COALESCE(d.aluguel,0)+COALESCE(d.outros,0)+
        CASE WHEN v.data_aquisicao BETWEEN $1::date AND $2::date
          THEN CASE WHEN v.situacao_aquisicao='Quitado' THEN v.valor_compra
                    WHEN v.situacao_aquisicao='Financiado' THEN v.valor_entrada ELSE 0 END ELSE 0 END) / t.km,2)
        ELSE NULL END AS custo_por_km
    FROM veiculos v
    LEFT JOIN LATERAL (
      SELECT SUM(custo) AS total FROM manutencoes WHERE veiculo_id=v.id AND excluido=FALSE
        AND data BETWEEN $1::date AND $2::date
    ) m ON TRUE
    LEFT JOIN LATERAL (
      SELECT SUM(valor) FILTER (WHERE categoria='Combustível' AND situacao_pagamento='Pago') AS combustivel,
        SUM(valor) FILTER (WHERE categoria='Financiamento' AND situacao_pagamento='Pago') AS financiamento,
        SUM(valor) FILTER (WHERE categoria='Aluguel' AND situacao_pagamento='Pago') AS aluguel,
        SUM(valor) FILTER (WHERE categoria NOT IN ('Combustível','Financiamento','Aluguel') AND situacao_pagamento='Pago') AS outros,
        SUM(valor) FILTER (WHERE categoria='Financiamento' AND situacao_pagamento='Pendente') AS financiamento_pendente,
        SUM(valor) FILTER (WHERE categoria='Aluguel' AND situacao_pagamento='Pendente') AS aluguel_pendente
      FROM despesas_veiculos WHERE veiculo_id=v.id AND
        (CASE WHEN situacao_pagamento='Pago' THEN COALESCE(data_pagamento,data) ELSE data END)
        BETWEEN $1::date AND $2::date
    ) d ON TRUE
    LEFT JOIN LATERAL (
      SELECT SUM(km_chegada-km_saida) AS km,
        SUM(CASE WHEN consumo_medio IS NOT NULL AND preco_litro IS NOT NULL
          THEN ROUND((km_chegada-km_saida)/consumo_medio*preco_litro,2) ELSE 0 END) AS estimado
      FROM viagens WHERE veiculo_id=v.id AND chegada_em IS NOT NULL
        AND (chegada_em AT TIME ZONE 'America/Campo_Grande')::date BETWEEN $1::date AND $2::date
    ) t ON TRUE
    WHERE ($3::int IS NULL OR v.id=$3)
    ORDER BY v.placa`,params);
  res.json({tipo,de,ate,veiculo_id:veiculo,linhas:rows,
    observacao:'O total realizado considera pagamentos confirmados e manutenções. Parcelas e aluguel pendentes aparecem separadamente como previsão. Combustível estimado não é somado ao pago.'});
});
module.exports=router;
