const assert = require("node:assert/strict");
const request = require("supertest");
const { preparar } = require("./banco-teste.cjs");
(async () => {
  const { db, pool } = await preparar();
  let n = 0;
  const check = (ok, msg) => {
    assert.ok(ok, msg);
    n++;
    console.log(`OK ${n}: ${msg}`);
  };
  try {
    const { hashSenha, resumo } = require("../lib/seguranca");
    const app = require("../server");
    await pool.query(
      "INSERT INTO usuarios (nome,email,login,senha_hash,recuperacao_hash,perfil) VALUES ('Administrador','admin@teste.local','admin',$1,$2,'Administrador')",
      [await hashSenha("Teste12345"), resumo("recuperacao-inicial")],
    );
    const admin = request.agent(app),
      operador = request.agent(app);
    check(
      (await admin.get("/produtos")).status === 401,
      "API exige autenticação",
    );
    check(
      (
        await admin
          .post("/auth/login")
          .send({ acesso: "admin", senha: "errada" })
      ).status === 401,
      "senha incorreta recusada",
    );
    let r = await admin
      .post("/auth/login")
      .send({ acesso: "admin", senha: "Teste12345" });
    check(
      r.status === 200 && r.headers["set-cookie"][0].includes("HttpOnly"),
      "login real e cookie HttpOnly",
    );
    check(
      (await admin.get("/auth/me")).body.login === "admin",
      "sessão recuperada do banco",
    );
    r = await admin
      .post("/veiculos")
      .send({
        placa: "ABC1D23",
        marca: "Fiat",
        modelo: "Strada",
        ano: 2024,
        quilometragem: 1000,
      });
    check(r.status === 201, "cadastro de veículo");
    const veiculo = r.body.id;
    r = await admin
      .post("/produtos")
      .send({
        nome: "Filtro de Óleo",
        modelo: "Tecfil",
        quantidade: 10,
        estoque_minimo: 5,
        valor_unitario: "25.00",
      });
    check(
      r.status === 201 && r.body.quantidade === 10,
      "produto criado com saldo inicial",
    );
    const produto = r.body.id;
    r = await admin
      .post("/produtos")
      .send({
        nome: "Filtro de Óleo",
        modelo: "Tecfil",
        quantidade: 0,
        estoque_minimo: 5,
        valor_unitario: "25",
      });
    check(r.status === 409, "produto duplicado recusado");
    check(
      (await admin.get("/produtos/movimentacoes")).body[0].saldo_posterior ===
        10,
      "saldo inicial gera histórico",
    );
    r = await admin
      .post(`/produtos/${produto}/movimentacoes`)
      .send({ tipo: "Entrada", quantidade: 5, motivo: "Compra" });
    check(
      r.status === 201 && r.body.quantidade === 15,
      "entrada soma automaticamente",
    );
    r = await admin
      .post(`/produtos/${produto}/movimentacoes`)
      .send({ tipo: "Saída", quantidade: 11, motivo: "Uso" });
    check(
      r.status === 201 && r.body.quantidade === 4,
      "saída desconta automaticamente",
    );
    r = await admin
      .post(`/produtos/${produto}/movimentacoes`)
      .send({ tipo: "Saída", quantidade: 5, motivo: "Excesso" });
    check(r.status === 409, "saída maior que saldo recusada");
    check(
      (await admin.get("/produtos")).body[0].quantidade === 4 &&
        (await admin.get("/produtos/movimentacoes")).body.length === 3,
      "rollback preserva saldo e histórico",
    );
    r = await admin
      .put(`/produtos/${produto}`)
      .send({
        nome: "Filtro",
        modelo: "Tecfil",
        estoque_minimo: 3,
        valor_unitario: "30.00",
      });
    check(r.status === 200 && r.body.quantidade === 4, "edição preserva saldo");
    check(
      (await admin.delete(`/produtos/${produto}`)).status === 409,
      "exclusão de produto com saldo bloqueada",
    );
    const m = {
      veiculo_id: veiculo,
      data: "2026-10-05",
      tipo: "Preventiva",
      servico: "Troca de filtro",
      custo: "180.50",
      mecanico: "José",
      observacoes: "Revisão",
      status: "Em andamento",
      produto_id: produto,
      quantidade_pecas: 2,
    };
    r = await admin.post("/manutencoes").send(m);
    check(r.status === 201, "manutenção criada");
    const manutencao = r.body.id;
    check(
      (await admin.get("/produtos")).body[0].quantidade === 2,
      "manutenção retira peças",
    );
    let dash = (await admin.get("/dashboard")).body;
    check(
      dash.veiculos === 1 && dash.em_manutencao === 1 && dash.alertas === 1,
      "Dashboard e alertas refletem o banco",
    );
    check(
      (await admin.get("/veiculos")).body[0].status === "Em manutenção",
      "status do veículo deriva da manutenção",
    );
    r = await admin.post("/manutencoes").send({ ...m, quantidade_pecas: 9 });
    check(
      r.status === 409 && (await admin.get("/manutencoes")).body.length === 1,
      "falha de estoque reverte criação da manutenção",
    );
    r = await admin.get("/relatorios?tipo=custos&de=2026-10-01&ate=2026-10-31");
    check(
      r.status === 200 && r.body.linhas[0].total === "180.50",
      "relatório agrega custo real por mês",
    );
    r = await admin.get("/relatorios?tipo=estoque");
    check(
      r.body.linhas[0].valor_total === "60.00",
      "inventário calcula valor total",
    );
    r = await admin.get(
      "/relatorios?tipo=movimentacoes&de=2020-01-01&ate=2100-12-31",
    );
    check(
      r.status === 200 && r.body.linhas.length === 4,
      "relatório de movimentações inclui os lançamentos",
    );
    const { produto_id, quantidade_pecas, ...edicao } = m;
    check(
      (
        await admin
          .put(`/manutencoes/${manutencao}`)
          .send({ ...edicao, status: "Concluída" })
      ).status === 200,
      "edição de manutenção",
    );
    check(
      (await admin.get("/dashboard")).body.em_manutencao === 0,
      "conclusão libera o veículo",
    );
    check(
      (await admin.delete(`/manutencoes/${manutencao}`)).status === 204 &&
        (await admin.get("/produtos")).body[0].quantidade === 4,
      "exclusão estorna peças em transação",
    );
    await admin
      .post(`/produtos/${produto}/movimentacoes`)
      .send({ tipo: "Saída", quantidade: 4, motivo: "Baixa final" });
    check(
      (await admin.delete(`/produtos/${produto}`)).status === 204,
      "exclusão de produto zerado",
    );
    check(
      (await admin.get("/produtos")).body.length === 0 &&
        (await admin.get("/produtos/movimentacoes")).body.length === 6,
      "histórico preservado após exclusão",
    );
    r = await admin
      .post("/usuarios")
      .send({
        nome: "Operador",
        email: "op@teste.local",
        login: "operador",
        cargo: "Oficina",
        senha: "Senha12345",
        perfil: "Operador",
        ativo: true,
      });
    check(
      r.status === 201 && r.body.codigo && !r.body.senha_hash,
      "cadastro de usuário sem expor hash",
    );
    const op = r.body.id;
    const code = r.body.codigo;
    check(
      (
        await operador
          .post("/auth/login")
          .send({ acesso: "op@teste.local", senha: "Senha12345" })
      ).status === 200,
      "login por e-mail",
    );
    check(
      (await operador.get("/usuarios")).status === 403 &&
        (await operador.get("/produtos")).status === 200,
      "permissões de operador",
    );
    check(
      (await admin.delete("/usuarios/1")).status === 409,
      "não exclui a própria conta",
    );
    r = await request(app)
      .post("/auth/recuperar")
      .send({ acesso: "operador", codigo: code, senha: "NovaSenha123" });
    check(r.status === 200 && r.body.codigo, "recuperação com código válido");
    check(
      (await operador.get("/auth/me")).status === 401,
      "recuperação invalida sessões antigas",
    );
    check(
      (
        await request(app)
          .post("/auth/recuperar")
          .send({ acesso: "operador", codigo: code, senha: "OutraSenha123" })
      ).status === 400,
      "código de recuperação só pode ser usado uma vez",
    );
    await operador
      .post("/auth/login")
      .send({ acesso: "operador", senha: "NovaSenha123" });
    check(
      (await admin.delete(`/usuarios/${op}`)).status === 204 &&
        (await operador.get("/auth/me")).status === 401,
      "exclusão de usuário revoga acesso",
    );
    check(
      (await admin.get("/dashboard")).body.atividades.length > 0,
      "operações gravam atualizações com usuário",
    );
    check(
      (await admin.post("/auth/logout")).status === 204 &&
        (await admin.get("/auth/me")).status === 401,
      "logout encerra sessão",
    );
    console.log(
      `${n} verificações de integração aprovadas no PostgreSQL embarcado.`,
    );
  } finally {
    await db.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
