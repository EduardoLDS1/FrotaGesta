const pool = require("../config/db");
const { resumo } = require("./seguranca");
const { Falha } = require("./utils");
function tokenCookie(req) {
  return (
    (req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("fg_sessao="))
      ?.slice(10) || ""
  );
}
async function autenticar(req, res, next) {
  try {
    const token = tokenCookie(req);
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new Falha(401, "Entre no sistema para continuar.");
    const { rows } = await pool.query(
      "SELECT u.id,u.nome,u.email,u.login,u.perfil,u.cargo FROM sessoes s JOIN usuarios u ON u.id=s.usuario_id WHERE s.token_hash=$1 AND s.expira_em>NOW() AND u.ativo=TRUE AND u.excluido=FALSE",
      [resumo(token)],
    );
    if (!rows[0]) throw new Falha(401, "Sua sessão expirou. Entre novamente.");
    req.usuario = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}
function administrador(req, res, next) {
  if (req.usuario.perfil !== "Administrador")
    return next(
      new Falha(403, "Somente administradores podem gerenciar usuários."),
    );
  next();
}
const tentativas = new Map();
function limitar(req, res, next) {
  const agora = Date.now(),
    chave = req.ip;
  for (const [k, v] of tentativas) if (v.fim < agora) tentativas.delete(k);
  const atual = tentativas.get(chave) || { n: 0, fim: agora + 15 * 60 * 1000 };
  atual.n++;
  tentativas.set(chave, atual);
  if (atual.n > 30)
    return next(
      new Falha(
        429,
        "Muitas tentativas. Aguarde 15 minutos para tentar novamente.",
      ),
    );
  next();
}
function cookie(res, token) {
  res.cookie("fg_sessao", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  });
}
module.exports = { autenticar, administrador, limitar, cookie, tokenCookie };
