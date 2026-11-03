const request = require("supertest");
jest.mock("./config/db", () => ({ query: jest.fn(), connect: jest.fn() }));
const pool = require("./config/db");
const app = require("./server");
const admin = { id: 1, nome: "Admin", perfil: "Administrador" };
const token = "a".repeat(64);
function auth() {
  pool.query.mockImplementation(async (sql) =>
    sql.includes("FROM sessoes") ? { rows: [admin] } : { rows: [] },
  );
}
beforeEach(() => jest.resetAllMocks());
test("protege os cadastros sem autenticação", async () => {
  expect((await request(app).get("/produtos")).status).toBe(401);
  expect(pool.query).not.toHaveBeenCalled();
});
test("operador não pode gerenciar usuários", async () => {
  pool.query.mockResolvedValue({ rows: [{ ...admin, perfil: "Operador" }] });
  expect(
    (await request(app).get("/usuarios").set("Cookie", `fg_sessao=${token}`))
      .status,
  ).toBe(403);
});
test("rejeita alteração a partir de outra origem", async () => {
  expect(
    (
      await request(app)
        .post("/produtos")
        .set("Origin", "https://example.org")
        .send({})
    ).status,
  ).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
});
test.each([-1, 1.5, 1000000001, "5"])(
  "rejeita quantidade inválida %s",
  async (quantidade) => {
    auth();
    expect(
      (
        await request(app)
          .post("/produtos")
          .set("Cookie", `fg_sessao=${token}`)
          .send({
            nome: "Filtro",
            modelo: "A",
            quantidade,
            estoque_minimo: 1,
            valor_unitario: "20.00",
          })
      ).status,
    ).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
  },
);
test("não aceita atualizar saldo pelo formulário de produto", async () => {
  auth();
  const r = await request(app)
    .put("/produtos/1")
    .set("Cookie", `fg_sessao=${token}`)
    .send({
      nome: "Filtro",
      modelo: "A",
      estoque_minimo: 1,
      valor_unitario: "20",
      quantidade: 99,
    });
  expect(r.status).toBe(400);
  expect(pool.connect).not.toHaveBeenCalled();
});
test("valida intervalo de datas do relatório", async () => {
  auth();
  expect(
    (
      await request(app)
        .get("/relatorios?de=2026-12-01&ate=2026-01-01")
        .set("Cookie", `fg_sessao=${token}`)
    ).status,
  ).toBe(400);
});
test("impede exclusão da própria conta", async () => {
  auth();
  expect(
    (
      await request(app)
        .delete("/usuarios/1")
        .set("Cookie", `fg_sessao=${token}`)
    ).status,
  ).toBe(409);
});
test("reverte uma transação se ocorrer falha de gravação", async () => {
  auth();
  const c = {
    query: jest.fn().mockImplementation(async (sql) => {
      if (sql.startsWith("INSERT INTO produtos"))
        throw new Error("falha simulada");
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  pool.connect.mockResolvedValue(c);
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  const r = await request(app)
    .post("/produtos")
    .set("Cookie", `fg_sessao=${token}`)
    .send({
      nome: "Filtro",
      modelo: "A",
      quantidade: 0,
      estoque_minimo: 1,
      valor_unitario: "20",
    });
  expect(r.status).toBe(500);
  expect(c.query).toHaveBeenCalledWith("ROLLBACK");
  expect(c.release).toHaveBeenCalled();
  log.mockRestore();
});

test.each(["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"])(
  "aceita requisições do frontend local: %s",
  async (origem) => {
    const resposta = await request(app).post("/auth/logout").set("Origin", origem).send({});
    expect(resposta.status).toBe(204);
    expect(resposta.headers["access-control-allow-origin"]).toBe(origem);
  },
);
test("bloqueia requisições de site externo", async () => {
  const resposta = await request(app).post("/auth/logout").set("Origin", "https://example.org").send({});
  expect(resposta.status).toBe(403);
});
