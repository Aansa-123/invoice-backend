import express from "express"
import Invoice from "../models/Invoice.js"
import Client from "../models/Client.js"
import CompanySettings from "../models/CompanySettings.js"
import { protect } from "../middleware/auth.js"
import generateInvoicePDF from "../services/pdfGenerator.js"

const router = express.Router()

// Generate invoice number per user
async function generateInvoiceNumber(userId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const shortUserId = userId.substring(0, 6);
  const prefix = `INV-${shortUserId}-${year}${month}-`;

  // Find the highest invoice number for this user and current month
  const lastInvoice = await Invoice.findOne({
    userId,
    invoiceNumber: { $regex: `^${prefix}` }
  }).sort({ invoiceNumber: -1 });

  let nextNumber = 1;

  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[3]);
    nextNumber = lastNumber + 1;
  }

  const padded = String(nextNumber).padStart(5, "0");
  return `${prefix}${padded}`;
}


// Get all invoices for user
router.get("/", protect, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query
    const query = { userId: req.user.id }

    if (status) {
      query.status = status
    }

    if (startDate || endDate) {
      query.invoiceDate = {}
      if (startDate) query.invoiceDate.$gte = new Date(startDate)
      if (endDate) query.invoiceDate.$lte = new Date(endDate)
    }

    const invoices = await Invoice.find(query).populate("clientId").sort({ invoiceDate: -1 })

    // Update overdue status
    const now = new Date()
    invoices.forEach((invoice) => {
      if (invoice.status !== "Paid" && invoice.dueDate < now) {
        invoice.status = "Overdue"
      }
    })

    res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get single invoice
router.get("/:id", protect, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("clientId")

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" })
    }

    if (invoice.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" })
    }

    res.status(200).json({
      success: true,
      data: invoice,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create invoice
router.post("/", protect, async (req, res) => {
  try {
    const { clientId, items, tax, discount, dueDate, notes } = req.body

    // Validation
    if (!clientId || clientId.trim() === "") {
      return res.status(400).json({ error: "Client is required" })
    }

    if (!dueDate || dueDate.trim() === "") {
      return res.status(400).json({ error: "Due date is required" })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required" })
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item.name || item.name.trim() === "") {
        return res.status(400).json({ error: `Item ${i + 1}: Name is required` })
      }
      if (typeof item.quantity !== "number" || item.quantity <= 0) {
        return res.status(400).json({ error: `Item ${i + 1}: Quantity must be a positive number` })
      }
      if (typeof item.price !== "number" || item.price < 0) {
        return res.status(400).json({ error: `Item ${i + 1}: Price must be a non-negative number` })
      }
    }

    // Verify client exists and belongs to user
    const client = await Client.findById(clientId)
    if (!client || client.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Invalid client" })
    }

    // Validate tax and discount
    const taxValue = Number(tax) || 0
    const discountValue = Number(discount) || 0

    if (taxValue < 0) {
      return res.status(400).json({ error: "Tax cannot be negative" })
    }

    if (discountValue < 0) {
      return res.status(400).json({ error: "Discount cannot be negative" })
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0)
    const total = subtotal + taxValue - discountValue

    const invoiceNumber = await generateInvoiceNumber(req.user.id)

    const invoice = await Invoice.create({
      userId: req.user.id,
      invoiceNumber,
      clientId,
      items,
      subtotal,
      tax: taxValue,
      discount: discountValue,
      total,
      dueDate,
      notes: notes || "",
    })

    const populatedInvoice = await Invoice.findById(invoice._id).populate("clientId")

    res.status(201).json({
      success: true,
      data: populatedInvoice,
    })
  } catch (error) {
    console.error("Invoice creation error:", error)
    res.status(400).json({ error: error.message })
  }
})

// Update invoice
router.put("/:id", protect, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" })
    }

    if (invoice.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" })
    }

    const { items, tax, discount } = req.body

    if (items) {
      invoice.items = items
      invoice.subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0)
    }

    if (tax !== undefined) {
      invoice.tax = tax
    }

    if (discount !== undefined) {
      invoice.discount = discount
    }

    invoice.total = invoice.subtotal + invoice.tax - invoice.discount

    Object.assign(invoice, req.body)
    await invoice.save()

    const populatedInvoice = await Invoice.findById(invoice._id).populate("clientId")

    res.status(200).json({
      success: true,
      data: populatedInvoice,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Update invoice status
router.patch("/:id/status", protect, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" })
    }

    if (invoice.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" })
    }

    const { status } = req.body

    if (!["Paid", "Pending", "Overdue"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" })
    }

    invoice.status = status
    await invoice.save()

    const populatedInvoice = await Invoice.findById(invoice._id).populate("clientId")

    res.status(200).json({
      success: true,
      data: populatedInvoice,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Delete invoice
router.delete("/:id", protect, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" })
    }

    if (invoice.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" })
    }

    await Invoice.findByIdAndDelete(req.params.id)

    res.status(200).json({
      success: true,
      data: {},
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get PDF
router.get("/:id/pdf", protect, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("clientId")

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" })
    }

    if (invoice.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" })
    }

    const company = await CompanySettings.findOne({ userId: req.user.id })

    const pdfBuffer = await generateInvoicePDF(invoice, company || {})

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`)
    res.send(pdfBuffer)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
