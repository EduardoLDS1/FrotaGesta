const router = require('express').Router();
const pool = require('../config/db');
const path = require('node:path');
const { exigir, id, texto, dinheiro, data, transacao, atividade } = require('../lib/utils');
const { opcional } = require('../lib/frota');
const { sincronizar } = require('../lib/recorrencia');
const { receberArquivo, lerDados, salvar, apagar, abrir } = require('../lib/comprovantes');
const { administrador } = require('../lib/auth');
const { conectar, avisar } = require('../lib/eventos');
function respostaPublica(req, linha) {
  if(req.usuario.role==='admin') return linha;
  const { comprovante_arquivo, comprovante_nome, comprovante_mime, ...dados } = linha;
  return dados;
}
const categorias = ['Combustível','Manutenção','Peças','Pedágio','Estacionamento','Seguro','IPVA',
  'Licenciamento','Financiamento','Lavagem','Multa','Aluguel','Outros'];
router.get('/eventos', conectar);
router.get('/',async (req,res) => {
  await sincronizar();
  const filtros=[],args=[];
  if(req.query.veiculo_id) {args.push(id(req.query.veiculo_id)); filtros.push(`d.veiculo_id=$${args.length}`);}
  if(req.query.categoria) {exigir(categorias.includes(req.query.categoria),'Categoria inválida.');args.push(req.query.categoria);filtros.push(`d.categoria=$${args.length}`);}
  const {rows}=await pool.query(`SELECT d.*,v.placa,v.modelo FROM despesas_veiculos d JOIN veiculos v ON v.id=d.veiculo_id
    ${filtros.length?'WHERE '+filtros.join(' AND '):''} ORDER BY d.data DESC,d.id DESC`,args);
  if(req.usuario.role!=='admin') for(const d of rows){delete d.comprovante_arquivo;delete d.comprovante_nome;delete d.comprovante_mime;}
  res.json(rows);
});
router.post('/',receberArquivo,async (req,res) => {
  const b=lerDados(req), chave=id(b.veiculo_id),categoria=b.categoria,dia=data(b.data),
    valor=dinheiro(b.valor),litros=opcional(b.litros,'a quantidade de litros',{min:0.001,max:9999999.999,casas:3}),
    viagem=b.viagem_id?id(b.viagem_id):null,descricao=texto(b.descricao||'',500,false);
  exigir(categorias.includes(categoria),'Categoria de despesa inválida.');
  exigir(Number(valor)>0,'Valor da despesa deve ser maior que zero.');
  exigir(categoria==='Combustível'||litros===null,'Litros só se aplicam a combustível.');
  const comprovante=await salvar(req);
  try {
    const resultado=await transacao(async c => {
      const v=(await c.query('SELECT * FROM veiculos WHERE id=$1 AND excluido=FALSE FOR UPDATE',[chave])).rows[0];
      exigir(v,'Veículo não encontrado ou excluído.',404);
      if(viagem){const t=(await c.query('SELECT veiculo_id FROM viagens WHERE id=$1',[viagem])).rows[0];
        exigir(t&&Number(t.veiculo_id)===chave,'Viagem não pertence ao veículo.',409);}
      const parcela=categoria==='Financiamento';
      if(parcela){
        exigir(v.situacao_aquisicao==='Financiado','Veículo não financiado.',409);
        exigir(!v.primeiro_vencimento,'Confirme a cobrança automática existente, evitando duplicação.',409);
        exigir(v.parcelas_pagas<v.total_parcelas,'Todas as parcelas estão pagas.',409);
      }
      if(categoria==='Aluguel') exigir(v.situacao_aquisicao!=='Locado'||!v.primeiro_vencimento,
        'Confirme a mensalidade automática existente.',409);
      const {rows}=await c.query(`INSERT INTO despesas_veiculos
        (veiculo_id,viagem_id,data,categoria,valor,litros,descricao,parcela_contabilizada,situacao_pagamento,
         data_pagamento,comprovante_arquivo,comprovante_nome,comprovante_mime)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Pago',$3,$9,$10,$11) RETURNING *`,
        [chave,viagem,dia,categoria,valor,litros,descricao,parcela,
         comprovante.comprovante_arquivo,comprovante.comprovante_nome,comprovante.comprovante_mime]);
      if(parcela) await c.query('UPDATE veiculos SET parcelas_pagas=parcelas_pagas+1,updated_at=NOW() WHERE id=$1',[chave]);
      await atividade(c,req.usuario,'Despesas',`${categoria} de R$ ${valor} pago para ${v.placa}.`);
      return rows[0];
    });
    avisar();res.status(201).json(respostaPublica(req,resultado));
  }catch(e){await apagar(comprovante.comprovante_arquivo);throw e;}
});
router.put('/:id/pagar',receberArquivo,async (req,res) => {
  const b=lerDados(req),chave=id(req.params.id),dia=data(b.data_pagamento),valor=dinheiro(b.valor);
  exigir(Number(valor)>0,'Pagamento deve ser maior que zero.');
  const comprovante=await salvar(req);
  try {
    const resultado=await transacao(async c => {
      const info=(await c.query('SELECT veiculo_id FROM despesas_veiculos WHERE id=$1',[chave])).rows[0];
      exigir(info,'Despesa não encontrada.',404);
      const v=(await c.query('SELECT * FROM veiculos WHERE id=$1 FOR UPDATE',[info.veiculo_id])).rows[0];
      const d=(await c.query('SELECT * FROM despesas_veiculos WHERE id=$1 FOR UPDATE',[chave])).rows[0];
      exigir(d.situacao_pagamento==='Pendente','Somente cobranças pendentes podem ser pagas.',409);
      const parcela=d.categoria==='Financiamento';
      if(parcela) exigir(Number(v.parcelas_pagas)<Number(v.total_parcelas),'Todas as parcelas constam como pagas.',409);
      const {rows}=await c.query(`UPDATE despesas_veiculos SET valor=$1,situacao_pagamento='Pago',data_pagamento=$2,
        parcela_contabilizada=$3,comprovante_arquivo=$4,comprovante_nome=$5,comprovante_mime=$6
        WHERE id=$7 RETURNING *`,[valor,dia,parcela,comprovante.comprovante_arquivo,
          comprovante.comprovante_nome,comprovante.comprovante_mime,chave]);
      if(parcela) await c.query('UPDATE veiculos SET parcelas_pagas=parcelas_pagas+1,updated_at=NOW() WHERE id=$1',[v.id]);
      await atividade(c,req.usuario,'Despesas',`Pagamento de ${d.categoria} confirmado para ${v.placa}.`);
      return rows[0];
    });
    avisar();res.json(respostaPublica(req,resultado));
  }catch(e){await apagar(comprovante.comprovante_arquivo);throw e;}
});
router.post('/:id/comprovante',administrador,receberArquivo,async (req,res)=>{
  const chave=id(req.params.id), comprovante=await salvar(req);
  let antigo=null;
  try {
    const resultado=await transacao(async c => {
      const d=(await c.query('SELECT * FROM despesas_veiculos WHERE id=$1 FOR UPDATE',[chave])).rows[0];
      exigir(d,'Despesa não encontrada.',404);
      antigo=d.comprovante_arquivo;
      const {rows}=await c.query('UPDATE despesas_veiculos SET comprovante_arquivo=$1,comprovante_nome=$2,comprovante_mime=$3 WHERE id=$4 RETURNING id',
        [comprovante.comprovante_arquivo,comprovante.comprovante_nome,comprovante.comprovante_mime,chave]);
      await atividade(c,req.usuario,'Despesas',`Comprovante anexado à despesa ${chave}.`);
      return rows[0];
    });
    await apagar(antigo);avisar();res.status(201).json(respostaPublica(req,resultado));
  } catch(e){await apagar(comprovante.comprovante_arquivo);throw e;}
});
router.get('/:id/comprovante',administrador,async (req,res) => {
  const chave=id(req.params.id);
  const {rows}=await pool.query('SELECT comprovante_arquivo,comprovante_mime FROM despesas_veiculos WHERE id=$1',[chave]);
  exigir(rows[0]?.comprovante_arquivo,'Comprovante não encontrado.',404);
  try {
    const bytes=await abrir(rows[0].comprovante_arquivo);
    res.setHeader('Content-Type',rows[0].comprovante_mime);
    res.setHeader('Content-Disposition',`inline; filename="comprovante${path.extname(rows[0].comprovante_arquivo)}"`);
    res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
    res.send(bytes);
  } catch(e) {
    if(e.code==='ENOENT') return res.status(404).json({erro:'Comprovante não está disponível no servidor.'});
    throw e;
  }
});
router.delete('/:id',administrador,async (req,res) => {
  const chave=id(req.params.id);
  let arquivo;
  await transacao(async c => {
    const info=(await c.query('SELECT veiculo_id FROM despesas_veiculos WHERE id=$1',[chave])).rows[0];
    exigir(info,'Despesa não encontrada.',404);
    await c.query('SELECT id FROM veiculos WHERE id=$1 FOR UPDATE',[info.veiculo_id]);
    const d=(await c.query('SELECT * FROM despesas_veiculos WHERE id=$1 FOR UPDATE',[chave])).rows[0];
    exigir(d,'Despesa não encontrada.',404);
    exigir(!d.gerada_automaticamente,'Cobrança recorrente só pode ser ajustada pelo contrato.',409);
    exigir(!d.origem_viagem,'Gasto da viagem não pode ser excluído isoladamente.',409);
    arquivo=d.comprovante_arquivo;
    await c.query('DELETE FROM despesas_veiculos WHERE id=$1',[chave]);
    if(d.parcela_contabilizada) await c.query('UPDATE veiculos SET parcelas_pagas=GREATEST(parcelas_pagas-1,0) WHERE id=$1',[d.veiculo_id]);
    await atividade(c,req.usuario,'Despesas',`Despesa ${chave} excluída.`);
  });
  await apagar(arquivo);avisar();res.status(204).end();
});
module.exports=router;
