import express from "express"
import Organization from "../models/Organization.js"
import Plan from "../models/Plan.js"
import CompanySettings from "../models/CompanySettings.js"
import { protect } from "../middleware/auth.js"
import pusher from "../utils/pusher.js"

const router = express.Router()

// Get all organizations for current user
router.get("/", protect, async (req, res) => {
  try {
    const orgIds = req.user.organizations.map(o => {
      if (!o.organizationId) return null
      return o.organizationId._id || o.organizationId
    }).filter(id => id !== null)

    const orgs = await Organization.find({
      _id: { $in: orgIds }
    })
    res.status(200).json({
      success: true,
      data: orgs
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create new organization
router.post("/", protect, async (req, res) => {
  try {
    const { name, email, phone, address, currency, taxNumber, logo } = req.body

    if (!name || !email) {
      return res.status(400).json({ error: "Organization name and business email are required" })
    }

    // Find the Free plan
    const freePlan = await Plan.findOne({ name: "Free" })

    // If it's the user's first organization, approve it automatically
    const isFirstOrg = req.user.organizations.length === 0
    const status = isFirstOrg ? "approved" : "pending"

    const org = await Organization.create({
      name,
      email,
      phone,
      address,
      currency: currency || "USD",
      taxNumber,
      logo,
      owner: req.user._id,
      plan: freePlan ? freePlan._id : null,
      status: status,
      subscription: {
        plan: "Free", // Redundant but good for existing logic
        status: "active",
      }
    })

    // Add to user's organizations
    req.user.organizations.push({
      organizationId: org._id,
      role: "Owner"
    })
    
    // Set as current organization
    req.user.currentOrganization = org._id
    await req.user.save()

    // Create or update default settings (using findOneAndUpdate to avoid duplicate key errors)
    await CompanySettings.findOneAndUpdate(
      { organizationId: org._id },
      {
        businessName: name,
        email: email,
        address: address || "",
        phone: phone || ""
      },
      { upsert: true, new: true, runValidators: true }
    )

    // Send notification to admin if it's pending
    if (status === "pending") {
      try {
        await pusher.trigger("admin-channel", "new-org-request", {
          organizationId: org._id,
          name: org.name,
          owner: req.user.name,
          email: org.email,
          message: `New organization request from ${req.user.name}: ${org.name}`
        })
      } catch (pusherErr) {
        console.error("Pusher notification failed", pusherErr)
        // We don't want to fail the whole request just because notification failed
      }
    }

    res.status(201).json({
      success: true,
      data: org
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Switch current organization
router.post("/switch/:id", protect, async (req, res) => {
  try {
    const orgId = req.params.id

    // Check if user belongs to this organization
    const belongs = req.user.organizations.find(o => {
      const orgIdInUser = o.organizationId._id ? o.organizationId._id.toString() : o.organizationId.toString()
      return orgIdInUser === orgId
    })

    if (!belongs) {
      return res.status(403).json({ error: "You do not belong to this organization" })
    }

    req.user.currentOrganization = orgId
    await req.user.save()

    res.status(200).json({
      success: true,
      message: "Organization switched successfully",
      currentOrganization: orgId
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
