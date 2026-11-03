const { randomBytes, scrypt, timingSafeEqual, createHash } = require("crypto");
const { promisify } = require("util");
const derivar = promisify(scrypt);
const resumo = (valor) => createHash("sha256").update(valor).digest("hex");
const segredo = () => randomBytes(32).toString("hex");
async function hashSenha(senha) {
  const sal = randomBytes(16).toString("hex");
  const hash = await derivar(senha, sal, 64);
  return `${sal}:${hash.toString("hex")}`;
}
async function conferirSenha(senha, salvo) {
  if (typeof senha !== "string" || senha.length > 128 || !salvo?.includes(":"))
    return false;
  const [sal, hash] = salvo.split(":");
  const candidato = await derivar(senha, sal, 64);
  const esperado = Buffer.from(hash, "hex");
  return (
    esperado.length === candidato.length && timingSafeEqual(esperado, candidato)
  );
}
function validarSenha(v) {
  const { exigir } = require("./utils");
  exigir(
    typeof v === "string" && v.length >= 8 && v.length <= 128,
    "A senha deve ter entre 8 e 128 caracteres.",
  );
  return v;
}
module.exports = { hashSenha, conferirSenha, validarSenha, resumo, segredo };
