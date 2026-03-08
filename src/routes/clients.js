import express from "express"
import Client from "../models/Client.js"
import Invoice from "../models/Invoice.js"
import { protect } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"
import { logActivity } from "../services/logger.js"

const router = express.Router()

// Get all clients for organization
router.get("/", protect, async (req, res) => {
  try {
    const clients = await Client.find({ organizationId: req.user.currentOrganization })
    
    // Get invoice count for each client
    const clientsWithStats = await Promise.all(
      clients.map(async (client) => {
        const totalInvoices = await Invoice.countDocuments({ clientId: client._id })
        return {
          ...client.toObject(),
          totalInvoices
        }
      })
    )

    res.status(200).json({
      success: true,
      count: clientsWithStats.length,
      data: clientsWithStats,
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

    // Check organization access
    if (client.organizationId.toString() !== req.user.currentOrganization.toString()) {
      return res.status(403).json({ error: "Not authorized to access this client" })
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
router.post("/", protect, authorize("Owner", "Admin", "Accountant"), async (req, res) => {
  try {
    const { name, email, phone, address } = req.body

    const client = await Client.create({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      name,
      email,
      phone,
      address,
    })

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `Added new client: ${name}`,
      module: "Clients",
      metadata: { clientId: client._id }
    })

    res.status(201).json({
      success: true,
      data: client,
    })
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to create client" })
  }
})

// Update client
router.put("/:id", protect, authorize("Owner", "Admin", "Accountant"), async (req, res) => {
  try {
    let client = await Client.findById(req.params.id)

    if (!client) {
      return res.status(404).json({ error: "Client not found" })
    }

    // Check organization access
    if (client.organizationId.toString() !== req.user.currentOrganization.toString()) {
      return res.status(403).json({ error: "Not authorized to update this client" })
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
router.delete("/:id", protect, authorize("Owner", "Admin"), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)

    if (!client) {
      return res.status(404).json({ error: "Client not found" })
    }

    // Check organization access
    if (client.organizationId.toString() !== req.user.currentOrganization.toString()) {
      return res.status(403).json({ error: "Not authorized to delete this client" })
    }

    await Client.findByIdAndDelete(req.params.id)

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `Deleted client: ${client.name}`,
      module: "Clients",
      metadata: { clientName: client.name }
    })

    res.status(200).json({
      success: true,
      data: {},
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
