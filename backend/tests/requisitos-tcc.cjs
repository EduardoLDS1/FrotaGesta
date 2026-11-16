const assert=require('node:assert/strict');
const request=require('supertest');
const {preparar}=require('./banco-teste.cjs');
(async()=>{
  const {db,pool}=await preparar();
  let checks=0;
  const ok=(cond,nome)=>{assert.ok(cond,nome);console.log(`OK ${++checks}: ${nome}`)};
  try {
    const {hashSenha}=require('../lib/seguranca');
    await pool.query("INSERT INTO usuarios(nome,email,login,senha_hash,perfil) VALUES('Administrador','admin@local','admin',$1,'Administrador')",[await hashSenha('Teste12345')]);
    const app=require('../server'),admin=request.agent(app);
    ok((await admin.post('/auth/login').send({acesso:'admin',senha:'Teste12345'})).status===200,'autenticação de administrador');
    const veiculo=(await admin.post('/veiculos').send({placa:'BRA1A23',marca:'Fiat',modelo:'Uno',quilometragem:12000,
      situacao_operacional:'Ativo',revisao_prevista_km:12000,situacao_aquisicao:'Não informado'}));
    ok(veiculo.status===201,'cadastro de revisão preventiva');
    const v=veiculo.body.id;
    const dash=await admin.get('/dashboard');
    ok(dash.status===200&&dash.body.revisoes_pendentes===1,'dashboard alerta manutenção preventiva por km');
    const p1=(await admin.post('/produtos').send({nome:'Filtro',modelo:'A1',codigo:'PECA-1',categoria:'Filtros',fornecedor:'Oficina',valor_unitario:'30',estoque_minimo:1,quantidade:5}));
    const p2=(await admin.post('/produtos').send({nome:'Óleo',modelo:'5W30',codigo:'PECA-2',categoria:'Lubrificantes',fornecedor:'Distribuidora',valor_unitario:'40',estoque_minimo:1,quantidade:10}));
    ok(p1.status===201&&p2.status===201,'itens com código, categoria e fornecedor');
    const manut=(await admin.post('/manutencoes').send({veiculo_id:v,data:'2026-11-10',tipo:'Preventiva',servico:'Revisão',
      custo:'100',mecanico:'Oficina',status:'Concluída',itens:[
      {produto_id:p1.body.id,quantidade:1},{produto_id:p2.body.id,quantidade:2}
    ]}));
    ok(manut.status===201&&Number(manut.body.custo_total)===210,'calcula R$ 100 serviços + R$ 110 peças');
    const itens=(await admin.get('/manutencoes')).body[0];
    ok(itens.itens.length===2&&Number(itens.custo_total)===210,'histórico contém ambas as peças e custo total');
    const saldo=(await admin.get('/produtos')).body;
    ok(saldo.find(x=>x.id===p1.body.id).quantidade===4&&saldo.find(x=>x.id===p2.body.id).quantidade===8,'duas baixas de estoque');
    const custos=(await admin.get('/relatorios?tipo=custos&de=2026-11-01&ate=2026-11-30')).body;
    ok(Number(custos.linhas[0].total)===210,'relatório soma serviços e peças');
    ok((await admin.delete(`/manutencoes/${manut.body.id}`)).status===204,'exclusão lógica de manutenção');
    const saldo2=(await admin.get('/produtos')).body;
    ok(saldo2.find(x=>x.id===p1.body.id).quantidade===5&&saldo2.find(x=>x.id===p2.body.id).quantidade===10,'estorno de todas as peças');
    const off=await admin.put(`/veiculos/${v}`).send({placa:'BRA1A23',marca:'Fiat',modelo:'Uno',quilometragem:12000,
      situacao_aquisicao:'Não informado',situacao_operacional:'Inativo'});
    ok(off.status===200,'permite inativar veículo');
    ok((await admin.post('/viagens').send({veiculo_id:v})).status===409,'impede viagem de veículo inativo');
    console.log(`${checks} verificações adicionais foram aprovadas.`);
  }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
