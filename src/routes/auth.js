import express from "express"
import User from "../models/User.js"
import jwt from "jsonwebtoken"
import CompanySettings from "../models/CompanySettings.js"

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
    const { name, email, password } = req.body

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

    // Create default company settings
    await CompanySettings.create({
      userId: user._id,
      businessName: name,
      address: "",
      phone: "",
      email: email,
    })

    const token = generateToken(user._id)

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
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

    // Check if password matches
    const isMatch = await user.matchPassword(password)

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const token = generateToken(user._id)

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
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

    res.status(200).json({
      success: true,
      user,
    })
  } catch (error) {
    res.status(500).json({ error: "erorr in me route" })
  }
})

export default router
