import "dotenv/config";
import os from "node:os";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { apiKeyAuth } from "./src/middleware/apiKeyAuth.js";
import readingsRouter from "./src/routes/readings.js";
import authRouter from "./src/routes/auth.js";
import babyProfilesRouter from "./src/routes/babyProfiles.js";
import chatbotRouter from "./src/routes/chatbot.js";

function hostFromArgv(argv) {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--host") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        return next;
      }
      return "0.0.0.0";
    }
    if (a.startsWith("--host=")) {
      const v = a.slice("--host=".length);
      return v || "0.0.0.0";
    }
  }
  return null;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "512kb" }));

app.get("/health", (_req, res) => {
  const db = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({ ok: true, database: db });
});

app.use("/api/readings", apiKeyAuth, readingsRouter);
app.use("/api/auth", authRouter);
app.use("/api/babies", babyProfilesRouter);
app.use("/api/chatbot", chatbotRouter);

const port = Number(process.env.PORT) || 8888;
const lifecycle = process.env.npm_lifecycle_event;
/** LAN bind only when started via `npm run host` (see package.json). */
const host =
  lifecycle === "host"
    ? hostFromArgv(process.argv) ?? process.env.HOST ?? "0.0.0.0"
    : "127.0.0.1";
const listenAll = host === "0.0.0.0" || host === "::";
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

mongoose
  .connect(uri)
  .then(() => {
    app.listen(port, host, () => {
      const lan = Object.values(os.networkInterfaces())
        .flat()
        .filter((a) => a && !a.internal && (a.family === "IPv4" || a.family === 4))
        .map((a) => a.address);
      if (lifecycle === "host") {
        console.log(`API listening on ${lan.map((ip) => `http://${ip}:${port}`).join(", ")}`);
      } else {
        console.log(`API listening on http://${host}:${port}`);
      }
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
