const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3010);

loadEnvFile(path.join(ROOT, ".env.local"));

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_AUTH_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "finance_app_state";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
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

const authAttempts = new Map();

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getConnectSrcDirective() {
  return ["'self'", "https://cdn.jsdelivr.net", SUPABASE_URL || "https://*.supabase.co"].join(" ");
}

function getSecurityHeaders(req, contentType) {
  const origin = req?.headers?.origin || "";
  const allowedOrigins = getAllowedOrigins();
  const headers = {
    "Content-Type": contentType,
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src " +
      getConnectSrcDirective(),
  };

  if (contentType.startsWith("application/json")) {
    headers["Cache-Control"] = "no-store";
  }

  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }

  return headers;
}

function sendJson(res, statusCode, payload, req) {
  res.writeHead(statusCode, getSecurityHeaders(req, "application/json; charset=utf-8"));
  res.end(JSON.stringify(payload));
}

function sendFile(req, res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 500, { error: "Falha ao ler arquivo." }, req);
      return;
    }
    res.writeHead(200, getSecurityHeaders(req, contentType));
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

function ensureSupabaseConfigured(res, req) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_AUTH_KEY) {
    sendJson(
      res,
      503,
      {
        connected: false,
        error: "Supabase nao configurado no servidor.",
      },
      req
    );
    return false;
  }
  return true;
}



function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function getUserProfile(user) {
  return `user:${user.id}`;
}

function getAuthHeaders(accessToken = SUPABASE_AUTH_KEY) {
  return {
    apikey: SUPABASE_AUTH_KEY,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function formatAuthErrorMessage(rawMessage = "") {
  if (/email not confirmed/i.test(rawMessage)) {
    return "Email ainda nao confirmado. Se essa conta foi criada antes da liberacao automatica, apague o usuario no Supabase e cadastre novamente pelo sistema.";
  }

  if (/invalid login credentials/i.test(rawMessage)) {
    return "Email ou senha incorretos.";
  }

  if (/user already registered/i.test(rawMessage)) {
    return "Ja existe uma conta com este email. Tente entrar.";
  }

  if (/password should be at least/i.test(rawMessage)) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }

  if (/signup is disabled/i.test(rawMessage)) {
    return "O cadastro esta desabilitado no momento.";
  }

  return rawMessage;
}

async function requestSupabaseAuth(endpoint, options = {}, accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(accessToken),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  if (!response.ok) {
    const rawMessage =
      data.error_description ||
      data.msg ||
      data.error ||
      `Supabase Auth falhou com status ${response.status}.`;
    const error = new Error(formatAuthErrorMessage(rawMessage));
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

async function requestSupabaseAdminAuth(endpoint, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    ...options,
    headers: {
      ...getSupabaseHeaders(),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!response.ok) {
    const message =
      data.error_description ||
      data.msg ||
      data.error ||
      `Supabase Admin Auth falhou com status ${response.status}.`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

async function getAuthenticatedUser(req) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    const error = new Error("Login obrigatorio.");
    error.statusCode = 401;
    throw error;
  }

  try {
    return await requestSupabaseAuth("user", { method: "GET" }, accessToken);
  } catch (error) {
    error.statusCode = 401;
    throw error;
  }
}

function sendHandledError(res, error, req) {
  sendJson(
    res,
    error.statusCode || 500,
    {
      connected: true,
      error: error.message,
    },
    req
  );
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

async function handleRequest(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true }, req);
    return;
  }

  if (!req.url) {
    sendJson(res, 400, { error: "Requisicao invalida." }, req);
    return;
  }

  const requestUrl = new URL(req.url, `http://localhost:${PORT}`);

  // Rate Limiting for Auth
  const isAuthRequest =
    requestUrl.pathname === "/api/auth/login" || requestUrl.pathname === "/api/auth/signup";
  if (isAuthRequest && req.method === "POST") {
    const ip =
      String(req.headers["x-forwarded-for"] || req.connection.remoteAddress || "0.0.0.0")
        .split(",")[0]
        .trim() || "0.0.0.0";
    const now = Date.now();
    const attempts = authAttempts.get(ip) || [];
    const recentAttempts = attempts.filter((t) => now - t < 60000); // 1 minute window

    if (recentAttempts.length >= 5) {
      sendJson(res, 429, { error: "Muitas tentativas. Tente novamente em 1 minuto." }, req);
      return;
    }
    recentAttempts.push(now);
    authAttempts.set(ip, recentAttempts);
  }

  if (requestUrl.pathname === "/api/health" && req.method === "GET") {
    sendJson(
      res,
      200,
      {
        connected: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_AUTH_KEY),
      },
      req
    );
    return;
  }

  if (requestUrl.pathname === "/api/auth/login" && req.method === "POST") {
    if (!ensureSupabaseConfigured(res, req)) {
      return;
    }

    try {
      const body = await readBody(req);
      const email = String(body.email || "").trim();
      const password = String(body.password || "");
      if (!email || !password) {
        sendJson(res, 400, { error: "Informe email e senha." }, req);
        return;
      }

      const session = await requestSupabaseAuth("token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      sendJson(res, 200, { session }, req);
    } catch (error) {
      sendHandledError(res, error, req);
    }
    return;
  }

  if (requestUrl.pathname === "/api/auth/signup" && req.method === "POST") {
    if (!ensureSupabaseConfigured(res, req)) {
      return;
    }

    try {
      const body = await readBody(req);
      const email = String(body.email || "").trim();
      const password = String(body.password || "");
      if (!email || !password) {
        sendJson(res, 400, { error: "Informe email e senha." }, req);
        return;
      }

      const session = await requestSupabaseAuth("signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });
      sendJson(res, 200, { session }, req);
    } catch (error) {
      sendHandledError(res, error, req);
    }
    return;
  }

  if (
    (requestUrl.pathname === "/api/auth/me" || requestUrl.pathname === "/api/auth/user") &&
    req.method === "GET"
  ) {
    if (!ensureSupabaseConfigured(res, req)) {
      return;
    }

    try {
      const user = await getAuthenticatedUser(req);
      sendJson(res, 200, { user }, req);
    } catch (error) {
      sendHandledError(res, error, req);
    }
    return;
  }

  if (requestUrl.pathname === "/api/auth/logout" && req.method === "POST") {
    if (!ensureSupabaseConfigured(res, req)) {
      return;
    }

    try {
      const accessToken = getBearerToken(req);
      if (accessToken) {
        await requestSupabaseAuth("logout", { method: "POST" }, accessToken);
      }
      sendJson(res, 200, { ok: true }, req);
    } catch (error) {
      sendHandledError(res, error, req);
    }
    return;
  }

  if (requestUrl.pathname === "/api/remote/check" && req.method === "GET") {
    if (!ensureSupabaseConfigured(res, req)) {
      return;
    }

    try {
      const user = await getAuthenticatedUser(req);
      const profile = getUserProfile(user);
      const data = await fetchRemoteState(profile);
      sendJson(res, 200, { ok: true, data }, req);
    } catch (error) {
      sendHandledError(res, error, req);
    }
    return;
  }

  if (
    (requestUrl.pathname === "/api/remote/pull" || requestUrl.pathname === "/api/state") &&
    req.method === "GET"
  ) {
    if (!ensureSupabaseConfigured(res, req)) {
      return;
    }

    try {
      const user = await getAuthenticatedUser(req);
      const profile = getUserProfile(user);
      const data = await fetchRemoteState(profile);
      sendJson(res, 200, { connected: true, data }, req);
    } catch (error) {
      sendHandledError(res, error, req);
    }
    return;
  }

  if (
    (requestUrl.pathname === "/api/remote/push" && req.method === "POST") ||
    (requestUrl.pathname === "/api/state" && req.method === "PUT")
  ) {
    if (!ensureSupabaseConfigured(res, req)) {
      return;
    }

    try {
      const user = await getAuthenticatedUser(req);
      const body = await readBody(req);
      const profile = getUserProfile(user);
      const payload = body.payload;

      if (!payload || typeof payload !== "object") {
        sendJson(res, 400, { error: "Payload invalido." }, req);
        return;
      }

      const data = await saveRemoteState(profile, payload);
      sendJson(res, 200, { connected: true, data }, req);
    } catch (error) {
      sendHandledError(res, error, req);
    }
    return;
  }

  const staticPath =
    requestUrl.pathname === "/favicon.ico" || requestUrl.pathname === "/favicon.png"
      ? "/favicon.svg"
      : requestUrl.pathname;
  const relativePath = staticPath === "/" ? "/index.html" : staticPath;
  const resolvedPath = path.normalize(path.join(ROOT, relativePath));

  // Security: Prevent path traversal and restrict allowed files
  const allowedExtensions = [".html", ".js", ".css", ".svg", ".png", ".jpg", ".jpeg", ".ico", ".webmanifest", ".txt"];
  const isAllowedFile = allowedExtensions.includes(path.extname(resolvedPath));
  const isSensitiveFile =
    resolvedPath.endsWith(".env") ||
    resolvedPath.endsWith(".env.local") ||
    resolvedPath.includes("node_modules") ||
    path.basename(resolvedPath) === "server.js" ||
    path.basename(resolvedPath) === "request-handler.js";

  if (!resolvedPath.startsWith(ROOT) || !isAllowedFile || isSensitiveFile) {
    sendJson(res, 403, { error: "Acesso negado." }, req);
    return;
  }

  if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
    sendJson(res, 404, { error: "Arquivo nao encontrado." }, req);
    return;
  }

  sendFile(req, res, resolvedPath);
}

module.exports = {
  PORT,
  SUPABASE_AUTH_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  handleRequest,
  handler: process.env.VERCEL ? handleRequest : null,
};
