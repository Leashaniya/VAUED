import { Router } from "express";
import mongoose from "mongoose";
import { jwtAuth } from "../middleware/auth.js";
import { BabyProfile } from "../models/babyProfile.js";

const router = Router();

function serialize(doc) {
  return {
    id: String(doc._id),
    userId: String(doc.userId),
    babyName: doc.babyName,
    gender: doc.gender,
    dob: new Date(doc.dob).toISOString().slice(0, 10),
    twinLabel: doc.twinLabel || "",
    isActive: Boolean(doc.isActive),
    createdAt: doc.createdAt,
  };
}

router.use(jwtAuth);

// Profiles are always scoped by authenticated userId for data isolation.
router.get("/", async (req, res) => {
  try {
    const rows = await BabyProfile.find({ userId: req.auth.userId }).sort({ createdAt: -1 }).lean();
    return res.json({ babies: rows.map(serialize) });
  } catch {
    return res.status(500).json({ error: "failed to load baby profiles" });
  }
});

router.post("/", async (req, res) => {
  const { babyName, gender, dob, twinLabel = "" } = req.body ?? {};
  const name = String(babyName || "").trim();
  const g = String(gender || "").toLowerCase();
  const d = new Date(dob);
  if (!name) return res.status(400).json({ error: "babyName is required" });
  if (!["boy", "girl"].includes(g)) return res.status(400).json({ error: "gender must be boy or girl" });
  if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "dob must be a valid date" });

  try {
    const existingCount = await BabyProfile.countDocuments({ userId: req.auth.userId });
    const baby = await BabyProfile.create({
      userId: req.auth.userId,
      babyName: name,
      gender: g,
      dob: d,
      twinLabel: String(twinLabel || "").trim(),
      isActive: existingCount === 0,
    });
    return res.status(201).json({ baby: serialize(baby) });
  } catch {
    return res.status(500).json({ error: "failed to create baby profile" });
  }
});

router.patch("/:id/activate", async (req, res) => {
  const id = String(req.params.id || "");
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "invalid baby profile id" });

  try {
    const target = await BabyProfile.findOne({ _id: id, userId: req.auth.userId });
    if (!target) return res.status(404).json({ error: "baby profile not found" });

    await BabyProfile.updateMany({ userId: req.auth.userId, isActive: true }, { $set: { isActive: false } });
    target.isActive = true;
    await target.save();
    return res.json({ baby: serialize(target) });
  } catch {
    return res.status(500).json({ error: "failed to activate baby profile" });
  }
});

export default router;

