import express from "express"
import Client from "../models/Client.js"
import { protect } from "../middleware/auth.js"

const router = express.Router()

// Get all clients for user
router.get("/", protect, async (req, res) => {
  try {
    const clients = await Client.find({ userId: req.user.id })
    res.status(200).json({
      success: true,
      count: clients.length,
      data: clients,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get single client
router.get("/:id", protect, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)

    if (!client) {
      return res.status(404).json({ error: "Client not found" })
    }

    // Check ownership
    if (client.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" })
    }

    res.status(200).json({
      success: true,
      data: client,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create client
router.post("/", protect, async (req, res) => {
  try {
    const { name, email, phone, address } = req.body

    const client = await Client.create({
      userId: req.user.id,
      name,
      email,
      phone,
      address,
    })

    res.status(201).json({
      success: true,
      data: client,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Update client
router.put("/:id", protect, async (req, res) => {
  try {
    let client = await Client.findById(req.params.id)

    if (!client) {
      return res.status(404).json({ error: "Client not found" })
    }

    // Check ownership
    if (client.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" })
    }

    client = await Client.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })

    res.status(200).json({
      success: true,
      data: client,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Delete client
router.delete("/:id", protect, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)

    if (!client) {
      return res.status(404).json({ error: "Client not found" })
    }

    // Check ownership
    if (client.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" })
    }

    await Client.findByIdAndDelete(req.params.id)

    res.status(200).json({
      success: true,
      data: {},
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
