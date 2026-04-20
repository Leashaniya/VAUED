import mongoose from "mongoose";

const ALLOWED_SENSOR_IDS = ["1", "2", "3", "4"];

const sensorReadingSchema = new mongoose.Schema(
  {
    sensorId: {
      type: String,
      required: true,
      enum: ALLOWED_SENSOR_IDS,
      index: true,
    },
    reading: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

sensorReadingSchema.index({ sensorId: 1, createdAt: -1 });

export const SensorReading = mongoose.model("SensorReading", sensorReadingSchema);
export { ALLOWED_SENSOR_IDS };
