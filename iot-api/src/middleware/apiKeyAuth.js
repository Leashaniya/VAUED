export function apiKeyAuth(req, res, next) {
  const configured = process.env.API_KEY;
  if (!configured) {
    return res.status(500).json({ error: "Server misconfiguration: API_KEY not set" });
  }

  const headerKey = req.get("x-api-key");
  const auth = req.get("authorization");
  const bearer =
    auth && auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const key = headerKey || bearer;

  if (!key || key !== configured) {
    return res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
  }

  next();
}
