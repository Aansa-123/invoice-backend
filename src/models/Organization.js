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
    subscription: {
      plan: {
        type: String,
        enum: ["Free", "Starter", "Pro", "Business"],
        default: "Free",
      },
      status: {
        type: String,
        enum: ["active", "past_due", "canceled", "incomplete"],
        default: "active",
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
