const { exigir, inteiro, id, texto, atividade } = require("./utils");
async function movimentar(c, usuario, dados) {
  const produtoId = id(dados.produto_id),
    quantidade = inteiro(dados.quantidade, 1),
    motivo = texto(dados.motivo, 500);
  exigir(
    ["Entrada", "Saída"].includes(dados.tipo),
    "Tipo de movimentação inválido.",
  );
  const { rows } = await c.query(
    "SELECT * FROM produtos WHERE id=$1 AND excluido=FALSE FOR UPDATE",
    [produtoId],
  );
  const p = rows[0];
  exigir(p, "Produto não encontrado.", 404);
  const saldo =
    p.quantidade + (dados.tipo === "Entrada" ? quantidade : -quantidade);
  exigir(
    saldo >= 0,
    `Estoque insuficiente. Disponível: ${p.quantidade} unidade(s).`,
    409,
  );
  exigir(saldo <= 1000000000, "O saldo ultrapassa o limite permitido.", 409);
  const atualizado = await c.query(
    "UPDATE produtos SET quantidade=$1,updated_at=NOW() WHERE id=$2 RETURNING *",
    [saldo, produtoId],
  );
  await c.query(
    "INSERT INTO movimentacoes (produto_id,tipo,quantidade,saldo_anterior,saldo_posterior,motivo,usuario_id,manutencao_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      produtoId,
      dados.tipo,
      quantidade,
      p.quantidade,
      saldo,
      motivo,
      usuario.id,
      dados.manutencao_id || null,
    ],
  );
  await atividade(
    c,
    usuario,
    "Estoque",
    `${dados.tipo} de ${quantidade} unidade(s) de ${p.nome}. Saldo: ${saldo}.`,
  );
  return atualizado.rows[0];
}
module.exports = { movimentar };
