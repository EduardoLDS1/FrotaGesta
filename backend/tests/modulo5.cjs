const assert = require('node:assert/strict');
const request = require('supertest');
const { preparar } = require('./banco-teste.cjs');
(async()=>{
  const { db, pool } = await preparar();
  let n=0;
  const ok=(cond,msg)=>{assert.ok(cond,msg);console.log(`OK módulo 5 ${++n}: ${msg}`);};
  try{
    const { hashSenha, resumo } = require('../lib/seguranca');
    const app=require('../server');
    await pool.query("INSERT INTO usuarios(nome,email,login,senha_hash,recuperacao_hash,perfil) VALUES('Administrador','admin@teste.local','admin',$1,$2,'Administrador')",[await hashSenha('Teste12345'),resumo('abc')]);
    const agente=request.agent(app);
    ok((await agente.post('/auth/login').send({acesso:'admin',senha:'Teste12345'})).status===200,'login autenticado');
    const corpo={placa:'FRT1A23',marca:'Fiat',modelo:'Uno',ano:2023,quilometragem:1000,
      combustivel:'Gasolina',consumo_medio:10,preco_litro:6,
      situacao_aquisicao:'Financiado',data_aquisicao:'2026-10-02',valor_compra:30000,
      valor_entrada:5000,valor_parcela:800,total_parcelas:36,parcelas_pagas:2};
    let r=await agente.post('/veiculos').send(corpo);
    ok(r.status===201 && r.body.situacao_aquisicao==='Financiado','financiamento do veículo cadastrado');
    const v=r.body.id;
    r=await agente.post('/viagens').send({veiculo_id:v,motorista:'Maria',destino:'Campo Grande',km_saida:1000,finalidade:'Entrega'});
    ok(r.status===201 && r.body.consumo_medio===null,'viagem iniciada sem exigir média ou preço');
    const viagem=r.body.id;
    ok((await agente.get('/veiculos')).body[0].status==='Em viagem','veículo fica em viagem');
    ok((await agente.post('/viagens').send({veiculo_id:v,motorista:'Outro',destino:'Cidade',km_saida:1000})).status===409,'não permite viagem duplicada');
    ok((await agente.put(`/viagens/${viagem}/finalizar`).send({km_chegada:999})).status===409,'recusa odômetro regressivo no retorno');
    ok((await agente.put(`/viagens/${viagem}/finalizar`).send({km_chegada:1200,consumo_medio:10,preco_litro:6})).status===200,'retorno atualiza odômetro');
    ok((await agente.put(`/viagens/${viagem}/finalizar`).send({km_chegada:1220})).status===409,'não finaliza duas vezes');
    r=await agente.get('/viagens');
    ok(r.body[0].km_percorridos==='200.00' && r.body[0].custo_estimado==='120.00','200 km e estimativa de R$ 120 (200/10*6)');
    ok(Number((await agente.get('/veiculos')).body[0].quilometragem)===1200,'odômetro atualizado automaticamente');
    ok((await agente.put(`/veiculos/${v}`).send({...corpo,quilometragem:1150})).status===409,'não permite reduzir o odômetro via cadastro');
    const d=await agente.post('/despesas').send({veiculo_id:v,viagem_id:viagem,categoria:'Combustível',data:'2026-10-05',valor:110,litros:18.33,descricao:'Posto'});
    ok(d.status===201,'abastecimento real vinculado à viagem');
    ok((await agente.post('/despesas').send({veiculo_id:v,categoria:'Combustível',data:'2026-10-05',valor:-10})).status===400,'rejeita valor negativo');
    ok((await agente.post('/despesas').send({veiculo_id:v,categoria:'Pedágio',data:'2026-10-05',valor:20,litros:2})).status===400,'rejeita litros em despesa não combustível');
    const parcelaPaga=await agente.post('/despesas').send({veiculo_id:v,categoria:'Financiamento',data:'2026-10-05',valor:800});
    ok(parcelaPaga.status===201,'parcela de financiamento paga registrada');
    ok(Number((await agente.get('/veiculos')).body[0].parcelas_pagas)===3,'lançamento incrementa número de parcelas pagas automaticamente');
    r=await agente.get('/relatorios?tipo=frota&de=2026-10-01&ate=2026-10-31');
    ok(r.status===200,'relatório consolidado gerado');
    const linha=r.body.linhas[0];
    ok(Number(linha.investimento_inicial)===5000 && Number(linha.financiamento)===800,'entrada e parcela de financiamento contabilizadas');
    ok(Number(linha.combustivel)===110 && Number(linha.combustivel_estimado)===120,'combustível estimado separado de combustível pago');
    ok(Number(linha.custo_total)===5910 && Number(linha.custo_por_km)===29.55,'total realizado 5000 + 800 + 110 sem duplicar estimativa');
    ok(Number(linha.saldo_financiamento_previsto)===26400,'saldo futuro previsto independente do total gasto');
    r=await agente.get('/relatorios?tipo=frota&de=2026-11-01&ate=2026-11-30');
    ok(Number(r.body.linhas[0].investimento_inicial)===0 && Number(r.body.linhas[0].custo_total)===0,'investimento registrado só no mês de aquisição');
    r=await agente.get('/relatorios?tipo=despesas&de=2026-10-01&ate=2026-10-31');
    ok(r.body.linhas.length===2,'relatório de despesas lista pagamentos');
    r=await agente.get('/relatorios?tipo=viagens&de=2026-10-01&ate=2026-10-31');
    ok(r.body.linhas.length===1 && Number(r.body.linhas[0].km_percorridos)===200,'relatório de viagens exibe distância');
    ok((await agente.delete(`/veiculos/${v}`)).status===409,'veículo com histórico não pode ser excluído');
    ok((await agente.delete(`/despesas/${d.body.id}`)).status===204,'despesa pode ser excluída com auditoria');
    r=await agente.get('/relatorios?tipo=frota&de=2026-10-01&ate=2026-10-31');
    ok(Number(r.body.linhas[0].custo_total)===5800,'exclusão da despesa recalcula total');
    ok((await agente.delete(`/despesas/${parcelaPaga.body.id}`)).status===204,'exclusão da parcela estorna o pagamento');
    ok(Number((await agente.get('/veiculos')).body[0].parcelas_pagas)===2,'exclusão reduz número de parcelas pagas');
    const financiado=await agente.post('/veiculos').send({
      placa:'FRT2B45',marca:'VW',modelo:'Gol',ano:2024,quilometragem:0,
      situacao_aquisicao:'Financiado',data_aquisicao:'2026-10-01',valor_compra:20000,
      valor_entrada:1000,valor_parcela:500,total_parcelas:12,parcelas_pagas:2,
      primeiro_vencimento:'2026-10-10'
    });
    ok(financiado.status===201,'cadastra financiamento com vencimento mensal');
    const fv=financiado.body.id;
    let lista=(await agente.get('/despesas')).body;
    let pendente=lista.find(d=>d.veiculo_id===fv && d.categoria==='Financiamento');
    ok(pendente && pendente.situacao_pagamento==='Pendente' && Number(pendente.valor)===500,'lança parcela automaticamente como pendente');
    ok((await agente.get('/despesas')).body.filter(d=>d.veiculo_id===fv).length===1,'consultas repetidas não duplicam parcelas');
    r=await agente.get(`/relatorios?tipo=frota&de=2026-10-01&ate=2026-10-31&veiculo_id=${fv}`);
    ok(r.body.linhas.length===1 && Number(r.body.linhas[0].financiamento_pendente)===500 && Number(r.body.linhas[0].financiamento)===0,'relatório individual diferencia previsto de pago');
    ok((await agente.post('/despesas').send({veiculo_id:fv,categoria:'Financiamento',data:'2026-10-10',valor:500})).status===409,'impede cobrança financeira duplicada');
    r=await agente.put(`/despesas/${pendente.id}/pagar`).send({valor:505,data_pagamento:'2026-10-15'});
    ok(r.status===200 && r.body.situacao_pagamento==='Pago' && Number(r.body.valor)===505,'pagamento da parcela confirma o valor real');
    ok(Number((await agente.get('/veiculos')).body.find(v=>v.id===fv).parcelas_pagas)===3,'pagamento automático aumenta parcelas pagas');
    r=await agente.get(`/relatorios?tipo=frota&de=2026-10-01&ate=2026-10-31&veiculo_id=${fv}`);
    ok(Number(r.body.linhas[0].financiamento)===505 && Number(r.body.linhas[0].financiamento_pendente)===0,'confirmação migra previsto para realizado sem somar duas vezes');
    const pdf=Buffer.from('%PDF-1.7\ncomprovante de teste\n');
    r=await agente.post(`/despesas/${pendente.id}/comprovante`).set('Content-Type','application/pdf')
      .set('X-Nome-Arquivo','recibo.pdf').send(pdf);
    ok(r.status===201,'anexa comprovante PDF a despesa');
    r=await agente.get(`/despesas/${pendente.id}/comprovante`);
    ok(r.status===200 && r.headers['content-type'].includes('application/pdf'),'abre comprovante autenticado');
    r=await agente.get(`/relatorios?tipo=contratos&de=2026-10-01&ate=2026-10-31&veiculo_id=${fv}`);
    ok(r.body.linhas.length===1 && r.body.linhas[0].tem_comprovante===true && r.body.linhas[0].situacao_pagamento==='Pago','relatório financeiro individual apresenta comprovante e status');
    const locado=await agente.post('/veiculos').send({placa:'LOC3C67',marca:'Fiat',modelo:'Mobi',quilometragem:0,
      situacao_aquisicao:'Locado',valor_parcela:900,primeiro_vencimento:'2026-10-11'});
    ok(locado.status===201,'cadastra locação mensal');
    r=await agente.get(`/relatorios?tipo=frota&de=2026-10-01&ate=2026-10-31&veiculo_id=${locado.body.id}`);
    ok(r.body.linhas.length===1 && Number(r.body.linhas[0].aluguel_pendente)===900,'locação aparece como previsão mensal no relatório');
    const loc=(await agente.get('/despesas')).body.find(d=>d.veiculo_id===locado.body.id);
    r=await agente.put(`/despesas/${loc.id}/pagar`).send({valor:900,data_pagamento:'2026-10-11'});
    ok(r.status===200,'mensalidade de locação pode ser confirmada');
    r=await agente.get(`/relatorios?tipo=frota&de=2026-10-01&ate=2026-10-31&veiculo_id=${locado.body.id}`);
    ok(Number(r.body.linhas[0].aluguel)===900 && Number(r.body.linhas[0].aluguel_pendente)===0,'relatório inclui aluguel pago');
    r=await agente.get(`/relatorios?tipo=despesas&de=2026-10-01&ate=2026-10-31&veiculo_id=${fv}`);
    ok(r.body.linhas.length===1 && r.body.linhas[0].categoria==='Financiamento','filtro de despesas pelo veículo funciona');
    console.log(`${n} verificações do módulo 5 aprovadas.`);
  } finally {await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
