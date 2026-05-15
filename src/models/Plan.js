import mongoose from "mongoose"

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a plan name"],
      unique: true,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Please provide a price"],
      default: 0,
    },
    type: {
      type: String,
      enum: ["Free", "Monthly", "Yearly", "Lifetime"],
      required: true,
      default: "Monthly",
    },
    isRecommended: {
      type: Boolean,
      default: false,
    },
    durationDays: {
      type: Number, // Number of days for the plan (30, 365, or a large number for lifetime)
      required: true,
    },
    clientLimit: {
      type: Number, // -1 for unlimited
      required: true,
    },
    invoiceLimit: {
      type: Number, // -1 for unlimited
      required: true,
    },
    features: [String],
    isRecommended: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isRecommended: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
)

export default mongoose.model("Plan", planSchema)
