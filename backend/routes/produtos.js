const router = require("express").Router();
const pool = require("../config/db");
const {
  texto,
  inteiro,
  dinheiro,
  id,
  exigir,
  transacao,
  atividade,
} = require("../lib/utils");
const { movimentar } = require("../lib/estoque");
function cadastro(b) {
  return [
    texto(b.nome, 120),
    texto(b.modelo, 100),
    inteiro(b.estoque_minimo),
    dinheiro(b.valor_unitario),
  ];
}
router.get("/", async (req, res) =>
  res.json(
    (
      await pool.query(
        "SELECT *,quantidade*valor_unitario AS valor_total FROM produtos WHERE excluido=FALSE ORDER BY nome,id",
      )
    ).rows,
  ),
);
router.get("/movimentacoes", async (req, res) => {
  const p = req.query.produto_id ? id(req.query.produto_id) : null;
  res.json(
    (
      await pool.query(
        "SELECT m.*,p.nome,p.modelo,u.nome AS usuario FROM movimentacoes m JOIN produtos p ON p.id=m.produto_id JOIN usuarios u ON u.id=m.usuario_id WHERE ($1::int IS NULL OR p.id=$1) ORDER BY m.id DESC",
        [p],
      )
    ).rows,
  );
});
router.post("/", async (req, res) => {
  const dados = cadastro(req.body || {}),
    quantidade = inteiro(req.body.quantidade);
  const produto = await transacao(async (c) => {
    const { rows } = await c.query(
      "INSERT INTO produtos (nome,modelo,estoque_minimo,valor_unitario) VALUES ($1,$2,$3,$4) RETURNING *",
      dados,
    );
    await atividade(
      c,
      req.usuario,
      "Estoque",
      `Produto cadastrado: ${rows[0].nome}.`,
    );
    return quantidade > 0
      ? movimentar(c, req.usuario, {
          produto_id: rows[0].id,
          tipo: "Entrada",
          quantidade,
          motivo: "Saldo inicial do cadastro",
        })
      : rows[0];
  });
  res.status(201).json(produto);
});
router.put("/:id", async (req, res) => {
  const chave = id(req.params.id),
    dados = cadastro(req.body || {});
  exigir(
    !Object.hasOwn(req.body, "quantidade"),
    "Altere o saldo usando uma entrada ou saída.",
  );
  res.json(
    await transacao(async (c) => {
      const { rows } = await c.query(
        "UPDATE produtos SET nome=$1,modelo=$2,estoque_minimo=$3,valor_unitario=$4,updated_at=NOW() WHERE id=$5 AND excluido=FALSE RETURNING *",
        [...dados, chave],
      );
      exigir(rows[0], "Produto não encontrado.", 404);
      await atividade(
        c,
        req.usuario,
        "Estoque",
        `Produto atualizado: ${rows[0].nome}.`,
      );
      return rows[0];
    }),
  );
});
router.delete("/:id", async (req, res) => {
  const chave = id(req.params.id);
  await transacao(async (c) => {
    const { rows } = await c.query(
      "SELECT * FROM produtos WHERE id=$1 AND excluido=FALSE FOR UPDATE",
      [chave],
    );
    exigir(rows[0], "Produto não encontrado.", 404);
    exigir(
      rows[0].quantidade === 0,
      "Registre a saída do saldo restante antes de excluir este produto.",
      409,
    );
    const vinculo = await c.query(
      "SELECT id FROM manutencoes WHERE produto_id=$1 AND excluido=FALSE LIMIT 1",
      [chave],
    );
    exigir(
      !vinculo.rows.length,
      "Este produto está vinculado a uma manutenção e precisa ser mantido no cadastro.",
      409,
    );
    await c.query(
      "UPDATE produtos SET excluido=TRUE,updated_at=NOW() WHERE id=$1",
      [chave],
    );
    await atividade(
      c,
      req.usuario,
      "Estoque",
      `Produto excluído: ${rows[0].nome}. Histórico preservado.`,
    );
  });
  res.status(204).end();
});
router.post("/:id/movimentacoes", async (req, res) => {
  const chave = id(req.params.id);
  const produto = await transacao((c) =>
    movimentar(c, req.usuario, {
      ...req.body,
      produto_id: chave,
      manutencao_id: null,
    }),
  );
  res.status(201).json(produto);
});
module.exports = router;
