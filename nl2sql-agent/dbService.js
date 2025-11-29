import { getPoolForConfig } from "./services/dbManager.js";

export async function runQueryWithConfig(sql, cfg) {
  const pool = getPoolForConfig(cfg);

  try {
    const [rows] = await pool.query(sql);
    return rows;
  } finally {
    await pool.end();
  }
}
