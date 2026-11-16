const assert=require('node:assert/strict');
const request=require('supertest');
const {preparar}=require('./banco-teste.cjs');
(async()=>{
  const {db,pool}=await preparar();
  let n=0;const ok=(cond,msg)=>{assert.ok(cond,msg);console.log(`OK financeiro ${++n}: ${msg}`);};
  const pdf=Buffer.from('%PDF-1.7\nrecibo financeiro\n');
  function pagar(a,id,dados,comArquivo=true){return a.put(`/despesas/${id}/pagar`)
    .set('Content-Type','application/octet-stream')
    .set('X-Dados',encodeURIComponent(JSON.stringify(dados)))
    .set('X-Nome-Arquivo','quitacao.pdf').send(comArquivo?pdf:Buffer.alloc(0));}
  try{
    const {hashSenha}=require('../lib/seguranca');const app=require('../server');
    await pool.query(`INSERT INTO usuarios(nome,email,login,senha_hash,perfil)
      VALUES('Admin','admin@teste.local','admin',$1,'Administrador')`,[await hashSenha('Teste12345')]);
    const a=request.agent(app);
    ok((await a.post('/auth/login').send({acesso:'admin',senha:'Teste12345'})).status===200,'login');
    const financiado=await a.post('/veiculos').send({placa:'ABC1D23',marca:'Ford',modelo:'Ka',quilometragem:1000,
      situacao_aquisicao:'Financiado',data_aquisicao:'2026-01-01',valor_compra:30000,
      valor_entrada:5000,valor_parcela:750,total_parcelas:24,parcelas_pagas:0,primeiro_vencimento:'2026-10-10'});
    ok(financiado.status===201,'contrato de financiamento');
    const f=financiado.body.id;
    const listagem=(await a.get('/despesas')).body;
    const parcela=listagem.find(d=>d.veiculo_id===f&&d.categoria==='Financiamento');
    ok(parcela&&parcela.situacao_pagamento==='Pendente','gera mensalidade pendente automaticamente');
    ok((await a.get('/despesas')).body.filter(d=>d.id===parcela.id).length===1,'não duplica a mensalidade');
    ok((await pagar(a,parcela.id,{valor:750,data_pagamento:'2026-10-10'},false)).status===400,
      'pagamento não pode ser confirmado sem comprovante');
    const pagamento=await pagar(a,parcela.id,{valor:755,data_pagamento:'2026-10-10'});
    ok(pagamento.status===200&&Number(pagamento.body.valor)===755,'confirma valor efetivamente pago');
    ok(Number((await a.get('/veiculos')).body[0].parcelas_pagas)===1,'incrementa parcelas pagas');
    const relatorio=await a.get(`/relatorios?tipo=contratos&de=2026-10-01&ate=2026-10-31&veiculo_id=${f}`);
    ok(relatorio.status===200&&relatorio.body.linhas.some(d=>d.tem_comprovante),'comprovante aparece no relatório admin');
    const consolidado=await a.get(`/relatorios?tipo=consolidado&periodicidade=mensal&de=2026-10-01&ate=2026-10-31&veiculo_id=${f}`);
    ok(Number(consolidado.body.total_geral)===755,'mensal financeiro considera apenas pagamento realizado');
    const locado=await a.post('/veiculos').send({placa:'LOC1A23',marca:'Fiat',modelo:'Mobi',quilometragem:50,
      situacao_aquisicao:'Locado',valor_parcela:1200,primeiro_vencimento:'2026-10-10'});
    ok(locado.status===201,'contrato de locação');
    const loc=(await a.get('/despesas')).body.find(d=>d.veiculo_id===locado.body.id);
    ok(loc&&loc.situacao_pagamento==='Pendente','mensalidade locada pendente');
    ok((await pagar(a,loc.id,{valor:1200,data_pagamento:'2026-10-10'})).status===200,'locação paga com comprovante');
    const frotas=await a.get('/relatorios?tipo=frota&de=2026-10-01&ate=2026-10-31');
    ok(frotas.status===200&&frotas.body.linhas.some(v=>v.placa==='LOC1A23'&&Number(v.aluguel)===1200),
      'frota contabiliza locação realizada');
    console.log(`${n} verificações financeiras aprovadas.`);
  }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
