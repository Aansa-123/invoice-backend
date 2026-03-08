import Organization from "../models/Organization.js"
import Invoice from "../models/Invoice.js"
import { PLANS } from "../config/plans.js"

export const checkPlanLimits = async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.user.currentOrganization)
    
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" })
    }

    const planName = organization.subscription.plan || "Free"
    const plan = PLANS[planName]

    if (plan.invoiceLimit !== Infinity) {
      const invoiceCount = await Invoice.countDocuments({ 
        organizationId: organization._id 
      })

      if (invoiceCount >= plan.invoiceLimit) {
        return res.status(403).json({ 
          error: `Plan limit reached. Your ${planName} plan only allows ${plan.invoiceLimit} invoices. Please upgrade to create more.` 
        })
      }
    }

    next()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
