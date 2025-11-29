import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import cors from "cors";
import path from "path";
import queryRoutes from "./routes/queryRoutes.js";

dotenv.config();
import dbRoutes from "./routes/dbRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { requireAuth } from "./middleware/auth.js";
import User from "./models/User.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "../frontend")));

mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log("MongoDB connected");
  seedAdmin();
});

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  const exists = await User.findOne({ email });
  if (!exists) {
    const hash = await bcrypt.hash(password, 10);
    await User.create({ email, passwordHash: hash, role: "admin", createdBy: "system" });
    console.log("Admin seeded:", email, "/", password);
  }
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/landing.html"));
});
app.use("/auth", authRoutes);
app.use("/db", dbRoutes);  // new admin DB management routes
app.use("/api/query", requireAuth, queryRoutes);

// global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
