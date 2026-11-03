const pool = require('../config/db');
function adicionarMeses(dataISO, quantidade) {
  const [ano, mes, dia] = String(dataISO).slice(0,10).split('-').map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + quantidade, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth()+1, 0)).getUTCDate();
  return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(dia,ultimo)).padStart(2,'0')}`;
}
const hojeISO = () => new Date().toLocaleDateString('sv-SE', {timeZone:'America/Campo_Grande'});
async function sincronizar(c = pool) {
  const veiculos = (await c.query(`SELECT id, situacao_aquisicao, valor_parcela, total_parcelas,
      primeiro_vencimento, parcela_inicio_automatica FROM veiculos
      WHERE situacao_aquisicao IN ('Financiado','Locado') AND valor_parcela > 0
        AND primeiro_vencimento IS NOT NULL`)).rows;
  const hoje = hojeISO();
  for (const v of veiculos) {
    const categoria = v.situacao_aquisicao === 'Financiado' ? 'Financiamento' : 'Aluguel';
    const inicio = Number(v.parcela_inicio_automatica || 1);
    const limite = categoria === 'Financiamento' ? Math.max(0,Number(v.total_parcelas)-inicio+1) : 240;
    const primeira = new Date(v.primeiro_vencimento).toISOString().slice(0,10);
    for (let i=0;i<limite;i++) {
      const vencimento = adicionarMeses(primeira, i);
      if (vencimento > hoje) break;
      await c.query(`INSERT INTO despesas_veiculos
        (veiculo_id,data,categoria,valor,descricao,situacao_pagamento,gerada_automaticamente,recorrencia_indice)
        VALUES ($1,$2,$3,$4,$5,'Pendente',TRUE,$6)
        ON CONFLICT DO NOTHING`, [v.id,vencimento,categoria,v.valor_parcela,
        `${categoria} mensal automático ${categoria==='Financiamento'?'— parcela '+(inicio+i):'— mensalidade '+(i+1)}`,inicio+i]);
    }
    await c.query(`UPDATE despesas_veiculos SET valor=$2
      WHERE veiculo_id=$1 AND categoria=$3 AND gerada_automaticamente=TRUE AND situacao_pagamento='Pendente'`,
      [v.id,v.valor_parcela,categoria]);
  }
}
module.exports = { sincronizar, adicionarMeses };
