import mongoose from "mongoose"

const productSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },
    buyingPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: "",
    },
    unitType: {
      type: String,
      default: "pcs",
    },
    baseUnit: {
      type: String,
      default: "pcs",
    },
    packagingUnits: [
      {
        unit: String,
        contains: Number,
      },
    ],
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
  },
  { timestamps: true },
)

export default mongoose.model("Product", productSchema)
