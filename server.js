const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3010);

loadEnvFile(path.join(ROOT, ".env.local"));

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "finance_app_state";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
};

function loadEnvFile(filePath) {
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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 500, { error: "Falha ao ler arquivo." });
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Payload muito grande."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function getSupabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function ensureSupabaseConfigured(res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    sendJson(res, 503, {
      connected: false,
      error: "Supabase não configurado no servidor local.",
    });
    return false;
  }
  return true;
}

async function fetchRemoteState(profile) {
  const selectUrl = new URL(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`);
  selectUrl.searchParams.set("select", "profile,payload,updated_at");
  selectUrl.searchParams.set("profile", `eq.${profile}`);
  selectUrl.searchParams.set("limit", "1");

  const response = await fetch(selectUrl, {
    headers: getSupabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Supabase GET falhou com status ${response.status}.`);
  }

  const rows = await response.json();
  return rows[0] || null;
}

async function saveRemoteState(profile, payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
    method: "POST",
    headers: getSupabaseHeaders({
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify([
      {
        profile,
        payload,
        updated_at: new Date().toISOString(),
      },
    ]),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase POST falhou com status ${response.status}: ${details}`);
  }

  const rows = await response.json();
  return rows[0] || null;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: "Requisição inválida." });
    return;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const requestUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (requestUrl.pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, {
      connected: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
      table: SUPABASE_TABLE,
    });
    return;
  }

  if (requestUrl.pathname === "/api/state" && req.method === "GET") {
    if (!ensureSupabaseConfigured(res)) {
      return;
    }

    try {
      const profile = requestUrl.searchParams.get("profile") || "principal";
      const data = await fetchRemoteState(profile);
      sendJson(res, 200, { connected: true, data });
    } catch (error) {
      sendJson(res, 500, { connected: true, error: error.message });
    }
    return;
  }

  if (requestUrl.pathname === "/api/state" && req.method === "PUT") {
    if (!ensureSupabaseConfigured(res)) {
      return;
    }

    try {
      const body = await readBody(req);
      const profile = body.profile || "principal";
      const payload = body.payload;

      if (!payload || typeof payload !== "object") {
        sendJson(res, 400, { error: "Payload inválido." });
        return;
      }

      const data = await saveRemoteState(profile, payload);
      sendJson(res, 200, { connected: true, data });
    } catch (error) {
      sendJson(res, 500, { connected: true, error: error.message });
    }
    return;
  }

  const relativePath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const resolvedPath = path.normalize(path.join(ROOT, relativePath));

  if (!resolvedPath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Acesso negado." });
    return;
  }

  if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
    sendJson(res, 404, { error: "Arquivo não encontrado." });
    return;
  }

  sendFile(res, resolvedPath);
});

server.listen(PORT, () => {
  console.log(`Servidor local em http://localhost:${PORT}`);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Supabase ainda não configurado. Preencha o arquivo .env.local.");
  }
});
