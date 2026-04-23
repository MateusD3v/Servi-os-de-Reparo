const { SUPABASE_URL, getAllowedOrigins } = require("./config");

function getConnectSrcDirective() {
  return ["'self'", "https://cdn.jsdelivr.net", SUPABASE_URL || "https://*.supabase.co"].join(" ");
}

function getSecurityHeaders(req, contentType) {
  const origin = req?.headers?.origin || "";
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

  const allowedOrigins = getAllowedOrigins();
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

module.exports = {
  getSecurityHeaders,
  readBody,
  sendHandledError,
  sendJson,
};
