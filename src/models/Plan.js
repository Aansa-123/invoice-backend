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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

export default mongoose.model("Plan", planSchema)
