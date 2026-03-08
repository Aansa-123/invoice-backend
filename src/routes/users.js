import express from "express"
import User from "../models/User.js"
import { protect } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"
import { logActivity } from "../services/logger.js"

const router = express.Router()

// Get all team members for organization
router.get("/team", protect, async (req, res) => {
  try {
    const orgId = req.user.currentOrganization

    // Find all users who are part of this organization
    const users = await User.find({
      "organizations.organizationId": orgId
    })

    const team = users.map(user => {
      const orgInfo = user.organizations.find(
        o => o.organizationId.toString() === orgId.toString()
      )
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: orgInfo.role,
        status: user.status || "Active"
      }
    })

    res.status(200).json({
      success: true,
      data: team
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Invite / Add team member
router.post("/invite", protect, authorize("Owner", "Admin"), async (req, res) => {
  try {
    const { name, email, role, password } = req.body
    const orgId = req.user.currentOrganization

    // 1. Check if user already exists
    let user = await User.findOne({ email })

    if (user) {
      // Check if user is already in this organization
      const isMember = user.organizations.some(
        o => o.organizationId.toString() === orgId.toString()
      )

      if (isMember) {
        return res.status(400).json({ error: "User is already a member of this organization" })
      }

      // Add organization to existing user
      user.organizations.push({ organizationId: orgId, role })
      await user.save()
    } else {
      // 2. Create new user
      user = await User.create({
        name,
        email,
        password, // Owner sets initial password
        organizations: [{ organizationId: orgId, role }],
        currentOrganization: orgId
      })
    }

    // In a real app, you would send an email here with the password
    console.log(`Team invitation: ${email} has been invited as ${role} with password: ${password}`)

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `Invited new team member: ${name}`,
      module: "Team",
      details: `Role: ${role}`,
      metadata: { invitedUserId: user._id, role }
    })

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: role,
        status: "Active"
      }
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Toggle member status (Enable/Disable)
router.patch("/:id/status", protect, authorize("Owner", "Admin"), async (req, res) => {
  try {
    const { status } = req.body
    const memberId = req.params.id

    if (!["Active", "Disabled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" })
    }

    const user = await User.findById(memberId)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // Don't allow disabling yourself
    if (memberId.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: "You cannot disable yourself" })
    }

    user.status = status
    await user.save()

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `${status === "Active" ? "Enabled" : "Disabled"} team member: ${user.name}`,
      module: "Team",
      metadata: { memberId, status }
    })

    res.status(200).json({
      success: true,
      message: `Member ${status === "Active" ? "enabled" : "disabled"} successfully`
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update member details
router.put("/:id", protect, authorize("Owner", "Admin"), async (req, res) => {
  try {
    const { name, role, password } = req.body
    const memberId = req.params.id
    const orgId = req.user.currentOrganization

    const user = await User.findById(memberId)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    if (name) user.name = name
    if (password) user.password = password

    if (role) {
      const orgInfo = user.organizations.find(o => o.organizationId.toString() === orgId.toString())
      if (orgInfo) {
        orgInfo.role = role
      }
    }

    await user.save()

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `Updated member details: ${user.name}`,
      module: "Team",
      metadata: { memberId, updatedFields: { name, role, hasPassword: !!password } }
    })

    res.status(200).json({
      success: true,
      message: "Member updated successfully",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: role || (user.organizations.find(o => o.organizationId.toString() === orgId.toString())?.role),
        status: user.status
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Remove member (Owner/Admin only)
router.delete("/:id", protect, authorize("Owner", "Admin"), async (req, res) => {
  try {
    const memberId = req.params.id
    const orgId = req.user.currentOrganization

    const user = await User.findById(memberId)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // Don't allow removing yourself
    if (memberId.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: "You cannot remove yourself" })
    }

    // Check if the member is an Owner
    const memberOrg = user.organizations.find(o => o.organizationId.toString() === orgId.toString())
    if (memberOrg.role === "Owner" && req.user.organizations.find(o => o.organizationId.toString() === orgId.toString()).role !== "Owner") {
       return res.status(403).json({ error: "Only owners can remove other owners" })
    }

    // Remove the organization from the user's organizations array
    user.organizations = user.organizations.filter(
      o => o.organizationId.toString() !== orgId.toString()
    )

    // If it was their current organization, clear it or set to another one
    if (user.currentOrganization && user.currentOrganization.toString() === orgId.toString()) {
      user.currentOrganization = user.organizations.length > 0 ? user.organizations[0].organizationId : null
    }

    await user.save()

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `Removed team member: ${user.name}`,
      module: "Team",
      metadata: { removedUserId: memberId }
    })

    res.status(200).json({
      success: true,
      data: {}
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
