const router = require("express").Router();
const pool = require("../config/db");
const { texto, exigir, id, transacao, atividade } = require("../lib/utils");
const {
  hashSenha,
  validarSenha,
  segredo,
  resumo,
} = require("../lib/seguranca");
const campos = "id,nome,email,cargo,login,perfil,ativo,created_at";
function validar(b) {
  const nome = texto(b.nome, 120),
    email = texto(b.email, 180).toLowerCase(),
    cargo = texto(b.cargo || "", 100, false),
    login = texto(b.login, 60).toLowerCase();
  exigir(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Informe um e-mail válido.");
  exigir(
    /^[a-z0-9._-]{3,60}$/.test(login),
    "O login deve ter de 3 a 60 letras, números, pontos, hífens ou sublinhados.",
  );
  exigir(
    ["Administrador", "Operador"].includes(b.perfil),
    "Selecione um perfil válido.",
  );
  exigir(typeof b.ativo === "boolean", "Informe o status do usuário.");
  return [nome, email, cargo, login, b.perfil, b.ativo];
}
router.get("/", async (req, res) =>
  res.json(
    (
      await pool.query(
        `SELECT ${campos} FROM usuarios WHERE excluido=FALSE ORDER BY id DESC`,
      )
    ).rows,
  ),
);
router.post("/", async (req, res) => {
  const dados = validar(req.body),
    hash = await hashSenha(validarSenha(req.body.senha)),
    codigo = segredo();
  const usuario = await transacao(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO usuarios (nome,email,cargo,login,perfil,ativo,senha_hash,recuperacao_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${campos}`,
      [...dados, hash, resumo(codigo)],
    );
    await atividade(
      c,
      req.usuario,
      "Usuários",
      `Usuário cadastrado: ${rows[0].nome}.`,
    );
    return rows[0];
  });
  res.status(201).json({ ...usuario, codigo });
});
async function protegerAdministradores(c, usuario, chave, retiraAcesso) {
  await c.query("LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE");
  const ator = await c.query(
    "SELECT id FROM usuarios WHERE id=$1 AND ativo=TRUE AND excluido=FALSE AND perfil='Administrador'",
    [usuario.id],
  );
  exigir(ator.rows.length, "Acesso de administrador indisponível.", 403);
  if (retiraAcesso) {
    const outros = await c.query(
      "SELECT COUNT(*)::int AS n FROM usuarios WHERE id<>$1 AND ativo=TRUE AND excluido=FALSE AND perfil='Administrador'",
      [chave],
    );
    exigir(
      outros.rows[0].n > 0,
      "Mantenha ao menos um administrador ativo.",
      409,
    );
  }
}
router.put("/:id", async (req, res) => {
  const chave = id(req.params.id),
    dados = validar(req.body),
    novaHash = req.body.senha
      ? await hashSenha(validarSenha(req.body.senha))
      : null;
  exigir(
    chave !== req.usuario.id ||
      (req.body.ativo && req.body.perfil === "Administrador"),
    "Você não pode desativar ou remover seu próprio acesso de administrador.",
    409,
  );
  res.json(
    await transacao(async (c) => {
      await protegerAdministradores(
        c,
        req.usuario,
        chave,
        !req.body.ativo || req.body.perfil !== "Administrador",
      );
      const { rows } = await c.query(
        `UPDATE usuarios SET nome=$1,email=$2,cargo=$3,login=$4,perfil=$5,ativo=$6,senha_hash=COALESCE($7,senha_hash) WHERE id=$8 AND excluido=FALSE RETURNING ${campos}`,
        [...dados, novaHash, chave],
      );
      exigir(rows[0], "Usuário não encontrado.", 404);
      if (novaHash || !req.body.ativo)
        await c.query("DELETE FROM sessoes WHERE usuario_id=$1", [chave]);
      await atividade(
        c,
        req.usuario,
        "Usuários",
        `Usuário atualizado: ${rows[0].nome}.`,
      );
      return rows[0];
    }),
  );
});
router.post("/:id/recuperacao", async (req, res) => {
  const chave = id(req.params.id),
    codigo = segredo();
  await transacao(async (c) => {
    const { rowCount } = await c.query(
      "UPDATE usuarios SET recuperacao_hash=$1 WHERE id=$2 AND excluido=FALSE",
      [resumo(codigo), chave],
    );
    exigir(rowCount, "Usuário não encontrado.", 404);
    await atividade(
      c,
      req.usuario,
      "Usuários",
      `Novo código de recuperação gerado para o usuário ${chave}.`,
    );
  });
  res.json({ codigo });
});
router.delete("/:id", async (req, res) => {
  const chave = id(req.params.id);
  exigir(
    chave !== req.usuario.id,
    "Você não pode excluir sua própria conta.",
    409,
  );
  await transacao(async (c) => {
    await protegerAdministradores(c, req.usuario, chave, true);
    const { rows } = await c.query(
      "UPDATE usuarios SET excluido=TRUE,ativo=FALSE WHERE id=$1 AND excluido=FALSE RETURNING nome",
      [chave],
    );
    exigir(rows[0], "Usuário não encontrado.", 404);
    await c.query("DELETE FROM sessoes WHERE usuario_id=$1", [chave]);
    await atividade(
      c,
      req.usuario,
      "Usuários",
      `Usuário excluído: ${rows[0].nome}.`,
    );
  });
  res.status(204).end();
});
module.exports = router;
