import mongoose from "mongoose"

const companySettingsSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    businessName: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: false,
    },
    phone: {
      type: String,
      required: false,
    },
    email: {
      type: String,
    },
    logo: {
      type: String,
      default: null,
    },
    // Invoice Settings
    currency: {
      type: String,
      default: "USD",
    },
    taxPercentage: {
      type: Number,
      default: 0,
    },
    invoicePrefix: {
      type: String,
      default: "INV",
    },
    paymentTerms: {
      type: String,
      default: "Due on Receipt",
    },
    defaultNotes: {
      type: String,
      default: "",
    },
    categories: {
      type: [String],
      default: ["General"],
    },
  },
  { timestamps: true },
)

export default mongoose.model("CompanySettings", companySettingsSchema)
