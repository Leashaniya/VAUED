import { GoogleGenerativeAI } from "@google/generative-ai";

const OFF_TOPIC_REGEX =
  /\b(joke|jokes|riddle|capital of|france|spain|italy|weather in|nba|football score|movie recommendation|who are you|how are you doing|chatgpt|sing a song|poem about|recipe for|president of)\b/i;

const OFF_TOPIC_REPLY =
  "I’m here to help with your Smart Baby Monitor data, alerts, baby profiles, and analytics.";

const SYSTEM_INSTRUCTION = `You are the Smart Baby Monitor visual analytics assistant.

You must follow these rules:
1) Use only the provided app context JSON. Do not invent values.
2) Keep responses short-to-medium, calm, parent-friendly, and non-medical.
3) If context is insufficient, clearly say what is missing.
4) Stay project-scoped: only Smart Baby Monitor topics (crying, wetness, temperature, danger status, alerts, filters, comparisons, active baby profile).
5) If asked off-topic, politely redirect to Smart Baby Monitor scope.
6) Respect page context:
   - dashboard = live monitoring state
   - analytics = historical filtered trends
   If user asks live questions on analytics, explain Dashboard is live.
   If user asks trend/comparison on dashboard, explain Analytics is for historical trends.
7) For analytics comparison:
   - when comparison.available=true, use comparison.current, comparison.previous, deltas, strongestFactor
   - when comparison.available=false, do not infer numbers; say comparison data is insufficient.
8) Never provide diagnosis or treatment advice; suggest gentle monitoring actions only.`;

function stripMarkdown(text) {
  return String(text)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

function normalizeOutput(raw) {
  const text = stripMarkdown(raw);
  if (!text) return "";
  const compact = text.replace(/\n{3,}/g, "\n\n");
  return compact.length > 1500 ? `${compact.slice(0, 1497)}...` : compact;
}

export function isOffTopicMessage(message) {
  const q = String(message || "").trim().toLowerCase();
  if (!q) return false;
  return OFF_TOPIC_REGEX.test(q);
}

export function offTopicReply() {
  return OFF_TOPIC_REPLY;
}

export async function queryGeminiChat({ message, context }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("gemini api key missing");

  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 12000);

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({ model: modelName });

  const prompt = [
    SYSTEM_INSTRUCTION,
    "",
    "App context (ground truth JSON):",
    JSON.stringify(context ?? {}, null, 2),
    "",
    "User question:",
    String(message || ""),
    "",
    "Respond as plain text only.",
  ].join("\n");

  const res = await Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("gemini timeout")), timeoutMs);
    }),
  ]);

  const text = normalizeOutput(res?.response?.text?.() || "");
  if (!text) throw new Error("empty gemini response");
  return text;
}
