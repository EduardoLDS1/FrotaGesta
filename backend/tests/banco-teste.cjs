const { PGlite } = require("@electric-sql/pglite");
const fs = require("fs");
const path = require("path");
async function preparar() {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(
    fs.readFileSync(path.join(__dirname, "../database/schema.sql"), "utf8"),
  );
  await db.exec(
    fs.readFileSync(path.join(__dirname, "../database/modulo4.sql"), "utf8"),
  );
  await db.exec(
    fs.readFileSync(path.join(__dirname, "../database/modulo5.sql"), "utf8"),
  );
  await db.exec(
    fs.readFileSync(path.join(__dirname, "../database/modulo6.sql"), "utf8"),
  );
  let fila = Promise.resolve();
  const query = async (sql, params) => {
    const r = await db.query(sql, params);
    return { ...r, rowCount: r.affectedRows ?? r.rows?.length ?? 0 };
  };
  const pool = {
    query,
    connect: async () => {
      let liberar;
      const anterior = fila;
      fila = new Promise((r) => {
        liberar = r;
      });
      await anterior;
      return { query, release: liberar };
    },
    end: () => db.close(),
  };
  require.cache[require.resolve("../config/db")] = {
    id: require.resolve("../config/db"),
    filename: require.resolve("../config/db"),
    loaded: true,
    exports: pool,
  };
  return { db, pool };
}
module.exports = { preparar };
