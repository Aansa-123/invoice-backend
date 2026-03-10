import Organization from "../models/Organization.js"

export const checkSubscription = async (req, res, next) => {
  try {
    // Admins are exempt from subscription checks
    if (req.user.role === "Admin") {
      return next()
    }

    const organization = await Organization.findById(req.user.currentOrganization)

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" })
    }

    const status = organization.subscription?.status || "active"
    const planName = organization.subscription?.plan || "Free"
    const expiry = organization.subscription?.end

    // Check if manually disabled
    if (status === "disabled") {
      return res.status(403).json({ 
        error: "Subscription disabled by admin. Contact support.",
        subscriptionDisabled: true 
      })
    }

    // Check if expired
    if (planName !== "Free" && expiry && new Date(expiry) < new Date()) {
      // For expired pro plans, we allow access but with Free limits (handled by checkPlanLimits)
      // If the user wants to HARD BLOCK features when expired, we would return error here.
      // Based on architecture, we revert to Free limits.
    }

    next()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
