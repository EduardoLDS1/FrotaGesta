const fs = require("fs");
const path = require("path");
const pool = require("../config/db");
const {
  hashSenha,
  validarSenha,
  segredo,
  resumo,
} = require("../lib/seguranca");
(async () => {
  try {
    const c = await pool.connect();
    try {
      await c.query(
        fs.readFileSync(path.join(__dirname, "../database/schema.sql"), "utf8"),
      );
      await c.query(
        fs.readFileSync(
          path.join(__dirname, "../database/modulo4.sql"),
          "utf8",
        ),
      );
      await c.query(
        fs.readFileSync(path.join(__dirname, "../database/modulo5.sql"), "utf8"),
      );
      await c.query(
        fs.readFileSync(path.join(__dirname, "../database/modulo6.sql"), "utf8"),
      );
      await c.query("BEGIN");
      await c.query("LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE");
      const { rows } = await c.query(
        "SELECT id FROM usuarios WHERE perfil='Administrador' AND ativo=TRUE AND excluido=FALSE LIMIT 1",
      );
      if (!rows.length) {
        const senha = process.env.ADMIN_PASSWORD || segredo().slice(0, 16),
          codigo = segredo();
        validarSenha(senha);
        await c.query(
          "INSERT INTO usuarios (nome,email,cargo,login,senha_hash,recuperacao_hash,perfil) VALUES ($1,$2,$3,$4,$5,$6,'Administrador')",
          [
            "Administrador",
            "admin@frotagesta.local",
            "Administração",
            "admin",
            await hashSenha(senha),
            resumo(codigo),
          ],
        );
        await c.query("COMMIT");
        console.log(
          `Primeiro administrador criado.\nLogin: admin\nSenha inicial: ${senha}\nCódigo de recuperação: ${codigo}\nGuarde os dados de acesso em um local seguro.`,
        );
      } else {
        await c.query("COMMIT");
        console.log(
          "Banco atualizado. Administrador e registros existentes preservados.",
        );
      }
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  } catch (e) {
    console.error("Não foi possível preparar o banco:", e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
