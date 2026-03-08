import express from "express"
import multer from "multer"
import cloudinary from "../config/cloudinary.js"
import CompanySettings from "../models/CompanySettings.js"
import { protect } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"
import { logActivity } from "../services/logger.js"

const router = express.Router()

// Multer config for memory storage
const storage = multer.memoryStorage()
const upload = multer({ storage })

// Upload logo
router.post("/logo", protect, authorize("Owner", "Admin"), upload.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload a file" })
    }

    // Convert buffer to base64
    const fileStr = req.file.buffer.toString("base64")
    const fileType = req.file.mimetype
    
    const uploadResponse = await cloudinary.uploader.upload(`data:${fileType};base64,${fileStr}`, {
      folder: "invoice_logos",
    })

    res.status(200).json({
      success: true,
      url: uploadResponse.secure_url,
    })
  } catch (error) {
    console.error("Cloudinary upload error:", error)
    res.status(500).json({ error: "Failed to upload image" })
  }
})

// Get company settings
router.get("/", protect, async (req, res) => {
  try {
    const settings = await CompanySettings.findOne({ organizationId: req.user.currentOrganization })

    if (!settings) {
      return res.status(404).json({ error: "Settings not found for this organization" })
    }

    res.status(200).json({
      success: true,
      data: settings,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update company settings
router.put("/", protect, authorize("Owner", "Admin"), async (req, res) => {
  try {
    let settings = await CompanySettings.findOne({ organizationId: req.user.currentOrganization })

    if (!settings) {
      settings = await CompanySettings.create({
        organizationId: req.user.currentOrganization,
        ...req.body,
      })
    } else {
      Object.assign(settings, req.body)
      await settings.save()
    }

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: "Updated company settings",
      module: "Settings"
    })

    res.status(200).json({
      success: true,
      data: settings,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
