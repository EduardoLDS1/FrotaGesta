const router = require('express').Router();
const pool = require('../config/db');
const { exigir, texto, id, dinheiro, transacao, atividade } = require('../lib/utils');
const { decimal } = require('../lib/frota');
const { receberArquivo, lerDados, salvar, apagar } = require('../lib/comprovantes');
const { avisar } = require('../lib/eventos');
const COLUNAS = `t.id,t.veiculo_id,t.motorista,t.destino,t.finalidade,t.km_saida,t.km_chegada,
  t.saida_em,t.chegada_em,t.valor_combustivel,t.observacoes,v.placa,v.modelo,
  CASE WHEN t.km_chegada IS NOT NULL THEN t.km_chegada-t.km_saida END AS km_percorridos`;
router.get('/', async (req,res) => {
  const { rows } = await pool.query(`SELECT ${COLUNAS} FROM viagens t JOIN veiculos v ON v.id=t.veiculo_id
    ORDER BY t.saida_em DESC,t.id DESC LIMIT 1000`);
  res.json(rows);
});
router.post('/',async (req,res) => {
  const b=req.body, chave=id(b.veiculo_id),motorista=texto(b.motorista || 'Não informado',120),
    destino=texto(b.destino || 'Não informado',180),finalidade=texto(b.finalidade || '',300,false);
  res.status(201).json(await transacao(async c => {
    const v=(await c.query('SELECT * FROM veiculos WHERE id=$1 AND excluido=FALSE FOR UPDATE',[chave])).rows[0];
    exigir(v,'Veículo não encontrado ou excluído.',404);
    exigir(v.situacao_operacional === 'Ativo','Veículo inativo ou indisponível não pode iniciar viagem.',409);
    const ultimo=(await c.query('SELECT km_chegada FROM viagens WHERE veiculo_id=$1 AND chegada_em IS NOT NULL ORDER BY chegada_em DESC,id DESC LIMIT 1',[chave])).rows[0];
    const base=Math.max(Number(ultimo?.km_chegada ?? 0),Number(v.quilometragem));
    const km=b.km_saida === undefined || b.km_saida === '' ? base : decimal(b.km_saida,'a quilometragem inicial');
    exigir(km>=base,'A quilometragem inicial não pode ser menor que o último odômetro registrado.',409);
    exigir(!(await c.query('SELECT 1 FROM viagens WHERE veiculo_id=$1 AND chegada_em IS NULL',[chave])).rows.length,'Veículo já está em viagem.',409);
    exigir(!(await c.query("SELECT 1 FROM manutencoes WHERE veiculo_id=$1 AND excluido=FALSE AND status='Em andamento'",[chave])).rows.length,'Veículo em manutenção não pode iniciar viagem.',409);
    const {rows}=await c.query('INSERT INTO viagens(veiculo_id,motorista,destino,finalidade,km_saida) VALUES($1,$2,$3,$4,$5) RETURNING *',[chave,motorista,destino,finalidade,km]);
    await c.query('UPDATE veiculos SET quilometragem=$1,updated_at=NOW() WHERE id=$2',[km,chave]);
    await atividade(c,req.usuario,'Viagens',`Iniciada viagem ${rows[0].id} com ${v.placa}: ${km} km.`);
    return rows[0];
  }));
});
router.put('/:id/finalizar',receberArquivo,async (req,res) => {
  const b=lerDados(req),chave=id(req.params.id),km=decimal(b.km_chegada,'a quilometragem final'),
    valor=dinheiro(b.valor_combustivel),observacoes=texto(b.observacoes||'',500,false);
  exigir(Number(valor)>=0,'Informe o gasto com combustível em reais.');
  const comprovante=Number(valor)>0 ? await salvar(req) : null;
  try {
    const resultado=await transacao(async c => {
      const info=(await c.query('SELECT veiculo_id FROM viagens WHERE id=$1',[chave])).rows[0];
      exigir(info,'Viagem não encontrada.',404);
      const v=(await c.query('SELECT * FROM veiculos WHERE id=$1 FOR UPDATE',[info.veiculo_id])).rows[0];
      const t=(await c.query('SELECT * FROM viagens WHERE id=$1 FOR UPDATE',[chave])).rows[0];
      exigir(!t.chegada_em,'Esta viagem já está finalizada.',409);
      exigir(km>=Number(t.km_saida) && km>=Number(v.quilometragem),'KM final menor que o odômetro registrado.',409);
      const {rows}=await c.query(`UPDATE viagens SET km_chegada=$1,chegada_em=NOW(),observacoes=$2,
        valor_combustivel=$3,consumo_medio=NULL,preco_litro=NULL WHERE id=$4 RETURNING *`,[km,observacoes,valor,chave]);
      await c.query('UPDATE veiculos SET quilometragem=$1,updated_at=NOW() WHERE id=$2',[km,t.veiculo_id]);
      if(Number(valor)>0) {
        await c.query(`INSERT INTO despesas_veiculos
          (veiculo_id,viagem_id,data,categoria,valor,descricao,situacao_pagamento,data_pagamento,
           origem_viagem,comprovante_arquivo,comprovante_nome,comprovante_mime)
          VALUES($1,$2,CURRENT_DATE,'Combustível',$3,$4,'Pago',CURRENT_DATE,TRUE,$5,$6,$7)`,
          [t.veiculo_id,chave,valor,`Combustível da viagem ${chave} · ${t.destino}`,
           comprovante.comprovante_arquivo,comprovante.comprovante_nome,comprovante.comprovante_mime]);
      }
      await atividade(c,req.usuario,'Viagens',`Finalizada viagem ${chave}, ${km-Number(t.km_saida)} km, combustível R$ ${valor}.`);
      return rows[0];
    });
    avisar();
    res.json(resultado);
  } catch(e) { await apagar(comprovante?.comprovante_arquivo); throw e; }
});
module.exports=router;
