import express from "express"
import ActivityLog from "../models/ActivityLog.js"
import { protect } from "../middleware/auth.js"

const router = express.Router()

// Get all activity logs for organization
router.get("/", protect, async (req, res) => {
  try {
    const logs = await ActivityLog.find({ organizationId: req.user.currentOrganization })
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(100) // Limit to last 100 for performance

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
