import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/user.js";
import { jwtAuth } from "../middleware/auth.js";

const router = Router();

function routeError(res, scope, fallbackMessage, err) {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[auth] ${scope}:`, detail);
  return res.status(500).json({
    error: fallbackMessage,
    ...(process.env.NODE_ENV === "production" ? {} : { detail }),
  });
}

function issueToken(user) {
  const secret = process.env.JWT_SECRET;
  return jwt.sign(
    {
      email: user.email,
      name: user.name || "",
    },
    secret,
    { subject: String(user._id), expiresIn: "7d" }
  );
}

function sanitizeUser(user) {
  return {
    id: String(user._id),
    name: user.name || "",
    email: user.email,
    createdAt: user.createdAt,
  };
}

router.post("/register", async (req, res) => {
  const { name = "", email, password } = req.body ?? {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const plain = String(password || "");
  if (!normalizedEmail || !plain) {
    return res.status(400).json({ error: "email and password are required" });
  }
  if (plain.length < 6) {
    return res.status(400).json({ error: "password must be at least 6 characters" });
  }

  try {
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) return res.status(409).json({ error: "email already registered" });

    const passwordHash = await bcrypt.hash(plain, 10);
    const user = await User.create({
      name: String(name || "").trim(),
      email: normalizedEmail,
      passwordHash,
    });
    const token = issueToken(user);
    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    return routeError(res, "POST /register", "failed to register user", err);
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const plain = String(password || "");
  if (!normalizedEmail || !plain) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ error: "invalid email or password" });

    const ok = await bcrypt.compare(plain, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid email or password" });

    const token = issueToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    return routeError(res, "POST /login", "failed to login", err);
  }
});

router.get("/me", jwtAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.userId).lean();
    if (!user) return res.status(404).json({ error: "user not found" });
    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    return routeError(res, "GET /me", "failed to load current user", err);
  }
});

export default router;

