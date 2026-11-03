const pool = require("../config/db");
const {
  hashSenha,
  validarSenha,
  resumo,
  segredo,
} = require("../lib/seguranca");
(async () => {
  try {
    const login = process.argv[2] || "admin",
      senha = process.env.ADMIN_PASSWORD;
    validarSenha(senha);
    const codigo = segredo();
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const { rows } = await c.query(
        "UPDATE usuarios SET senha_hash=$1,recuperacao_hash=$2 WHERE login=$3 AND perfil='Administrador' AND excluido=FALSE RETURNING id",
        [await hashSenha(senha), resumo(codigo), login],
      );
      if (!rows[0]) throw new Error("Administrador não encontrado.");
      await c.query("DELETE FROM sessoes WHERE usuario_id=$1", [rows[0].id]);
      await c.query("COMMIT");
      console.log(`Senha redefinida. Novo código de recuperação: ${codigo}`);
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
