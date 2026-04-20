import { Router } from "express";
import mongoose from "mongoose";
import { SensorReading, ALLOWED_SENSOR_IDS } from "../models/sensorReading.js";

const router = Router();

/** Time windows + bucket size (ms) for chart aggregation */
const CHART_RANGES = {
  live: { ms: 15 * 60 * 1000, bucketMs: 30 * 1000 },
  "1h": { ms: 60 * 60 * 1000, bucketMs: 2 * 60 * 1000 },
  "24h": { ms: 24 * 60 * 60 * 1000, bucketMs: 15 * 60 * 1000 },
  week: { ms: 7 * 24 * 60 * 60 * 1000, bucketMs: 6 * 60 * 60 * 1000 },
  month: { ms: 30 * 24 * 60 * 60 * 1000, bucketMs: 24 * 60 * 60 * 1000 },
};

const CHART_MAX_POINTS = 500;

const SENSOR_LABELS = {
  "1": "Temperature",
  "2": "Humidity",
  "3": "Wetness",
  "4": "Sound",
};

function normalizeReading(raw) {
  if (raw == null) return { error: "reading is required (a single number)" };
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return { error: "reading must be a finite number" };
  return { value: n };
}

function readingJson(doc) {
  return {
    id: doc._id,
    sensorId: doc.sensorId,
    reading: doc.reading,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

function parseLimit(raw) {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(n, 200);
}

function parseSkip(raw) {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 100_000);
}

function parseOptionalIso(name, raw) {
  if (raw == null || raw === "") return { ok: true, date: null };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { ok: false, error: `${name} must be a valid ISO 8601 date string` };
  return { ok: true, date: d };
}

/**
 * GET /api/readings
 * Query: sensorId? (only here — optional filter 1–4), from?, to?, limit?, skip?
 * Omit sensorId to list all sensors; or narrow with sensorId without using the path route.
 */
router.get("/", async (req, res) => {
  const { sensorId } = req.query;
  const limit = parseLimit(req.query.limit);
  const skip = parseSkip(req.query.skip);
  const from = parseOptionalIso("from", req.query.from);
  const to = parseOptionalIso("to", req.query.to);
  if (!from.ok) return res.status(400).json({ error: from.error });
  if (!to.ok) return res.status(400).json({ error: to.error });

  const filter = {};
  if (sensorId != null && String(sensorId) !== "") {
    const sid = String(sensorId);
    if (!ALLOWED_SENSOR_IDS.includes(sid)) {
      return res.status(400).json({
        error: `sensorId must be one of: ${ALLOWED_SENSOR_IDS.join(", ")}`,
      });
    }
    filter.sensorId = sid;
  }
  if (from.date || to.date) {
    filter.createdAt = {};
    if (from.date) filter.createdAt.$gte = from.date;
    if (to.date) filter.createdAt.$lte = to.date;
  }

  try {
    const [total, rows] = await Promise.all([
      SensorReading.countDocuments(filter),
      SensorReading.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return res.json({
      total,
      limit,
      skip,
      readings: rows.map((row) =>
        readingJson({
          _id: row._id,
          sensorId: row.sensorId,
          reading: row.reading,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })
      ),
    });
  } catch {
    return res.status(500).json({ error: "Failed to load readings" });
  }
});

/**
 * GET /api/readings/sensors/:sensorId
 * Query: from?, to?, limit?, skip?
 */
router.get("/sensors/:sensorId", async (req, res) => {
  const sid = String(req.params.sensorId ?? "");
  if (!ALLOWED_SENSOR_IDS.includes(sid)) {
    return res.status(400).json({
      error: `sensorId must be one of: ${ALLOWED_SENSOR_IDS.join(", ")}`,
    });
  }
  const limit = parseLimit(req.query.limit);
  const skip = parseSkip(req.query.skip);
  const from = parseOptionalIso("from", req.query.from);
  const to = parseOptionalIso("to", req.query.to);
  if (!from.ok) return res.status(400).json({ error: from.error });
  if (!to.ok) return res.status(400).json({ error: to.error });

  const filter = { sensorId: sid };
  if (from.date || to.date) {
    filter.createdAt = {};
    if (from.date) filter.createdAt.$gte = from.date;
    if (to.date) filter.createdAt.$lte = to.date;
  }

  try {
    const [total, rows] = await Promise.all([
      SensorReading.countDocuments(filter),
      SensorReading.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return res.json({
      total,
      limit,
      skip,
      sensorId: sid,
      readings: rows.map((row) =>
        readingJson({
          _id: row._id,
          sensorId: row.sensorId,
          reading: row.reading,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })
      ),
    });
  } catch {
    return res.status(500).json({ error: "Failed to load readings" });
  }
});

/**
 * GET /api/readings/chart?range=live|1h|24h|week|month&sensorId? (optional 1–4)
 * Returns time-bucketed averages for Recharts: points[{ t, s1..s4 }].
 */
router.get("/chart", async (req, res) => {
  const rangeKey = String(req.query.range ?? "1h");
  const cfg = CHART_RANGES[rangeKey];
  if (!cfg) {
    return res.status(400).json({
      error: `range must be one of: ${Object.keys(CHART_RANGES).join(", ")}`,
    });
  }

  const { sensorId } = req.query;
  let sensorFilter = {};
  if (sensorId != null && String(sensorId) !== "") {
    const sid = String(sensorId);
    if (!ALLOWED_SENSOR_IDS.includes(sid)) {
      return res.status(400).json({
        error: `sensorId must be one of: ${ALLOWED_SENSOR_IDS.join(", ")}`,
      });
    }
    sensorFilter = { sensorId: sid };
  } else {
    sensorFilter = { sensorId: { $in: ALLOWED_SENSOR_IDS } };
  }

  const to = new Date();
  const from = new Date(to.getTime() - cfg.ms);
  const match = { createdAt: { $gte: from, $lte: to }, ...sensorFilter };

  try {
    const bucketMs = cfg.bucketMs;
    const rows = await SensorReading.aggregate([
      { $match: match },
      {
        $addFields: {
          b: {
            $subtract: [
              { $toLong: "$createdAt" },
              { $mod: [{ $toLong: "$createdAt" }, bucketMs] },
            ],
          },
        },
      },
      {
        $group: {
          _id: { sensorId: "$sensorId", b: "$b" },
          v: { $avg: "$reading" },
        },
      },
      {
        $project: {
          _id: 0,
          sensorId: "$_id.sensorId",
          t: { $toDate: "$_id.b" },
          v: 1,
        },
      },
      { $sort: { t: 1 } },
    ]);

    const byTime = new Map();
    for (const row of rows) {
      const key = row.t.getTime();
      if (!byTime.has(key)) {
        byTime.set(key, {
          t: row.t.getTime(),
          s1: null,
          s2: null,
          s3: null,
          s4: null,
        });
      }
      const slot = `s${row.sensorId}`;
      const p = byTime.get(key);
      if (slot in p) p[slot] = Math.round(row.v * 1000) / 1000;
    }

    let points = [...byTime.values()].sort((a, b) => a.t - b.t);

    if (points.length > CHART_MAX_POINTS) {
      const step = Math.ceil(points.length / CHART_MAX_POINTS);
      points = points.filter((_, i) => i % step === 0);
    }

    return res.json({
      range: rangeKey,
      from: from.toISOString(),
      to: to.toISOString(),
      bucketMs,
      labels: SENSOR_LABELS,
      points: points.map((p) => ({
        t: p.t,
        timeISO: new Date(p.t).toISOString(),
        s1: p.s1,
        s2: p.s2,
        s3: p.s3,
        s4: p.s4,
      })),
    });
  } catch {
    return res.status(500).json({ error: "Failed to load chart data" });
  }
});

/**
 * GET /api/readings/current
 * Latest sample per sensor (1–4), always returned in order even if null.
 */
router.get("/current", async (_req, res) => {
  try {
    const rows = await SensorReading.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$sensorId",
          reading: { $first: "$reading" },
          createdAt: { $first: "$createdAt" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const byId = new Map(rows.map((r) => [r._id, r]));
    const sensors = ALLOWED_SENSOR_IDS.map((id) => {
      const row = byId.get(id);
      return {
        sensorId: id,
        label: SENSOR_LABELS[id],
        reading: row != null ? Math.round(row.reading * 1000) / 1000 : null,
        at: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
      };
    });

    return res.json({ labels: SENSOR_LABELS, sensors });
  } catch {
    return res.status(500).json({ error: "Failed to load current readings" });
  }
});

/**
 * GET /api/readings/:id
 * Single document by MongoDB ObjectId.
 */
router.get("/:id", async (req, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "id must be a valid MongoDB ObjectId" });
  }
  try {
    const row = await SensorReading.findById(id).lean();
    if (!row) return res.status(404).json({ error: "Reading not found" });
    return res.json(
      readingJson({
        _id: row._id,
        sensorId: row.sensorId,
        reading: row.reading,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
    );
  } catch {
    return res.status(500).json({ error: "Failed to load reading" });
  }
});

/**
 * POST /api/readings/sensors/:sensorId/batch
 * Body: { readings: number[] } — one document per entry, all for :sensorId
 */
router.post("/sensors/:sensorId/batch", async (req, res) => {
  const sid = String(req.params.sensorId ?? "");
  if (!ALLOWED_SENSOR_IDS.includes(sid)) {
    return res.status(400).json({
      error: `sensorId must be one of: ${ALLOWED_SENSOR_IDS.join(", ")}`,
    });
  }
  const { readings } = req.body ?? {};
  if (!Array.isArray(readings) || readings.length === 0) {
    return res.status(400).json({ error: "body.readings must be a non-empty array of numbers" });
  }

  const docs = [];
  const errors = [];
  for (let i = 0; i < readings.length; i++) {
    const norm = normalizeReading(readings[i]);
    if (norm.error) {
      errors.push({ index: i, error: norm.error });
      continue;
    }
    docs.push({ sensorId: sid, reading: norm.value });
  }

  if (errors.length > 0 && docs.length === 0) {
    return res.status(400).json({ error: "No valid readings", details: errors });
  }

  try {
    const inserted = docs.length ? await SensorReading.insertMany(docs, { ordered: false }) : [];
    const payload = inserted.map((doc) => readingJson(doc));
    return res.status(201).json({
      inserted: payload.length,
      sensorId: sid,
      readings: payload,
      ...(errors.length ? { skipped: errors } : {}),
    });
  } catch {
    return res.status(500).json({ error: "Failed to store batch readings" });
  }
});

/**
 * POST /api/readings/sensors/:sensorId
 * Body: { reading: number }
 */
router.post("/sensors/:sensorId", async (req, res) => {
  const sid = String(req.params.sensorId ?? "");
  if (!ALLOWED_SENSOR_IDS.includes(sid)) {
    return res.status(400).json({
      error: `sensorId must be one of: ${ALLOWED_SENSOR_IDS.join(", ")}`,
    });
  }
  const { reading } = req.body ?? {};
  const norm = normalizeReading(reading);
  if (norm.error) return res.status(400).json({ error: norm.error });

  try {
    const doc = await SensorReading.create({
      sensorId: sid,
      reading: norm.value,
    });
    return res.status(201).json(readingJson(doc));
  } catch {
    return res.status(500).json({ error: "Failed to store reading" });
  }
});

export default router;
