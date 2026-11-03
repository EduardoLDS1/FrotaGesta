const router = require("express").Router();
const pool = require("../config/db");
const {
  texto,
  dinheiro,
  data,
  id,
  inteiro,
  exigir,
  transacao,
  atividade,
} = require("../lib/utils");
const { movimentar } = require("../lib/estoque");
function cadastro(b) {
  exigir(
    ["Preventiva", "Corretiva"].includes(b.tipo),
    "Selecione um tipo de manutenção.",
  );
  exigir(
    ["Em andamento", "Concluída"].includes(b.status),
    "Selecione um status válido.",
  );
  return [
    id(b.veiculo_id),
    data(b.data),
    b.tipo,
    texto(b.servico, 200),
    dinheiro(b.custo),
    texto(b.mecanico, 120),
    texto(b.observacoes || "", 1000, false),
    b.status,
  ];
}
router.get("/", async (req, res) => {
  res.json(
    (
      await pool.query(
        "SELECT m.*,v.placa,v.modelo AS veiculo_modelo,p.nome AS produto_nome FROM manutencoes m JOIN veiculos v ON v.id=m.veiculo_id LEFT JOIN produtos p ON p.id=m.produto_id WHERE m.excluido=FALSE ORDER BY m.data DESC,m.id DESC",
      )
    ).rows,
  );
});
router.post("/", async (req, res) => {
  const dados = cadastro(req.body),
    produtoId = req.body.produto_id ? id(req.body.produto_id) : null,
    qt = produtoId ? inteiro(req.body.quantidade_pecas, 1) : 0;
  res.status(201).json(
    await transacao(async (c) => {
      const { rows } = await c.query(
        "INSERT INTO manutencoes (veiculo_id,data,tipo,servico,custo,mecanico,observacoes,status,produto_id,quantidade_pecas) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
        [...dados, produtoId, qt],
      );
      if (produtoId)
        await movimentar(c, req.usuario, {
          produto_id: produtoId,
          tipo: "Saída",
          quantidade: qt,
          motivo: `Peças utilizadas na manutenção #${rows[0].id}`,
          manutencao_id: rows[0].id,
        });
      await atividade(
        c,
        req.usuario,
        "Manutenções",
        `Manutenção ${req.body.tipo.toLowerCase()} cadastrada para o veículo #${dados[0]}.`,
      );
      return rows[0];
    }),
  );
});
router.put("/:id", async (req, res) => {
  const chave = id(req.params.id),
    dados = cadastro(req.body);
  res.json(
    await transacao(async (c) => {
      const anterior = await c.query(
        "SELECT * FROM manutencoes WHERE id=$1 AND excluido=FALSE FOR UPDATE",
        [chave],
      );
      exigir(anterior.rows[0], "Manutenção não encontrada.", 404);
      exigir(
        !Object.hasOwn(req.body, "produto_id") &&
          !Object.hasOwn(req.body, "quantidade_pecas"),
        "As peças já movimentadas não podem ser alteradas pela edição.",
      );
      const { rows } = await c.query(
        "UPDATE manutencoes SET veiculo_id=$1,data=$2,tipo=$3,servico=$4,custo=$5,mecanico=$6,observacoes=$7,status=$8 WHERE id=$9 RETURNING *",
        [...dados, chave],
      );
      await atividade(
        c,
        req.usuario,
        "Manutenções",
        `Manutenção #${chave} atualizada.`,
      );
      return rows[0];
    }),
  );
});
router.delete("/:id", async (req, res) => {
  const chave = id(req.params.id);
  await transacao(async (c) => {
    const { rows } = await c.query(
      "SELECT * FROM manutencoes WHERE id=$1 AND excluido=FALSE FOR UPDATE",
      [chave],
    );
    const m = rows[0];
    exigir(m, "Manutenção não encontrada.", 404);
    if (m.produto_id)
      await movimentar(c, req.usuario, {
        produto_id: m.produto_id,
        tipo: "Entrada",
        quantidade: m.quantidade_pecas,
        motivo: `Estorno por exclusão da manutenção #${chave}`,
        manutencao_id: chave,
      });
    await c.query("UPDATE manutencoes SET excluido=TRUE WHERE id=$1", [chave]);
    await atividade(
      c,
      req.usuario,
      "Manutenções",
      `Manutenção #${chave} excluída; peças vinculadas devolvidas ao estoque.`,
    );
  });
  res.status(204).end();
});
module.exports = router;
