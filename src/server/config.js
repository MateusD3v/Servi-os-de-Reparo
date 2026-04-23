const path = require("path");

const ROOT = path.resolve(__dirname, "../..");

loadEnvFile(path.join(ROOT, ".env.local"));

const PORT = Number(process.env.PORT || 3010);
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_AUTH_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "finance_app_state";

function loadEnvFile(filePath) {
  const fs = require("fs");

  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_AUTH_KEY);
}

module.exports = {
  ROOT,
  PORT,
  SUPABASE_AUTH_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_TABLE,
  SUPABASE_URL,
  getAllowedOrigins,
  isSupabaseConfigured,
};
