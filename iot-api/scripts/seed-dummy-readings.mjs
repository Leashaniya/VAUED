import "dotenv/config";
import mongoose from "mongoose";
import { SensorReading, ALLOWED_SENSOR_IDS } from "../src/models/sensorReading.js";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

function rnd(min, max) {
  return min + Math.random() * (max - min);
}

const perSensor = Number(process.env.SEED_PER_SENSOR) || 5;

await mongoose.connect(uri);

const docs = [];
for (const sensorId of ALLOWED_SENSOR_IDS) {
  for (let i = 0; i < perSensor; i++) {
    docs.push({
      sensorId,
      reading: Math.round(rnd(18, 32) * 10) / 10,
    });
  }
}

const inserted = await SensorReading.insertMany(docs, { ordered: true });
console.log(`Inserted ${inserted.length} dummy readings (${perSensor} per sensor ${ALLOWED_SENSOR_IDS.join(", ")})`);

await mongoose.disconnect();
