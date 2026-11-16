const assert=require('node:assert/strict');
const request=require('supertest');
const {preparar}=require('./banco-teste.cjs');
(async()=>{
  const {db,pool}=await preparar();
  let n=0;
  function ok(cond,msg){assert.ok(cond,msg);console.log(`OK módulo 7 ${++n}: ${msg}`);}
  const pdf=Buffer.from('%PDF-1.7\ncomprovante teste\n');
  function arquivo(agente,caminho,metodo,dados,presente=true){
    return agente[metodo](caminho)
      .set('Content-Type','application/octet-stream')
      .set('X-Dados',encodeURIComponent(JSON.stringify(dados)))
      .set('X-Nome-Arquivo','nota.pdf')
      .send(presente?pdf:Buffer.alloc(0));
  }
  try{
    const {hashSenha}=require('../lib/seguranca');
    const app=require('../server');
    await pool.query(`INSERT INTO usuarios(nome,email,login,senha_hash,perfil) VALUES
      ('Admin','adm@local','admin',$1,'Administrador'),('Operador','op@local','operador',$1,'Operador')`,[await hashSenha('Teste12345')]);
    const admin=request.agent(app),op=request.agent(app);
    ok((await admin.post('/auth/login').set('Origin','http://localhost:5000').send({acesso:'admin',senha:'Teste12345'})).status===200,
      'login aceita a origem do servidor único na rede');
    ok((await op.post('/auth/login').send({acesso:'operador',senha:'Teste12345'})).status===200,'operador autenticado');
    const base={placa:'ABC1D23',marca:'Chevrolet',modelo:'Onix',ano:2025,quilometragem:20000,
      combustivel:'Gasolina',situacao_aquisicao:'Não informado'};
    const carro=await admin.post('/veiculos').send(base);
    ok(carro.status===201,'cadastra veículo');
    const v=carro.body.id;
    const viagem=await admin.post('/viagens').send({veiculo_id:v,motorista:'M',destino:'Teste'});
    ok(viagem.status===201 && Number(viagem.body.km_saida)===20000,'KM inicial preenchido pelo servidor');
    ok((await admin.post('/viagens').send({veiculo_id:v})).status===409,'impede segunda viagem aberta');
    ok((await arquivo(admin,`/viagens/${viagem.body.id}/finalizar`,'put',
      {km_chegada:20150,valor_combustivel:125},false)).status===400,
      'impede registrar combustível pago sem comprovante');
    const fim=await arquivo(admin,`/viagens/${viagem.body.id}/finalizar`,'put',
      {km_chegada:20150,valor_combustivel:125});
    ok(fim.status===200 && Number(fim.body.valor_combustivel)===125,'encerra com gasto real');
    const listagem=(await admin.get('/viagens')).body;
    ok(listagem[0].km_percorridos==='150.00' && !('custo_estimado' in listagem[0]),'distância sem estimativas');
    const despesas=(await admin.get('/despesas')).body;
    ok(despesas.length===1 && despesas[0].categoria==='Combustível' && Number(despesas[0].valor)===125,
      'gasto da viagem lançado uma vez');
    ok((await admin.get(`/despesas/${despesas[0].id}/comprovante`)).status===200,'admin abre comprovante');
    ok((await op.get(`/despesas/${despesas[0].id}/comprovante`)).status===403,'operador não abre comprovante');
    for (const tipo of ['consolidado','frota','despesas','estoque','contratos']) {
      const resposta=await op.get(`/relatorios?tipo=${tipo}&de=2026-01-01&ate=2026-12-31`);
      ok(resposta.status===403,`operador não consegue gerar relatório ${tipo} pela API`);
    }
    ok((await request(app).get('/relatorios?tipo=estoque')).status===401,'sem autenticação não pode acessar relatórios');
    ok(!('comprovante_nome' in (await op.get('/despesas')).body[0]),'nome do comprovante oculto ao operador');
    const nova=await admin.post('/viagens').send({veiculo_id:v});
    ok(nova.status===201&&Number(nova.body.km_saida)===20150,'próxima viagem utiliza KM final anterior');
    const manut=await arquivo(admin,'/despesas','post',
      {veiculo_id:v,categoria:'Manutenção',data:'2026-10-08',valor:250,descricao:'Revisão'});
    ok(manut.status===201,'registra manutenção com comprovante');
    const pecas=await arquivo(admin,'/despesas','post',
      {veiculo_id:v,categoria:'Peças',data:'2026-10-08',valor:90,descricao:'Filtro'});
    ok(pecas.status===201,'registra peças com comprovante');
    ok((await arquivo(admin,'/despesas','post',
      {veiculo_id:v,categoria:'Combustível',data:'2026-10-08',valor:50},false)).status===400,
      'gasto manual exige comprovante');
    const filtradas=await admin.get(`/despesas?veiculo_id=${v}&categoria=Pe%C3%A7as`);
    ok(filtradas.status===200&&filtradas.body.length===1&&filtradas.body[0].id===pecas.body.id,
      'filtro combinado veículo e categoria');
    const con=await admin.get(`/relatorios?tipo=consolidado&periodicidade=mensal&de=2026-01-01&ate=2026-12-31&veiculo_id=${v}`);
    ok(con.status===200&&con.body.linhas.some(l=>l.categoria==='Peças'&&Number(l.total)===90),
      'relatório mensal consolida categoria');
    const total=con.body.linhas.reduce((n,r)=>n+Number(r.total),0);
    ok(total===465,'relatório usa R$ 125 + 250 + 90 sem duplicidade');
    for(const periodicidade of ['semanal','anual']){
      const r=await admin.get(`/relatorios?tipo=consolidado&periodicidade=${periodicidade}&de=2026-01-01&ate=2026-12-31`);
      ok(r.status===200 && Number(r.body.total_geral)===465,`consolidação ${periodicidade}`);
    }
    const frota=await admin.get('/relatorios?tipo=frota&de=2026-01-01&ate=2026-12-31');
    ok(frota.status===200&&Number(frota.body.linhas[0].custo_total)===465,'relatório geral usa gastos pagos');
    ok((await admin.delete(`/veiculos/${v}`)).status===409,'exclusão bloqueia viagem aberta');
    const fim2=await arquivo(admin,`/viagens/${nova.body.id}/finalizar`,'put',
      {km_chegada:20170,valor_combustivel:0},false);
    ok(fim2.status===200,'viagem sem abastecimento não gera despesa');
    ok((await op.delete(`/veiculos/${v}`)).status===403,'somente admin exclui veículos');
    ok((await admin.delete(`/veiculos/${v}`)).status===204,'exclusão lógica aceita histórico vinculado');
    ok(!(await admin.get('/veiculos')).body.some(c=>c.id===v),'veículo excluído sai da lista ativa');
    const hist=await admin.get('/veiculos?historico=1');
    ok(hist.body.some(c=>c.id===v&&c.excluido),'veículo arquivado fica disponível em relatórios');
    ok((await admin.get('/relatorios?tipo=frota&de=2026-01-01&ate=2026-12-31')).body.linhas.length===1,
      'gastos antigos preservados após excluir veículo');
    console.log(`${n} verificações do módulo 7 aprovadas.`);
  }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
