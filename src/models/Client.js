import mongoose from "mongoose"

const clientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Please provide client name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide client email"],
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Please provide phone number"],
    },
    address: {
      type: String,
      required: [true, "Please provide address"],
    },
  },
  { timestamps: true },
)

export default mongoose.model("Client", clientSchema)
