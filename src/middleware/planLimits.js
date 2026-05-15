import Organization from "../models/Organization.js"
import Invoice from "../models/Invoice.js"
import Client from "../models/Client.js"
import { PLANS } from "../config/plans.js"

export const checkPlanLimits = (resourceType) => async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.user.currentOrganization)
    
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" })
    }

    let planName = organization.subscription?.plan || "Free"
    const subscriptionEnd = organization.subscription?.end

    // Check for expiration
    if (planName !== "Free" && subscriptionEnd && new Date(subscriptionEnd) < new Date()) {
      planName = "Free" // Revert to Free limits
      
      // Update the organization in the background to mark as expired if not already
      if (organization.subscription.status !== "expired") {
        organization.subscription.status = "expired"
        await organization.save()
      }
      
      req.subscriptionExpired = true // Flag for later use if needed
    }

    let plan = PLANS[planName]

    if (!plan) {
      console.warn(`Plan ${planName} not found, defaulting to Free`)
      plan = PLANS["Free"]
    }

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    if (resourceType === "invoice") {
      if (plan.invoiceLimit !== -1) {
        // Check daily limit for Free plan
        const dailyCount = await Invoice.countDocuments({ 
          organizationId: organization._id,
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        })

        if (dailyCount >= plan.invoiceLimit) {
          return res.status(403).json({ 
            error: `Daily limit reached. Your ${planName} plan only allows ${plan.invoiceLimit} invoice per day. Please upgrade to create more.` 
          })
        }
      }
    } else if (resourceType === "client") {
      if (plan.clientLimit !== -1) {
        // Check daily limit for Free plan
        const dailyCount = await Client.countDocuments({ 
          organizationId: organization._id,
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        })

        if (dailyCount >= plan.clientLimit) {
          return res.status(403).json({ 
            error: `Daily limit reached. Your ${planName} plan only allows ${plan.clientLimit} client per day. Please upgrade to create more.` 
          })
        }
      }
    } else if (resourceType === "team") {
      if (!plan.teamAllowed) {
        return res.status(403).json({ 
          error: `Team management is not available in the ${planName} plan. Please upgrade to invite team members and collaborate.`,
          upgradeRequired: true
        })
      }
    } else if (resourceType === "reports") {
      if (!plan.reportsAllowed) {
        return res.status(403).json({ 
          error: `Advanced reporting is not available in the ${planName} plan. Please upgrade to view detailed analytics.`,
          upgradeRequired: true
        })
      }
    }

    next()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
