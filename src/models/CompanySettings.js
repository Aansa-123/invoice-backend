import mongoose from "mongoose"

const companySettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
  },
  { timestamps: true },
)

export default mongoose.model("CompanySettings", companySettingsSchema)
