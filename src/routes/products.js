import express from "express"
import Product from "../models/Product.js"
import { protect } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"
import { logActivity } from "../services/logger.js"

const router = express.Router()

// Get all products for organization
router.get("/", protect, async (req, res) => {
  try {
    const { category, searchTerm } = req.query
    const query = { organizationId: req.user.currentOrganization }

    if (category && category !== "All") {
      query.category = category
    }

    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { sku: { $regex: searchTerm, $options: "i" } },
      ]
    }

    const products = await Product.find(query).sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get single product
router.get("/:id", protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ error: "Product not found" })
    }

    if (product.organizationId.toString() !== req.user.currentOrganization.toString()) {
      return res.status(403).json({ error: "Not authorized to access this product" })
    }

    res.status(200).json({
      success: true,
      data: product,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create product
router.post("/", protect, authorize("Owner", "Admin"), async (req, res) => {
  try {
    const productData = {
      ...req.body,
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
    }

    const product = await Product.create(productData)

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `Created product ${product.name}`,
      module: "Stock",
      metadata: { productId: product._id }
    })

    res.status(201).json({
      success: true,
      data: product,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Update product
router.put("/:id", protect, authorize("Owner", "Admin"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ error: "Product not found" })
    }

    if (product.organizationId.toString() !== req.user.currentOrganization.toString()) {
      return res.status(403).json({ error: "Not authorized to update this product" })
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `Updated product ${product.name}`,
      module: "Stock",
      metadata: { productId: product._id }
    })

    res.status(200).json({
      success: true,
      data: updatedProduct,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Delete product
router.delete("/:id", protect, authorize("Owner", "Admin"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ error: "Product not found" })
    }

    if (product.organizationId.toString() !== req.user.currentOrganization.toString()) {
      return res.status(403).json({ error: "Not authorized to delete this product" })
    }

    await Product.findByIdAndDelete(req.params.id)

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `Deleted product ${product.name}`,
      module: "Stock",
      metadata: { productName: product.name }
    })

    res.status(200).json({
      success: true,
      data: {},
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
