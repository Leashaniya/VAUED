import mongoose from "mongoose";

const babyProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    babyName: {
      type: String,
      required: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["boy", "girl"],
      required: true,
    },
    dob: {
      type: Date,
      required: true,
    },
    twinLabel: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

babyProfileSchema.index({ userId: 1, createdAt: -1 });

export const BabyProfile = mongoose.model("BabyProfile", babyProfileSchema);

