import express from "express";
import DbConfig from "../models/DbConfig.js";
import User from "../models/User.js";  
import { fetchSchemaSummaryFromDb } from "../services/dbManager.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { z } from "zod";

const router = express.Router();

const connectSchema = z.object({
  name: z.string().min(1),
  connString: z.string().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  user: z.string().optional(),
  password: z.string().optional(),
  database: z.string().optional()
});

// CREATE DB CONFIG
router.post("/connect", requireAuth, requireAdmin, async (req, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const payload = parsed.data;

  const cfg = {
    name: payload.name,
    owner: req.user._id,
    host: payload.host,
    user: payload.user,
    password: payload.password,
    database: payload.database,
    port: payload.port || 3306
  };

  if (payload.connString) {
    const url = new URL(payload.connString);
    cfg.host = url.hostname;
    cfg.user = decodeURIComponent(url.username);
    cfg.password = decodeURIComponent(url.password);
    cfg.database = url.pathname.replace("/", "");
    cfg.port = url.port ? Number(url.port) : 3306;
    cfg.connString = payload.connString;
  }

  let schemaSummary;
  try {
    const fake = new DbConfig(cfg);
    fake.password = cfg.password;
    schemaSummary = await fetchSchemaSummaryFromDb(fake);

  } catch (err) {
    return res.status(400).json({ error: "DB connection failed: " + err.message });
  }

  await DbConfig.updateMany({}, { active: false });

  const created = await DbConfig.create({
    ...cfg,
    schemaSummary,
    active: true
  });

  res.json({ ok: true, configId: created._id, schemaSummary });
});

// Get admin's current active DB
router.get("/active", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("activeDbConfig");
    res.json({ 
      activeDbConfig: user.activeDbConfig,
      activeDbId: user.activeDbConfig?._id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// LIST DB CONFIGS
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const configs = await DbConfig.find().select("-password").lean();
  res.json({ configs });
});

// SWITCH GLOBAL ACTIVE DB (legacy, still supported)
router.post("/activate/:id", requireAuth, requireAdmin, async (req, res) => {
  await DbConfig.updateMany({}, { active: false });
  await DbConfig.findByIdAndUpdate(req.params.id, { active: true });
  res.json({ ok: true });
});


// SET ADMIN-SPECIFIC ACTIVE DB
router.post("/set-active/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const dbId = req.params.id;

    const exists = await DbConfig.findById(dbId);
    if (!exists) return res.status(404).json({ error: "DB config not found" });

    // FORCE UPDATE OF ADMIN activeDbConfig
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { activeDbConfig: dbId },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(500).json({ error: "Failed to update admin DB selection" });
    }

    res.json({ ok: true, activeDbConfig: updated.activeDbConfig });

  } catch (err) {
    console.error("DB SET ACTIVE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE CONFIG
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  await DbConfig.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default router;
