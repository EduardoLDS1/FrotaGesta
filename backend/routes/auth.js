const router = require("express").Router();
const pool = require("../config/db");
const { texto, exigir, transacao, Falha } = require("../lib/utils");
const {
  hashSenha,
  conferirSenha,
  validarSenha,
  resumo,
  segredo,
} = require("../lib/seguranca");
const { autenticar, limitar, cookie, tokenCookie } = require("../lib/auth");
router.post("/login", limitar, async (req, res) => {
  const acesso = texto(req.body?.acesso, 180).toLowerCase();
  const { rows } = await pool.query(
    "SELECT * FROM usuarios WHERE (login=$1 OR email=$1) AND excluido=FALSE",
    [acesso],
  );
  const usuario = rows[0];
  if (
    !usuario ||
    !usuario.ativo ||
    !(await conferirSenha(req.body?.senha, usuario.senha_hash))
  )
    throw new Falha(401, "Usuário ou senha inválidos.");
  const token = segredo();
  await transacao(async (c) => {
    await c.query("DELETE FROM sessoes WHERE expira_em<=NOW()");
    await c.query(
      "INSERT INTO sessoes (token_hash,usuario_id,expira_em) VALUES ($1,$2,NOW()+INTERVAL '8 hours')",
      [resumo(token), usuario.id],
    );
  });
  cookie(res, token);
  const { senha_hash, recuperacao_hash, ...publico } = usuario;
  res.json(publico);
});
router.get("/me", autenticar, (req, res) => res.json(req.usuario));
router.post("/logout", async (req, res) => {
  const token = tokenCookie(req);
  if (token)
    await pool.query("DELETE FROM sessoes WHERE token_hash=$1", [
      resumo(token),
    ]);
  res.clearCookie("fg_sessao", { path: "/" });
  res.status(204).end();
});
router.post("/recuperar", limitar, async (req, res) => {
  const acesso = texto(req.body?.acesso, 180).toLowerCase();
  const codigo = texto(req.body?.codigo, 100);
  const novaHash = await hashSenha(validarSenha(req.body?.senha));
  const novoCodigo = segredo();
  await transacao(async (c) => {
    const { rows } = await c.query(
      "SELECT * FROM usuarios WHERE (login=$1 OR email=$1) AND ativo=TRUE AND excluido=FALSE FOR UPDATE",
      [acesso],
    );
    exigir(
      rows[0] &&
        rows[0].recuperacao_hash &&
        rows[0].recuperacao_hash === resumo(codigo),
      "Dados de recuperação inválidos.",
      400,
    );
    await c.query(
      "UPDATE usuarios SET senha_hash=$1,recuperacao_hash=$2 WHERE id=$3",
      [novaHash, resumo(novoCodigo), rows[0].id],
    );
    await c.query("DELETE FROM sessoes WHERE usuario_id=$1", [rows[0].id]);
  });
  res.json({ codigo: novoCodigo });
});
module.exports = router;
