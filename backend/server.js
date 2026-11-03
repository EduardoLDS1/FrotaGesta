const express = require("express");
const cors = require("cors");
const { autenticar, administrador } = require("./lib/auth");
const app = express();
const { networkInterfaces } = require("node:os");

function origemNormalizada(valor) {
  try {
    const url = new URL(String(valor).trim().replace(/^['"]|['"]$/g, ""));
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

const origensPermitidas = new Set(
  String(process.env.FRONTEND_URL || "http://localhost:3000")
    .split(",")
    .map(origemNormalizada)
    .filter(Boolean)
);
for (const endereco of ["localhost", "127.0.0.1", "[::1]"])
  origensPermitidas.add(`http://${endereco}:3000`);

if (process.env.NODE_ENV !== "production") {
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const interfaceRede of interfaces || []) {
      if (!["IPv4", "IPv6"].includes(interfaceRede.family)) continue;
      const ip = interfaceRede.address.split("%")[0];
      const host = interfaceRede.family === "IPv6" ? `[${ip}]` : ip;
      const origem = origemNormalizada(`http://${host}:3000`);
      if (origem) origensPermitidas.add(origem);
    }
  }
}

function origemPermitida(valor) {
  const origem = origemNormalizada(valor);
  return origem !== null && origensPermitidas.has(origem);
}

app.disable("x-powered-by");
app.use(cors({
  origin: (origem, callback) => callback(null, !origem || origemPermitida(origem)),
  credentials: true,
}));
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin &&
    !origemPermitida(req.headers.origin)
  )
  {
    console.warn("Origem bloqueada:", req.headers.origin);
    return res
      .status(403)
      .json({ erro: "Origem da requisição não autorizada." });
  }
  if (
    ["POST", "PUT"].includes(req.method) &&
    (req.body === null ||
      typeof req.body !== "object" ||
      Array.isArray(req.body))
  )
    req.body = {};
  next();
});
app.use("/auth", require("./routes/auth"));
app.use(autenticar);
app.use("/veiculos", require("./routes/veiculos"));
app.use("/viagens", require("./routes/viagens"));
app.use("/despesas", require("./routes/despesas"));
app.use("/produtos", require("./routes/produtos"));
app.use("/manutencoes", require("./routes/manutencoes"));
app.use("/usuarios", administrador, require("./routes/usuarios"));
app.use(require("./routes/visao"));
app.use((req, res) => res.status(404).json({ erro: "Rota não encontrada." }));
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") return res.status(413).json({ erro: "Comprovante muito grande (máximo: 5 MB)." });
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ erro: "JSON inválido." });
  if (err.code === "23505")
    return res
      .status(409)
      .json({
        erro: "Já existe um cadastro com esses dados (placa, login, e-mail ou produto/modelo).",
      });
  if (["23503", "23001"].includes(err.code))
    return res
      .status(409)
      .json({
        erro: "Registro inexistente ou vinculado a outros dados. Verifique o cadastro selecionado.",
      });
  if (err.status)
    return res
      .status(err.status)
      .json({ erro: err.message, campos: err.campos });
  console.error("Falha na API:", err.code || err.message);
  res
    .status(500)
    .json({
      erro: "Não foi possível concluir a operação. Confira a conexão e execute npm run setup no backend.",
    });
});
if (require.main === module)
  app.listen(process.env.PORT || 5000, () => {
    console.log("API FrotaGesta iniciada.");
    console.log("Origens permitidas:", Array.from(origensPermitidas).join(", "));
  });
module.exports = app;
