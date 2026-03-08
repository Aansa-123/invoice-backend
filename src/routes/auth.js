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

    // Create user
    user = await User.create({
      name,
      email,
      password,
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
    const user = await User.findOne({ email }).select("+password")

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Check if user is disabled
    if (user.status === "Disabled") {
      return res.status(403).json({ error: "Your account has been disabled. Please contact your administrator." })
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
        role,
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
    const user = await User.findById(decoded.id)

    if (!user) {
      return res.status(401).json({ error: "User not found" })
    }

    let role = "Owner"
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
      user: {
        ...user.toObject(),
        role
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
