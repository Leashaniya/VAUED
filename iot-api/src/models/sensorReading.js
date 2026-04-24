import mongoose from "mongoose";

// 1=temp, 2=humidity, 3=wetness, 4=sound, 5=LDR1, 6=LDR2
const ALLOWED_SENSOR_IDS = ["1", "2", "3", "4", "5", "6"];

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