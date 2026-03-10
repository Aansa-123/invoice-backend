import express from "express"
import User from "../models/User.js"
import jwt from "jsonwebtoken"
import CompanySettings from "../models/CompanySettings.js"
import Organization from "../models/Organization.js"
import { protect } from "../middleware/auth.js"

const router = express.Router()

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  })
}

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, businessName } = req.body

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Please provide all required fields" })
    }

    // Check if user exists
    let user = await User.findOne({ email })
    if (user) {
      return res.status(400).json({ error: "Email already exists" })
    }

    // Determine role (check against .env admin credentials)
    let role = "User"
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      role = "Admin"
    }

    // Create user
    user = await User.create({
      name,
      email,
      password,
      role,
    })

    const token = generateToken(user._id)

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        currentOrganization: null,
      },
      redirect: "/setup"
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "Please provide email and password" })
    }

    // Check for user
    let user = await User.findOne({ email }).select("+password").populate("currentOrganization")

    // If user not found and matches admin credentials, create it
    if (!user && email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      user = await User.create({
        name: "Administrator",
        email,
        password,
        role: "Admin",
      })
      // Re-fetch to get all fields correctly
      user = await User.findById(user._id).select("+password").populate("currentOrganization")
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Check if user is disabled
    if (user.status === "Disabled") {
      return res.status(403).json({ error: "Your account has been disabled. Please contact your administrator." })
    }

    // Check if organization subscription is disabled (only for non-Admins)
    if (user.role !== "Admin" && user.currentOrganization?.subscription?.status === "disabled") {
      return res.status(403).json({ error: "Subscription disabled by admin. Contact support." })
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password)

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const token = generateToken(user._id)

    // Find role for current organization
    let role = "Owner" // Default for new users
    if (user.currentOrganization && user.organizations) {
      const membership = user.organizations.find(
        (o) => o.organizationId?.toString() === user.currentOrganization.toString()
      )
      if (membership) role = membership.role
    } else if (user.organizations && user.organizations.length > 0) {
      role = user.organizations[0].role
    }

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        currentOrganization: user.currentOrganization,
        role: user.role,
        orgRole: role,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get current user
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({ error: "Not authorized" })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    let user = await User.findById(decoded.id).populate("organizations.organizationId")

    if (!user) {
      return res.status(401).json({ error: "User not found" })
    }

    // Populate current organization manually to ensure it's fresh
    if (user.currentOrganization) {
      user.currentOrganization = await Organization.findById(user.currentOrganization)
    } else if (user.organizations && user.organizations.length > 0) {
      user.currentOrganization = await Organization.findById(user.organizations[0].organizationId._id || user.organizations[0].organizationId)
    }

    // Check if organization subscription is disabled (only for non-Admins)
    if (user.role !== "Admin" && user.currentOrganization?.subscription?.status === "disabled") {
      return res.status(403).json({ error: "Subscription disabled by admin. Contact support." })
    }

    let role = "Owner"
    if (user.currentOrganization && user.organizations) {
      const membership = user.organizations.find(
        (o) => o.organizationId?.toString() === user.currentOrganization._id.toString()
      )
      if (membership) role = membership.role
    } else if (user.organizations && user.organizations.length > 0) {
      role = user.organizations[0].role
    }

    const planName = user.currentOrganization?.subscription?.plan || "Free"
    const subscriptionEnd = user.currentOrganization?.subscription?.end
    const subscriptionStatus = user.currentOrganization?.subscription?.status
    
    let currentPlan = planName
    let isExpired = false
    
    // If plan is not Free and status is active, check if it has expired
    if (planName !== "Free" && subscriptionStatus === "active" && subscriptionEnd && new Date(subscriptionEnd) < new Date()) {
      currentPlan = "Free"
      isExpired = true

      // Update organization status to expired
      if (user.currentOrganization) {
        await Organization.findByIdAndUpdate(user.currentOrganization._id, {
          "subscription.status": "expired"
        })
      }
    } else if (subscriptionStatus !== "active" && planName !== "Free") {
      // If status is not active (e.g., canceled, expired, past_due), revert to Free
      currentPlan = "Free"
    }

    res.status(200).json({
      success: true,
      user: {
        ...user.toObject(),
        role: user.role,
        orgRole: role,
        plan: currentPlan,
        isSubscriptionExpired: isExpired,
      },
    })
  } catch (error) {
    res.status(500).json({ error: "erorr in me route" })
  }
})

// Logout
router.post("/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({ error: "Not authorized" })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.id)

    if (!user) {
      return res.status(401).json({ error: "User not found" })
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    })
  } catch (error) {
    res.status(500).json({ error: "Logout error" })
  }
})

// Change password
router.put("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    const user = await User.findById(req.user._id).select("+password")

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ error: "Current password is incorrect" })
    }

    user.password = newPassword
    await user.save()

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
