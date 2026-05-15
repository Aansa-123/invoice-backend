import express from "express"
import Organization from "../models/Organization.js"
import User from "../models/User.js"
import Plan from "../models/Plan.js"
import SubscriptionPayment from "../models/SubscriptionPayment.js"
import { protect } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"

const router = express.Router()

// Middleware to ensure global Admin role
const isAdmin = (req, res, next) => {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ error: "Access denied. Admin only." })
  }
  next()
}

// --- Dashboard Stats ---
router.get("/stats", protect, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments()
    const totalOrgs = await Organization.countDocuments()
    const activeSubscriptions = await Organization.countDocuments({ 
      "subscription.status": "active",
      "subscription.plan": { $ne: "Free" }
    })
    
    const payments = await SubscriptionPayment.find({ status: "success" })
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0)

    res.json({
      success: true,
      data: {
        totalUsers,
        totalOrgs,
        activeSubscriptions,
        totalRevenue
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// --- User Management ---
router.get("/users", protect, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password").populate("currentOrganization", "name")
    res.json({ success: true, data: users })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.patch("/users/:id/status", protect, isAdmin, async (req, res) => {
  try {
    const { role } = req.body // Or use a 'disabled' flag if added to model
    // Assuming we might want to change role or block
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: "User not found" })
    
    // For now, let's just support a mock 'status' if we add it, 
    // or use role to 'Block' them
    if (req.body.status) {
      user.status = req.body.status // If we add status field
    }
    
    await user.save()
    res.json({ success: true, message: "User status updated" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get all organizations
router.get("/organizations", protect, isAdmin, async (req, res) => {
  try {
    const orgs = await Organization.find()
      .populate("owner", "name email")
      .populate("plan")
      .lean();
    
    // Ensure subscription plan is set from the plan reference if missing in the nested object
    const transformedOrgs = orgs.map(org => ({
      ...org,
      subscription: {
        ...org.subscription,
        plan: org.subscription?.plan || (org.plan?.name || "Free"),
        end: org.subscription?.end || null
      }
    }));

    res.json({ success: true, data: transformedOrgs })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get pending organizations
router.get("/organizations/pending", protect, isAdmin, async (req, res) => {
  try {
    const orgs = await Organization.find({ status: "pending" }).populate("owner", "name email").populate("plan")
    res.json({ success: true, data: orgs })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Approve Organization
router.patch("/organizations/:id/approve", protect, isAdmin, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id)

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" })
    }

    organization.status = "approved"
    organization.approvedByAdmin = req.user._id
    await organization.save()

    res.json({ success: true, message: "Organization approved successfully", data: organization })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Reject Organization
router.patch("/organizations/:id/reject", protect, isAdmin, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id)

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" })
    }

    organization.status = "rejected"
    await organization.save()

    // Also remove from user's organizations list to fully hide it
    await User.findByIdAndUpdate(organization.owner, {
      $pull: { organizations: { organizationId: organization._id } }
    })

    res.json({ success: true, message: "Organization rejected", data: organization })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Extend Subscription
router.post("/organizations/:id/extend", protect, isAdmin, async (req, res) => {
  try {
    const { days, reason } = req.body
    const organization = await Organization.findById(req.params.id)

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" })
    }

    const currentEnd = organization.subscription?.end || new Date()
    const newEnd = new Date(currentEnd)
    newEnd.setDate(newEnd.getDate() + parseInt(days))

    organization.subscription.end = newEnd
    organization.subscription.graceDays = (organization.subscription.graceDays || 0) + parseInt(days)
    organization.subscription.status = "active" // Reactivate if it was expired
    
    await organization.save()

    res.json({
      success: true,
      message: `Subscription extended by ${days} days. New expiry: ${newEnd.toLocaleDateString()}`,
      data: organization
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Change Plan
router.post("/organizations/:id/change-plan", protect, isAdmin, async (req, res) => {
  try {
    const { planName } = req.body
    const organization = await Organization.findById(req.params.id)
    const plan = await Plan.findOne({ name: planName })

    if (!organization || !plan) {
      return res.status(404).json({ error: "Organization or Plan not found" })
    }

    organization.plan = plan._id
    organization.subscription.plan = planName
    await organization.save()

    res.json({ success: true, message: `Plan changed to ${planName}`, data: organization })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Disable Subscription and Revert to Free
router.patch("/organizations/:id/disable-subscription", protect, isAdmin, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id)
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" })
    }

    const freePlan = await Plan.findOne({ name: "Free" })

    // Reset to Free plan
    organization.plan = freePlan ? freePlan._id : null
    organization.subscription.plan = "Free"
    organization.subscription.status = "active"
    organization.subscription.end = null
    
    await organization.save()

    res.json({ success: true, message: "Subscription disabled and organization reverted to Free plan" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Disable/Enable Organization Entirely
router.patch("/organizations/:id/status", protect, isAdmin, async (req, res) => {
  try {
    const { status } = req.body // active, disabled, etc.
    // Note: Organization model doesn't have a top-level status yet, using subscription status for now
    // or we can update User owner status
    const organization = await Organization.findById(req.params.id)
    organization.subscription.status = status
    await organization.save()
    
    res.json({ success: true, message: `Organization status updated to ${status}` })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// --- Plan Management ---
router.get("/plans", protect, isAdmin, async (req, res) => {
  try {
    const plans = await Plan.find()
    res.json({ success: true, data: plans })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

const getDurationDays = (type, durationDays) => {
  if (type === "Monthly") return 30;
  if (type === "Yearly") return 365;
  if (type === "Lifetime" || type === "Free") return 99999;
  return durationDays || 30;
};

router.post("/plans", protect, isAdmin, async (req, res) => {
  try {
    const planData = { ...req.body };
    planData.durationDays = getDurationDays(planData.type, planData.durationDays);
    const plan = await Plan.create(planData)
    res.status(201).json({ success: true, data: plan })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.put("/plans/:id", protect, isAdmin, async (req, res) => {
  try {
    const planData = { ...req.body };
    if (planData.type) {
      planData.durationDays = getDurationDays(planData.type, planData.durationDays);
    }
    const plan = await Plan.findByIdAndUpdate(req.params.id, planData, { new: true })
    res.json({ success: true, data: plan })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// --- Payment Records ---
router.get("/payments", protect, isAdmin, async (req, res) => {
  try {
    const payments = await SubscriptionPayment.find()
      .populate("organization", "name")
      .populate("plan", "name")
      .sort("-paymentDate")
    res.json({ success: true, data: payments })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// --- Growth Stats ---
router.get("/growth", protect, isAdmin, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    // Aggregate Organizations per day
    const orgsGrowth = await Organization.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])

    // Aggregate Payments per day
    const revenueGrowth = await SubscriptionPayment.aggregate([
      { $match: { status: "success", paymentDate: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" } },
          amount: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ])

    // Merge data for the last 30 days
    const chartData = []
    for (let i = 0; i <= 30; i++) {
      const date = new Date(thirtyDaysAgo)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      
      const orgData = orgsGrowth.find(o => o._id === dateStr)
      const revData = revenueGrowth.find(r => r._id === dateStr)
      
      chartData.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        growth: orgData ? orgData.count : 0,
        revenue: revData ? revData.amount : 0
      })
    }

    res.json({ success: true, data: chartData })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
