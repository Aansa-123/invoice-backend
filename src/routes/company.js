import express from "express"
import CompanySettings from "../models/CompanySettings.js"
import { protect } from "../middleware/auth.js"

const router = express.Router()

// Get company settings
router.get("/", protect, async (req, res) => {
  try {
    const settings = await CompanySettings.findOne({ userId: req.user.id })

    if (!settings) {
      return res.status(404).json({ error: "Settings not found" })
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
router.put("/", protect, async (req, res) => {
  try {
    let settings = await CompanySettings.findOne({ userId: req.user.id })

    if (!settings) {
      settings = await CompanySettings.create({
        userId: req.user.id,
        ...req.body,
      })
    } else {
      Object.assign(settings, req.body)
      await settings.save()
    }

    res.status(200).json({
      success: true,
      data: settings,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
