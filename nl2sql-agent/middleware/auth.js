import { verifyJwt } from "../services/authService.js";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Not logged in" });
    
    const token = header.split(" ")[1];
    const payload = verifyJwt(token);
    if (!payload?.id) return res.status(401).json({ error: "Invalid token" });
    
    const user = await User.findById(payload.id)
        .populate("activeDbConfig")
        .populate("assignedDb");
    
    if (!user || !user.active) return res.status(403).json({ error: "User inactive" });
    
    req.user = user;
    next();
}

export function requireAdmin(req, res, next) {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    next();
}