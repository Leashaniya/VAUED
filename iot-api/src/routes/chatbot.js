import { Router } from "express";
import {
  isOffTopicMessage,
  offTopicReply,
  queryGeminiChat,
} from "../services/geminiChatService.js";

const router = Router();

router.post("/query", async (req, res) => {
  const { message, context } = req.body ?? {};
  const prompt = String(message || "").trim();

  if (!prompt) {
    return res.status(400).json({ error: "message is required" });
  }
  if (!context || typeof context !== "object") {
    return res.status(400).json({ error: "context object is required" });
  }

  // Scope guard at the backend before any LLM call.
  if (isOffTopicMessage(prompt)) {
    return res.json({ reply: offTopicReply(), source: "scope_guard" });
  }

  try {
    const reply = await queryGeminiChat({ message: prompt, context });
    return res.json({ reply, source: "gemini" });
  } catch (err) {
    const msg = String(err?.message || "chat service failed");
    if (msg.includes("api key missing")) {
      return res.status(503).json({ error: "chatbot service unavailable" });
    }
    return res.status(502).json({ error: "chatbot provider failed" });
  }
});

export default router;
