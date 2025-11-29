import express from "express";
import DbConfig from "../models/DbConfig.js";
import User from "../models/User.js";
import { runQueryWithConfig } from "../dbService.js";
import { generateSQL, validateSQL, summarizeResult } from "../langchainService.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// FIXED: Always fetch fresh DB config from database
async function resolveActiveConfig(req) {
  let cfgId;

  console.log("\n [resolveActiveConfig] User:", req.user.email, "| Role:", req.user.role);

  if (req.user.role === "admin") {
    // Get admin's selected DB ID
    cfgId = req.user.activeDbConfig?._id || req.user.activeDbConfig;
    
    if (!cfgId) {
      console.warn("Admin has no activeDbConfig, using global fallback");
      const globalDb = await DbConfig.findOne({ active: true });
      cfgId = globalDb?._id;
    }
  } else {
    // Get user's assigned DB ID
    cfgId = req.user.assignedDb?._id || req.user.assignedDb;
  }

  if (!cfgId) {
    console.error("No database ID found!");
    throw new Error("No database assigned or selected.");
  }

  // CRITICAL: Fetch FRESH config from DB (not from req.user cache)
  const cfg = await DbConfig.findById(cfgId);
  
  if (!cfg) {
    console.error("Database config not found in DB!");
    throw new Error("Database configuration not found.");
  }

  console.log("Using DB:", cfg.name, `(${cfg.database})`);
  console.log("Schema Preview:", cfg.schemaSummary?.substring(0, 150) + "...\n");

  return cfg;
}

// Generate SQL
router.post("/generate", requireAuth, async (req, res) => {
  try {
    const cfg = await resolveActiveConfig(req);
    const { userQuery } = req.body;

    console.log("Generating SQL for query:", userQuery);
    console.log("Target database:", cfg.database);
    console.log("Schema length:", cfg.schemaSummary?.length || 0, "chars");

    const sql = await generateSQL(userQuery, cfg.schemaSummary, cfg.database);
    
    console.log("Generated SQL:", sql.substring(0, 150) + "...\n");
    
    res.json({ sql, usedDatabase: cfg.database, usedDbName: cfg.name });
  } catch (err) {
    console.error("Generate SQL error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Validate SQL
router.post("/validate", requireAuth, async (req, res) => {
  try {
    const { sql } = req.body;
    const verdict = await validateSQL(sql);
    res.json(verdict);
  } catch (err) {
    console.error("Validate SQL error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Execute SQL
router.post("/execute", requireAuth, async (req, res) => {
  try {
    const cfg = await resolveActiveConfig(req);
    const { sql, userQuery } = req.body;

    console.log("Executing SQL on database:", cfg.database);

    const verdict = await validateSQL(sql);
    if (!verdict.safe) {
      return res.status(400).json({ error: "Unsafe SQL", reason: verdict.reason });
    }

    const rows = await runQueryWithConfig(sql, cfg);
    
    console.log("Query returned", rows.length, "rows from", cfg.database);

    const summary = await summarizeResult(userQuery, rows, sql, cfg.schemaSummary);

    res.json({ result: rows, summary, executedOn: cfg.database });
  } catch (err) {
    console.error("Execute SQL error:", err);
    res.status(400).json({ error: err.message });
  }
});

export default router;
