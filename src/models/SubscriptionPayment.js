import mongoose from "mongoose"

const subscriptionPaymentSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "success", // Set default to success as requested for now
    },
    paymentMethod: {
      type: String,
      enum: ["Stripe", "Bank Transfer", "Manual Payment"],
      default: "Manual Payment",
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    transactionId: {
      type: String,
      sparse: true,
    },
    screenshot: {
      type: String,
    },
  },
  { timestamps: true },
)

export default mongoose.model("SubscriptionPayment", subscriptionPaymentSchema)
