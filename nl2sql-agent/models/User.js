import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    active: { type: Boolean, default: true },
    assignedDb: { type: mongoose.Schema.Types.ObjectId, ref: "DbConfig", default: null },
    activeDbConfig: { type: mongoose.Schema.Types.ObjectId, ref: "DbConfig", default: null },
    createdBy: { type: String }
});

export default mongoose.models.User || mongoose.model("User", UserSchema);
