import express from "express"
import Invoice from "../models/Invoice.js"
import Client from "../models/Client.js"
import { protect } from "../middleware/auth.js"

const router = express.Router()

// Get reports data for organization
router.get("/", protect, async (req, res) => {
  try {
    const organizationId = req.user.currentOrganization

    // 1. Monthly Revenue (Past 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const monthlyRevenue = await Invoice.aggregate([
      {
        $match: {
          organizationId: organizationId,
          invoiceDate: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$invoiceDate" },
            month: { $month: "$invoiceDate" },
          },
          revenue: { $sum: "$total" },
          paidRevenue: {
            $sum: {
              $cond: [{ $eq: ["$status", "Paid"] }, "$total", 0],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ])

    // 2. Invoice Status Breakdown
    const statusBreakdown = await Invoice.aggregate([
      { $match: { organizationId: organizationId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
    ])

    // 3. Top Clients (by total invoice amount)
    const topClients = await Invoice.aggregate([
      { $match: { organizationId: organizationId } },
      {
        $group: {
          _id: "$clientId",
          totalBilled: { $sum: "$total" },
          invoiceCount: { $sum: 1 },
        },
      },
      { $sort: { totalBilled: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "clients",
          localField: "_id",
          foreignField: "_id",
          as: "clientInfo",
        },
      },
      { $unwind: "$clientInfo" },
      {
        $project: {
          name: "$clientInfo.name",
          totalBilled: 1,
          invoiceCount: 1,
        },
      },
    ])

    // 4. Overall Statistics
    const totalInvoices = await Invoice.countDocuments({ organizationId })
    const totalRevenue = statusBreakdown.reduce((sum, s) => sum + s.total, 0)
    const totalPaid = statusBreakdown.find(s => s._id === "Paid")?.total || 0
    const totalPending = statusBreakdown.find(s => s._id === "Pending")?.total || 0

    res.status(200).json({
      success: true,
      data: {
        monthlyRevenue: monthlyRevenue.map(m => ({
          month: new Date(m._id.year, m._id.month - 1).toLocaleString('default', { month: 'short' }),
          revenue: m.revenue,
          paid: m.paidRevenue,
        })),
        statusBreakdown: statusBreakdown.map(s => ({
          name: s._id,
          value: s.count,
          total: s.total,
        })),
        topClients,
        stats: {
          totalInvoices,
          totalRevenue,
          totalPaid,
          totalPending,
        },
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
