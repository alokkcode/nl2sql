import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";
dotenv.config();

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
  model: "gemini-2.5-flash",
});

// Utility — Normalize model output safely
function normalizeOutput(res) {
  if (!res) return "";
  try {
    if (typeof res === "string") return res.trim();
    if (typeof res.content === "string") return res.content.trim();
    if (Array.isArray(res.content)) {
      const first = res.content.find((x) => typeof x === "string" || x?.text);
      return (first?.text || first || "").toString().trim();
    }
    return JSON.stringify(res).trim();
  } catch (err) {
    console.warn("normalizeOutput failed:", err.message);
    return "";
  }
}

// Clean SQL fences
function cleanSQLResponse(text) {
  if (!text) return "";
  return text
    .replace(/```sql/gi, "")
    .replace(/```/g, "")
    .replace(/--.*$/gm, "")
    .trim();
}

// Extract and normalize JSON safely
function safeParseJSON(text) {
  if (!text) return { safe: false, reason: "Empty response" };

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    const jsonChunk = match[0]
      .replace(/[\n\r\t]/g, " ")
      .replace(/'/g, '"')
      .replace(/,\s*}/g, "}");
    try {
      return JSON.parse(jsonChunk);
    } catch (err) {
      console.warn("JSON parse failed:", err.message);
    }
  }

  const lower = text.toLowerCase();
  if (lower.includes("safe: true"))
    return { safe: true, reason: "Parsed fallback: safe" };
  if (lower.includes("safe: false"))
    return { safe: false, reason: "Parsed fallback: unsafe" };

  return { safe: false, reason: "Validator could not produce valid JSON." };
}

// FIXED: Generate SQL with better context
export async function generateSQL(userQuery, schemaSummary, database_name) {
  console.log("[generateSQL] Using schema for database:", database_name);
  console.log("Schema:", schemaSummary?.substring(0, 200) + "...");

  const prompt = `You are an expert MySQL SQL generator.

**CRITICAL RULES:**
1. Use ONLY the tables and columns from the schema below
2. The target database is: ${database_name}
3. Output ONLY raw SQL - no markdown, no explanations, no comments
4. Use proper JOIN syntax and WHERE clauses as needed

**DATABASE SCHEMA:**
${schemaSummary}

**USER QUESTION:**
"${userQuery}"

Generate the SQL query now:`;

  try {
    const res = await model.invoke(prompt);
    const text = normalizeOutput(res);
    const sql = cleanSQLResponse(text);
    
    console.log("[generateSQL] Generated SQL for", database_name);
    
    return sql;
  } catch (err) {
    console.error("[generateSQL] Error:", err.message);
    throw err;
  }
}

// Validate SQL
export async function validateSQL(sqlQuery) {
  console.log("[validateSQL] Checking query safety");

  const prompt = `
You are a SQL safety validator.
Check if the SQL is safe.

Rules:
- SELECT, UPDATE, INSERT, DELETE allowed
- DROP, ALTER, TRUNCATE, CREATE not allowed
- DELETE or UPDATE must include WHERE

Respond ONLY with a JSON object like:
{"safe": true, "reason": "short explanation"}

SQL:
${sqlQuery}
`;

  try {
    const res = await model.invoke(prompt);
    const text = normalizeOutput(res);
    const verdict = safeParseJSON(text);
    console.log(
      verdict.safe
        ? "[validateSQL] Safe query"
        : "[validateSQL] Unsafe query"
    );
    return verdict;
  } catch (err) {
    console.error("[validateSQL] Error:", err.message);
    return { safe: false, reason: "Validator failed" };
  }
}

// Summarize result
export async function summarizeResult(userQuery, rows, sqlQuery, schemaSummary) {
  console.log("[summarizeResult] Summarizing", rows.length, "rows");

  const sample = JSON.stringify(rows.slice(0, 5), null, 2);
  const prompt = `
You are a data analysis assistant.

The user asked: "${userQuery}"

Database schema:
${schemaSummary}

SQL executed:
${sqlQuery}

Sample results (first 5 rows):
${sample}

Total rows returned: ${rows.length}

Task:
- Provide a clear, factual summary of the results
- Use actual numbers from the data
- Keep it concise (2-3 sentences)
- Do NOT apologize or mention missing data
`;

  try {
    const res = await model.invoke(prompt);
    const summary = normalizeOutput(res);
    console.log("[summarizeResult] Summary ready");
    return summary;
  } catch (err) {
    console.error("[summarizeResult] Error:", err.message);
    return "Failed to summarize result.";
  }
}