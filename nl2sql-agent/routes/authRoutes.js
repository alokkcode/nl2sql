import express from "express";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import { signJwt } from "../services/authService.js";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
});

const createSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["admin", "user"]).optional(),
    assignedDb: z.string().optional()
});

router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const { email, password } = parsed.data;
    const user = await User.findOne({ email });

    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signJwt({ id: user._id, role: user.role });
    res.json({ token, user: { email: user.email, role: user.role } });
});

router.post("/create", requireAuth, requireAdmin, async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

    const { email, password, role, assignedDb} = parsed.data;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "User exists" });

    const hash = await bcrypt.hash(password, 10);
    await User.create({
        email,
        passwordHash: hash,
        role: role ?? "user",
        createdBy: req.user.email,
        assignedDb: assignedDb || null
    });
    res.json({ ok: true });
});

router.post("/deactivate", requireAuth, requireAdmin, async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: "Email required" });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: "User not found" });

  if (user.role === "admin") return res.status(403).json({ error: "Cannot deactivate admin" });

  user.active = false;
  await user.save();
  res.json({ ok: true });
});

router.post("/logout", requireAuth, (req, res) => {
  res.json({ ok: true, message: "Logged out" });
});


export default router;
