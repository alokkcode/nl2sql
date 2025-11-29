import mysql from "mysql2/promise";

export function getPoolForConfig(cfg) {
  return mysql.createPool({
    host: cfg.host,
    user: cfg.user,
    password: cfg.getDecryptedPassword(),
    database: cfg.database,
    port: cfg.port || 3306,
    waitForConnections: true,
    connectionLimit: 5
  });
}

export async function fetchSchemaSummaryFromDb(cfg) {
  const pool = getPoolForConfig(cfg);

  try {
    const [tables] = await pool.query("SHOW TABLES");

    let schemaSummary = "Tables:\n";

    for (const t of tables) {
      const tableName = Object.values(t)[0];
      const [cols] = await pool.query(`DESCRIBE \`${tableName}\``);

      const colStr = cols
        .map(c => `${c.Field} (${c.Type})`)
        .join(", ");

      schemaSummary += `${tableName}(${colStr})\n`;
    }

    return schemaSummary.trim();
  } finally {
    await pool.end();
  }
}
