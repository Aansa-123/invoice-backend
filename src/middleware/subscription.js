import Organization from "../models/Organization.js"
import Invoice from "../models/Invoice.js"
import Subscription from "../models/Subscription.js"

export const checkSubscriptionLimit = async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.user.currentOrganization)

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" })
    }

    const plan = organization.subscription.plan

    // Free plan: Limit to 10 invoices per month
    if (plan === "Free") {
      const now = new Date()
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      
      const invoiceCount = await Invoice.countDocuments({
        organizationId: organization._id,
        createdAt: { $gte: firstDayOfMonth }
      })

      if (invoiceCount >= 10) {
        return res.status(403).json({
          error: "Monthly invoice limit reached for Free plan. Please upgrade to Starter or Pro.",
          limitReached: true
        })
      }
    }

    next()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

export const verifySubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params
    
    if (!subscriptionId) {
      return res.status(400).json({ error: "Subscription ID is required" })
    }

    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      userId: req.user._id,
      status: "active"
    })

    if (!subscription) {
      return res.status(403).json({ error: "No active subscription found for this product." })
    }

    req.subscription = subscription
    next()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
