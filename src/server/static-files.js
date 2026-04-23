const fs = require("fs");
const path = require("path");

const { ROOT } = require("./config");
const { getSecurityHeaders, sendJson } = require("./http");

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

const PUBLIC_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".css",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".ico",
  ".webmanifest",
  ".txt",
]);

const PRIVATE_FILENAMES = new Set(["server.js", "request-handler.js"]);

function handleStaticRequest(req, res, requestUrl) {
  const staticPath =
    requestUrl.pathname === "/favicon.ico" || requestUrl.pathname === "/favicon.png"
      ? "/favicon.svg"
      : requestUrl.pathname;
  const relativePath = staticPath === "/" ? "/index.html" : staticPath;
  const resolvedPath = path.resolve(ROOT, `.${relativePath}`);

  if (!isPublicFile(resolvedPath)) {
    sendJson(res, 403, { error: "Acesso negado." }, req);
    return;
  }

  if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
    sendJson(res, 404, { error: "Arquivo nao encontrado." }, req);
    return;
  }

  sendFile(req, res, resolvedPath);
}

function isPublicFile(resolvedPath) {
  const normalizedRoot = `${ROOT}${path.sep}`;
  const extension = path.extname(resolvedPath).toLowerCase();
  const filename = path.basename(resolvedPath);

  if (!resolvedPath.startsWith(normalizedRoot) || !PUBLIC_EXTENSIONS.has(extension)) {
    return false;
  }

  return !(
    resolvedPath.endsWith(".env") ||
    resolvedPath.endsWith(".env.local") ||
    resolvedPath.includes(`${path.sep}node_modules${path.sep}`) ||
    resolvedPath.includes(`${path.sep}src${path.sep}server${path.sep}`) ||
    PRIVATE_FILENAMES.has(filename)
  );
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

module.exports = {
  handleStaticRequest,
};
