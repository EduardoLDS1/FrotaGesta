const router = require('express').Router();
const pool = require('../config/db');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { exigir, id, texto, dinheiro, data, transacao, atividade } = require('../lib/utils');
const { opcional } = require('../lib/frota');
const { sincronizar } = require('../lib/recorrencia');
const categorias = ['Combustível','Pedágio','Estacionamento','Seguro','IPVA','Licenciamento','Financiamento','Lavagem','Multa','Aluguel','Outros'];
const pasta = path.join(__dirname, '../uploads/comprovantes');

router.get('/', async (req,res) => {
  await sincronizar();
  res.json((await pool.query('SELECT d.*,v.placa,v.modelo FROM despesas_veiculos d JOIN veiculos v ON v.id=d.veiculo_id ORDER BY d.data DESC,d.id DESC LIMIT 2000')).rows);
});
router.post('/', async (req,res) => {
  const b = req.body, chave = id(b.veiculo_id), categoria = b.categoria,
    dia = data(b.data), valor = dinheiro(b.valor),
    litros = opcional(b.litros, 'a quantidade de litros', { min: 0.001, max: 9999999.999, casas: 3 }),
    viagem = b.viagem_id ? id(b.viagem_id) : null,
    descricao = texto(b.descricao || '', 500, false);
  exigir(categorias.includes(categoria), 'Categoria de despesa inválida.');
  exigir(Number(valor) > 0, 'O valor da despesa deve ser maior que zero.');
  exigir(categoria === 'Combustível' || litros === null, 'Litros só podem ser usados em abastecimentos.');
  res.status(201).json(await transacao(async (c) => {
    const v = (await c.query('SELECT placa,situacao_aquisicao,total_parcelas,parcelas_pagas,primeiro_vencimento FROM veiculos WHERE id=$1 FOR UPDATE', [chave])).rows[0];
    exigir(v, 'Veículo não encontrado.', 404);
    if (viagem) {
      const t = (await c.query('SELECT veiculo_id FROM viagens WHERE id=$1', [viagem])).rows[0];
      exigir(t && t.veiculo_id === chave, 'A viagem escolhida não pertence ao veículo.', 409);
    }
    const parcela = categoria === 'Financiamento';
    if (parcela) {
      exigir(v.situacao_aquisicao === 'Financiado', 'O veículo precisa estar financiado.', 409);
      exigir(!v.primeiro_vencimento, 'Este veículo possui parcelas automáticas. Confirme o pagamento na lista de despesas para evitar duplicidade.', 409);
      exigir(v.parcelas_pagas < v.total_parcelas, 'Todas as parcelas já estão pagas.', 409);
    }
    if (categoria === 'Aluguel') exigir(v.situacao_aquisicao !== 'Locado' || !v.primeiro_vencimento,
      'Este veículo já possui mensalidades automáticas. Confirme a mensalidade na lista.', 409);
    const { rows } = await c.query(`INSERT INTO despesas_veiculos
      (veiculo_id,viagem_id,data,categoria,valor,litros,descricao,parcela_contabilizada,situacao_pagamento,data_pagamento)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pago',$3) RETURNING *`, [chave,viagem,dia,categoria,valor,litros,descricao,parcela]);
    if (parcela) await c.query('UPDATE veiculos SET parcelas_pagas=parcelas_pagas+1,updated_at=NOW() WHERE id=$1', [chave]);
    await atividade(c, req.usuario, 'Despesas', `${categoria} de R$ ${valor} registrado para ${v.placa}.`);
    return rows[0];
  }));
});

router.put('/:id/pagar', async (req,res) => {
  const chave=id(req.params.id), pagoEm=data(req.body.data_pagamento), valor=dinheiro(req.body.valor);
  exigir(Number(valor)>0,'O pagamento deve ser maior que zero.');
  res.json(await transacao(async c => {
    const info=(await c.query('SELECT veiculo_id FROM despesas_veiculos WHERE id=$1',[chave])).rows[0];
    exigir(info,'Despesa não encontrada.',404);
    const v=(await c.query('SELECT * FROM veiculos WHERE id=$1 FOR UPDATE',[info.veiculo_id])).rows[0];
    const d=(await c.query('SELECT * FROM despesas_veiculos WHERE id=$1 FOR UPDATE',[chave])).rows[0];
    exigir(d.situacao_pagamento==='Pendente','Somente cobranças pendentes podem ser confirmadas.',409);
    const parcela=d.categoria==='Financiamento';
    if(parcela) exigir(Number(v.parcelas_pagas)<Number(v.total_parcelas),'Todas as parcelas já constam como pagas.',409);
    const resultado=(await c.query(`UPDATE despesas_veiculos SET valor=$1,situacao_pagamento='Pago',data_pagamento=$2,
      parcela_contabilizada=$3 WHERE id=$4 RETURNING *`,[valor,pagoEm,parcela,chave])).rows[0];
    if(parcela) await c.query('UPDATE veiculos SET parcelas_pagas=parcelas_pagas+1,updated_at=NOW() WHERE id=$1',[v.id]);
    await atividade(c, req.usuario,'Despesas',`Pagamento de ${d.categoria} confirmado para ${v.placa}.`);
    return resultado;
  }));
});

function mimeValido(bytes) {
  if(bytes.length>=5 && bytes.subarray(0,5).toString('ascii')==='%PDF-') return ['application/pdf','.pdf'];
  if(bytes.length>=8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return ['image/png','.png'];
  if(bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return ['image/jpeg','.jpg'];
  if(bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP') return ['image/webp','.webp'];
  return null;
}
router.post('/:id/comprovante', require('express').raw({type:()=>true,limit:'5mb'}), async (req,res) => {
  const chave=id(req.params.id), conteudo=req.body;
  exigir(Buffer.isBuffer(conteudo) && conteudo.length>0,'Selecione um comprovante PDF, JPG, PNG ou WEBP.');
  const tipo=mimeValido(conteudo);
  exigir(tipo,'Arquivo inválido. Envie PDF, JPG, PNG ou WEBP.');
  let decodificado;
  try { decodificado=decodeURIComponent(req.header('x-nome-arquivo') || 'comprovante'); }
  catch(e) { exigir(false,'Nome do arquivo inválido.'); }
  const nome=texto(decodificado,200);
  const novo=randomUUID()+tipo[1];
  await fs.mkdir(pasta,{recursive:true});
  await fs.writeFile(path.join(pasta,novo),conteudo,{flag:'wx'});
  let antigo=null;
  try {
    const atualizado=await transacao(async c => {
      const atual=(await c.query('SELECT * FROM despesas_veiculos WHERE id=$1 FOR UPDATE',[chave])).rows[0];
      exigir(atual,'Despesa não encontrada.',404);
      antigo=atual.comprovante_arquivo;
      const r=(await c.query('UPDATE despesas_veiculos SET comprovante_arquivo=$1,comprovante_nome=$2,comprovante_mime=$3 WHERE id=$4 RETURNING id,comprovante_nome',
        [novo,nome,tipo[0],chave])).rows[0];
      await atividade(c,req.usuario,'Despesas',`Comprovante anexado à despesa ${chave}.`);
      return r;
    });
    if(antigo) await fs.unlink(path.join(pasta,antigo)).catch(()=>{});
    res.status(201).json(atualizado);
  } catch(e) {await fs.unlink(path.join(pasta,novo)).catch(()=>{});throw e;}
});
router.get('/:id/comprovante', async (req,res) => {
  const chave=id(req.params.id);
  const {rows}=await pool.query('SELECT comprovante_arquivo,comprovante_mime,comprovante_nome FROM despesas_veiculos WHERE id=$1',[chave]);
  exigir(rows[0]?.comprovante_arquivo,'Comprovante não encontrado.',404);
  const r=rows[0];
  try {
    const bytes=await fs.readFile(path.join(pasta,r.comprovante_arquivo));
    res.setHeader('Content-Type',r.comprovante_mime);
    res.setHeader('Content-Disposition',`inline; filename="comprovante${path.extname(r.comprovante_arquivo)}"`);
    res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
    res.send(bytes);
  } catch(e) {if(e.code==='ENOENT') return res.status(404).json({erro:'Arquivo não encontrado no servidor. Restaure a pasta uploads do backup.'});throw e;}
});
router.delete('/:id', async (req,res) => {
  const chave=id(req.params.id);
  let arquivo;
  await transacao(async c => {
    const existente=(await c.query('SELECT veiculo_id FROM despesas_veiculos WHERE id=$1',[chave])).rows[0];
    exigir(existente,'Despesa não encontrada.',404);
    await c.query('SELECT id FROM veiculos WHERE id=$1 FOR UPDATE',[existente.veiculo_id]);
    const {rows}=await c.query('DELETE FROM despesas_veiculos WHERE id=$1 RETURNING categoria,veiculo_id,parcela_contabilizada,comprovante_arquivo,gerada_automaticamente',[chave]);
    exigir(rows[0],'Despesa não encontrada.',404);
    exigir(!rows[0].gerada_automaticamente,'Cobrança automática não pode ser excluída; ajuste o contrato.',409);
    arquivo=rows[0].comprovante_arquivo;
    if(rows[0].parcela_contabilizada) await c.query('UPDATE veiculos SET parcelas_pagas=GREATEST(parcelas_pagas-1,0),updated_at=NOW() WHERE id=$1',[rows[0].veiculo_id]);
    await atividade(c,req.usuario,'Despesas',`Despesa ${chave} excluída.`);
  });
  if(arquivo) await fs.unlink(path.join(pasta,arquivo)).catch(()=>{});
  res.status(204).end();
});
module.exports = router;
