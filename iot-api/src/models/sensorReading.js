import mongoose from "mongoose";

// Add the new sensor ID for baby safe/unsafe status
const ALLOWED_SENSOR_IDS = ["1", "2", "3", "4", "5"]; // Added "5" for baby safe/unsafe status

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
    // New field to store the baby safe/unsafe status when the sensorId is "5"
    status: {
      type: Boolean,  // true = safe, false = unsafe
      required: function() { return this.sensorId === "5"; }, // Only required when the sensorId is "5"
      default: true, // Assuming the default is safe (true)
    },
  },
  { timestamps: true }
);

// Maintain the index on sensorId and createdAt
sensorReadingSchema.index({ sensorId: 1, createdAt: -1 });

export const SensorReading = mongoose.model("SensorReading", sensorReadingSchema);
export { ALLOWED_SENSOR_IDS };