const http = require("http");
const {
  PORT,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  handleRequest,
} = require("./request-handler");

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Servidor local em http://localhost:${PORT}`);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Supabase ainda nao configurado. Preencha o arquivo .env.local.");
  }
});
