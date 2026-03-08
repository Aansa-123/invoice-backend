import express from "express"
import Organization from "../models/Organization.js"
import CompanySettings from "../models/CompanySettings.js"
import { protect } from "../middleware/auth.js"

const router = express.Router()

// Get all organizations for current user
router.get("/", protect, async (req, res) => {
  try {
    const orgs = await Organization.find({
      _id: { $in: req.user.organizations.map(o => o.organizationId) }
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

    const org = await Organization.create({
      name,
      email,
      phone,
      address,
      currency: currency || "USD",
      taxNumber,
      logo,
      owner: req.user._id
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
    const belongs = req.user.organizations.find(
      o => o.organizationId.toString() === orgId
    )

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
