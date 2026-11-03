const pool = require("../config/db");
class Falha extends Error {
  constructor(status, message, campos) {
    super(message);
    this.status = status;
    this.campos = campos;
  }
}
const exigir = (ok, message, status = 400) => {
  if (!ok) throw new Falha(status, message);
};
const texto = (v, max = 150, obrigatorio = true) => {
  exigir(
    typeof v === "string" &&
      (!obrigatorio || v.trim().length > 0) &&
      v.trim().length <= max,
    `Informe um texto válido de até ${max} caracteres.`,
  );
  return v.trim();
};
const inteiro = (v, min = 0, max = 1000000000) => {
  exigir(
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max,
    `Informe um número inteiro entre ${min} e ${max}.`,
  );
  return v;
};
const id = (v) => {
  exigir(
    /^[1-9]\d*$/.test(String(v)) && Number(v) <= 2147483647,
    "Identificador inválido.",
  );
  return Number(v);
};
const dinheiro = (v) => {
  exigir(
    (typeof v === "string" || typeof v === "number") &&
      /^\d{1,8}(\.\d{1,2})?$/.test(String(v)),
    "Informe um valor de 0 a 99999999,99, com até duas casas decimais.",
  );
  return Number(v).toFixed(2);
};
const data = (v) => {
  exigir(
    typeof v === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      v >= "1900-01-01" &&
      v <= "2100-12-31" &&
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Informe uma data válida.",
  );
  return v;
};
async function transacao(operacao) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operacao(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
async function atividade(client, usuario, modulo, descricao) {
  await client.query(
    "INSERT INTO atividades (modulo, descricao, usuario_nome) VALUES ($1,$2,$3)",
    [modulo, descricao, usuario.nome],
  );
}
module.exports = {
  Falha,
  exigir,
  texto,
  inteiro,
  id,
  dinheiro,
  data,
  transacao,
  atividade,
};
