import mongoose from "mongoose"

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide an organization name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide a business email"],
      lowercase: true,
    },
    phone: String,
    address: String,
    currency: {
      type: String,
      default: "USD",
    },
    taxNumber: String,
    logo: String,
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
    },
    subscription: {
      status: {
        type: String,
        enum: ["active", "past_due", "canceled", "incomplete", "grace_period", "expired"],
        default: "active",
      },
      plan: {
        type: String,
        default: "Free",
      },
      end: Date,
      graceDays: {
        type: Number,
        default: 0,
      },
      stripeCustomerId: String,
      stripeSubscriptionId: String,
    },
    settings: {
      logo: String,
      address: String,
      phone: String,
      email: String,
    },
  },
  { timestamps: true },
)

export default mongoose.model("Organization", organizationSchema)
