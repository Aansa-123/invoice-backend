import express from "express"
import Invoice from "../models/Invoice.js"
import Client from "../models/Client.js"
import Product from "../models/Product.js"
import CompanySettings from "../models/CompanySettings.js"
import { protect } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"
import { checkPlanLimits } from "../middleware/planLimits.js"
import generateInvoicePDF from "../services/pdfGenerator.js"
import { logActivity } from "../services/logger.js"

const router = express.Router()

// Generate invoice number per organization
async function generateInvoiceNumber(organizationId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const shortOrgId = organizationId.toString().substring(0, 6);
  const prefix = `INV-${shortOrgId}-${year}${month}-`;

  // Find the highest invoice number for this organization and current month
  const lastInvoice = await Invoice.findOne({
    organizationId,
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


// Get all invoices for organization
router.get("/", protect, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query
    const query = { organizationId: req.user.currentOrganization }

    if (status) {
      query.status = status
    }

    if (startDate || endDate) {
      query.invoiceDate = {}
      if (startDate) query.invoiceDate.$gte = new Date(startDate)
      if (endDate) query.invoiceDate.$lte = new Date(endDate)
    }

    const invoices = await Invoice.find(query).populate("clientId").sort({ invoiceDate: -1 })

    // Update overdue status and save if needed
    const now = new Date()
    for (const invoice of invoices) {
      if (invoice.status !== "Paid" && invoice.dueDate < now && invoice.status !== "Overdue") {
        invoice.status = "Overdue"
        await invoice.save()
      }
    }

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

    if (invoice.organizationId.toString() !== req.user.currentOrganization.toString()) {
      return res.status(403).json({ error: "Not authorized to access this invoice" })
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
router.post("/", protect, authorize("Owner", "Admin", "Accountant"), checkPlanLimits("invoice"), async (req, res) => {
  try {
    const { clientId, items, tax, discount, dueDate, invoiceDate, notes, isDraft } = req.body

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

    // Verify client exists and belongs to the organization
    const client = await Client.findById(clientId)
    if (!client || client.organizationId.toString() !== req.user.currentOrganization.toString()) {
      return res.status(403).json({ error: "Invalid client for this organization" })
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

    const invoiceNumber = await generateInvoiceNumber(req.user.currentOrganization)

    const invoice = await Invoice.create({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      invoiceNumber,
      clientId,
      items,
      subtotal,
      tax: taxValue,
      discount: discountValue,
      total,
      invoiceDate: invoiceDate || Date.now(),
      dueDate,
      notes: notes || "",
      isDraft: isDraft || false,
    })

    // Deduct stock if not a draft
    if (!invoice.isDraft) {
      for (const item of invoice.items) {
        if (item.productId) {
          const totalPcs = item.quantity * (item.conversionFactor || 1)
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { quantity: -totalPcs }
          })
        }
      }
    }

    const populatedInvoice = await Invoice.findById(invoice._id).populate("clientId")

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `Created invoice ${invoice.invoiceNumber}`,
      module: "Invoices",
      details: `New invoice for client ${populatedInvoice.clientId?.name}`,
      metadata: { invoiceId: invoice._id }
    })

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
router.put("/:id", protect, authorize("Owner", "Admin", "Accountant"), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" })
    }

    if (invoice.organizationId.toString() !== req.user.currentOrganization.toString()) {
      return res.status(403).json({ error: "Not authorized to update this invoice" })
    }

    const { clientId, items, tax, discount, dueDate, notes, isDraft } = req.body

    // Cannot edit Paid invoices
    if (invoice.status === "Paid") {
      return res.status(400).json({ error: "Cannot edit a paid invoice" })
    }

    if (clientId) {
      const client = await Client.findById(clientId)
      if (!client || client.organizationId.toString() !== req.user.currentOrganization.toString()) {
        return res.status(403).json({ error: "Invalid client for this organization" })
      }
      invoice.clientId = clientId
    }

    if (items) {
      // Validate items price
      for (const item of items) {
        if (item.price <= 0) {
          return res.status(400).json({ error: "Item price must be greater than 0" })
        }
      }
      invoice.items = items
      invoice.subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0)
    }

    if (tax !== undefined) {
      invoice.tax = Number(tax) || 0
    }

    if (discount !== undefined) {
      invoice.discount = Number(discount) || 0
    }

    const wasDraft = invoice.isDraft
    if (isDraft !== undefined) {
      invoice.isDraft = isDraft
    }

    invoice.total = invoice.subtotal + invoice.tax - invoice.discount

    // Deduct stock if it was a draft and now it's NOT (only if it's being confirmed)
    if (wasDraft && !invoice.isDraft) {
      for (const item of invoice.items) {
        if (item.productId) {
          const totalPcs = item.quantity * (item.conversionFactor || 1)
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { quantity: -totalPcs }
          })
        }
      }
    }

    // invoiceDate is read-only according to requirements
    if (dueDate) invoice.dueDate = dueDate
    
    // Automatically set status to Pending on update
    invoice.status = "Pending"
    
    if (notes !== undefined) invoice.notes = notes

    await invoice.save()

    const populatedInvoice = await Invoice.findById(invoice._id).populate("clientId")

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `Updated invoice ${invoice.invoiceNumber}`,
      module: "Invoices",
      metadata: { invoiceId: invoice._id }
    })

    res.status(200).json({
      success: true,
      data: populatedInvoice,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Delete invoice
router.delete("/:id", protect, authorize("Owner", "Admin"), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" })
    }

    if (invoice.organizationId.toString() !== req.user.currentOrganization.toString()) {
      return res.status(403).json({ error: "Not authorized to delete this invoice" })
    }

    await Invoice.findByIdAndDelete(req.params.id)

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `Deleted invoice ${invoice.invoiceNumber}`,
      module: "Invoices",
      metadata: { invoiceNumber: invoice.invoiceNumber }
    })

    res.status(200).json({
      success: true,
      data: {},
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update invoice status
router.patch("/:id/status", protect, authorize("Owner", "Admin", "Accountant"), async (req, res) => {
  try {
    const { status } = req.body
    const invoice = await Invoice.findById(req.params.id)

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" })
    }

    if (invoice.organizationId.toString() !== req.user.currentOrganization.toString()) {
      return res.status(403).json({ error: "Not authorized to update this invoice" })
    }

    invoice.status = status
    await invoice.save()

    // Log activity
    await logActivity({
      userId: req.user._id,
      organizationId: req.user.currentOrganization,
      action: `Updated status of invoice ${invoice.invoiceNumber} to ${status}`,
      module: "Invoices",
      metadata: { invoiceId: invoice._id, status }
    })

    res.status(200).json({
      success: true,
      data: invoice,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Get PDF
router.get("/:id/pdf", protect, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("clientId")

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" })
    }

    if (invoice.organizationId.toString() !== req.user.currentOrganization.toString()) {
      return res.status(403).json({ error: "Not authorized to access this invoice" })
    }

    const company = await CompanySettings.findOne({ organizationId: req.user.currentOrganization })

    const pdfBuffer = await generateInvoicePDF(invoice, company || {})

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`)
    res.send(pdfBuffer)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
