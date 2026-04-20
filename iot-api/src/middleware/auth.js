import jwt from "jsonwebtoken";

export function jwtAuth(req, res, next) {
  const auth = req.get("authorization");
  const token = auth && auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: "Unauthorized: token missing" });

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Server misconfiguration: JWT_SECRET not set" });
  }

  try {
    const payload = jwt.verify(token, secret);
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      name: payload.name || "",
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized: invalid token" });
  }
}

