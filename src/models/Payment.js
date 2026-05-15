import mongoose from "mongoose"

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    amount: {
      type: Number,
      required: [true, "Please provide payment amount"],
    },
    paymentMethod: {
      type: String,
      required: [true, "Please provide payment method"],
      enum: ["Cash", "Bank Transfer", "Credit Card", "Cheque", "Wallet", "Other"],
    },
    transactionId: {
      type: String,
      trim: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Completed", "Pending", "Failed", "Refunded"],
      default: "Completed",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
)

export default mongoose.model("Payment", paymentSchema)
