import mongoose from "mongoose";
import crypto from "crypto";

const ENC_KEY = process.env.DB_ENC_KEY || "12345678901234567890123456789012"; // 32 chars
const IV = process.env.DB_ENC_IV || "1234567890123456"; // 16 chars

function encrypt(text) {
    const cipher = crypto.createCipheriv("aes-256-cbc", ENC_KEY, IV);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
}

function decrypt(text) {
  if (!text) return null;

  // If the text is NOT hex, return it as plain text
  if (!/^[0-9a-fA-F]+$/.test(text)) {
    return text; 
  }

  try {
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENC_KEY, IV);
    let decrypted = decipher.update(text, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.warn("⚠️ Password not encrypted, using raw value");
    return text;
  }
}


const DbConfigSchema = new mongoose.Schema({
    name: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    host: String,
    port: { type: Number, default: 3306 },
    user: String,
    password: String, // encrypted
    database: String,
    connString: String,
    schemaSummary: String,

    active: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now }
});

// Auto-encrypt password before saving
DbConfigSchema.pre("save", function (next) {
  if (this.isModified("password") && this.password) {

    // If already encrypted (hex), skip
    if (/^[0-9a-fA-F]+$/.test(this.password)) {
      return next();
    }

    this.password = encrypt(this.password);
  }
  next();
});


// Decrypt helper
DbConfigSchema.methods.getDecryptedPassword = function () {
    return this.password ? decrypt(this.password) : null;
};

export default mongoose.models.DbConfig || mongoose.model("DbConfig", DbConfigSchema);
