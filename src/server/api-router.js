const { isSupabaseConfigured } = require("./config");
const { readBody, sendHandledError, sendJson } = require("./http");
const {
  fetchRemoteState,
  getAuthenticatedUser,
  getBearerToken,
  getUserProfile,
  requestSupabaseAuth,
  saveRemoteState,
} = require("./supabase");

function ensureSupabaseConfigured(res, req) {
  if (!isSupabaseConfigured()) {
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

async function handleApiRequest(req, res, requestUrl) {
  if (requestUrl.pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, { connected: isSupabaseConfigured() }, req);
    return true;
  }

  if (requestUrl.pathname === "/api/auth/login" && req.method === "POST") {
    await handleLogin(req, res);
    return true;
  }

  if (requestUrl.pathname === "/api/auth/signup" && req.method === "POST") {
    await handleSignup(req, res);
    return true;
  }

  if (
    (requestUrl.pathname === "/api/auth/me" || requestUrl.pathname === "/api/auth/user") &&
    req.method === "GET"
  ) {
    await handleCurrentUser(req, res);
    return true;
  }

  if (requestUrl.pathname === "/api/auth/logout" && req.method === "POST") {
    await handleLogout(req, res);
    return true;
  }

  if (requestUrl.pathname === "/api/remote/check" && req.method === "GET") {
    await handleRemoteCheck(req, res);
    return true;
  }

  if (
    (requestUrl.pathname === "/api/remote/pull" || requestUrl.pathname === "/api/state") &&
    req.method === "GET"
  ) {
    await handleRemotePull(req, res);
    return true;
  }

  if (
    (requestUrl.pathname === "/api/remote/push" && req.method === "POST") ||
    (requestUrl.pathname === "/api/state" && req.method === "PUT")
  ) {
    await handleRemotePush(req, res);
    return true;
  }

  return false;
}

async function handleLogin(req, res) {
  if (!ensureSupabaseConfigured(res, req)) {
    return;
  }

  try {
    const { email, password } = await readCredentials(req);
    const session = await requestSupabaseAuth("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    sendJson(res, 200, { session }, req);
  } catch (error) {
    sendHandledError(res, error, req);
  }
}

async function handleSignup(req, res) {
  if (!ensureSupabaseConfigured(res, req)) {
    return;
  }

  try {
    const { email, password } = await readCredentials(req);
    const session = await requestSupabaseAuth("signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    sendJson(res, 200, { session }, req);
  } catch (error) {
    sendHandledError(res, error, req);
  }
}

async function readCredentials(req) {
  const body = await readBody(req);
  const email = String(body.email || "").trim();
  const password = String(body.password || "");

  if (!email || !password) {
    const error = new Error("Informe email e senha.");
    error.statusCode = 400;
    throw error;
  }

  return { email, password };
}

async function handleCurrentUser(req, res) {
  if (!ensureSupabaseConfigured(res, req)) {
    return;
  }

  try {
    const user = await getAuthenticatedUser(req);
    sendJson(res, 200, { user }, req);
  } catch (error) {
    sendHandledError(res, error, req);
  }
}

async function handleLogout(req, res) {
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
}

async function handleRemoteCheck(req, res) {
  if (!ensureSupabaseConfigured(res, req)) {
    return;
  }

  try {
    const user = await getAuthenticatedUser(req);
    const data = await fetchRemoteState(getUserProfile(user));
    sendJson(res, 200, { ok: true, data }, req);
  } catch (error) {
    sendHandledError(res, error, req);
  }
}

async function handleRemotePull(req, res) {
  if (!ensureSupabaseConfigured(res, req)) {
    return;
  }

  try {
    const user = await getAuthenticatedUser(req);
    const data = await fetchRemoteState(getUserProfile(user));
    sendJson(res, 200, { connected: true, data }, req);
  } catch (error) {
    sendHandledError(res, error, req);
  }
}

async function handleRemotePush(req, res) {
  if (!ensureSupabaseConfigured(res, req)) {
    return;
  }

  try {
    const user = await getAuthenticatedUser(req);
    const body = await readBody(req);
    const payload = body.payload;

    if (!payload || typeof payload !== "object") {
      sendJson(res, 400, { error: "Payload invalido." }, req);
      return;
    }

    const data = await saveRemoteState(getUserProfile(user), payload);
    sendJson(res, 200, { connected: true, data }, req);
  } catch (error) {
    sendHandledError(res, error, req);
  }
}

module.exports = {
  handleApiRequest,
};
