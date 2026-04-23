const { PORT, SUPABASE_AUTH_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } = require("./src/server/config");
const { sendJson } = require("./src/server/http");
const { handleApiRequest } = require("./src/server/api-router");
const { handleStaticRequest } = require("./src/server/static-files");

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

  if (await handleApiRequest(req, res, requestUrl)) {
    return;
  }

  handleStaticRequest(req, res, requestUrl);
}

module.exports = {
  PORT,
  SUPABASE_AUTH_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  handleRequest,
  handler: process.env.VERCEL ? handleRequest : null,
};
