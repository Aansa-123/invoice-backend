import express from "express"
import Payment from "../models/Payment.js"
import Invoice from "../models/Invoice.js"
import { protect } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"
import { logActivity } from "../services/logger.js"

const router = express.Router()

// Get all payments for organization
router.get("/", protect, async (req, res) => {
  try {
    const payments = await Payment.find({ organizationId: req.user.currentOrganization })
      .populate("invoiceId", "invoiceNumber")
      .populate("clientId", "name")
      .sort({ paymentDate: -1 })

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Record a new payment
router.post("/", protect, authorize("Owner", "Admin", "Accountant"), async (req, res) => {
  try {
    const { invoiceId, amount, paymentMethod, transactionId, paymentDate, notes } = req.body

    // 1. Verify invoice exists and belongs to organization
    const invoice = await Invoice.findById(invoiceId)
    if (!invoice || invoice.organizationId.toString() !== req.user.currentOrganization.toString()) {
      return res.status(404).json({ error: "Invoice not found" })
    }

    // 2. Create payment record
    const payment = await Payment.create({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      invoiceId,
      clientId: invoice.clientId,
      amount,
      paymentMethod,
      transactionId,
      paymentDate: paymentDate || Date.now(),
      notes,
    })

    // 3. Update Invoice status automatically
    // Fetch all completed payments for this invoice to check if it's fully paid
    const allPayments = await Payment.find({ invoiceId, status: "Completed" })
    const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0)

    if (totalPaid >= invoice.total) {
      invoice.status = "Paid"
    } else if (invoice.status === "Draft") {
      // If it's a draft and we recorded a payment, it's now Pending
      invoice.status = "Pending"
    } else if (invoice.status === "Overdue" && totalPaid < invoice.total) {
      // Keep it overdue if not fully paid
      invoice.status = "Overdue"
    } else if (invoice.status !== "Paid" && totalPaid < invoice.total) {
       // Ensure it's Pending if not fully paid and not Overdue
       invoice.status = "Pending"
    }
    
    await invoice.save()

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `Recorded payment of $${amount} for invoice ${invoice.invoiceNumber}`,
      module: "Payments",
      metadata: { paymentId: payment._id, invoiceId: invoice._id }
    })

    res.status(201).json({
      success: true,
      data: payment,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
