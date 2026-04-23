const { SUPABASE_AUTH_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_TABLE, SUPABASE_URL } = require("./config");

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function getUserProfile(user) {
  return `user:${user.id}`;
}

function getSupabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
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

module.exports = {
  fetchRemoteState,
  getAuthenticatedUser,
  getBearerToken,
  getUserProfile,
  requestSupabaseAuth,
  saveRemoteState,
};
