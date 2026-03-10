import jwt from "jsonwebtoken"
import User from "../models/User.js"
import Organization from "../models/Organization.js"

export const protect = async (req, res, next) => {
  let token

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  if (!token) {
    return res.status(401).json({ error: "Not authorized to access this route" })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    // Fetch user and populate current organization
    const user = await User.findById(decoded.id).select("-password").populate("organizations.organizationId")
    
    if (!user) {
      return res.status(401).json({ error: "User not found" })
    }

    // Allow user to create first organization or switch
    const isOrgCreate = (req.baseUrl === "/api/organizations" && req.method === "POST" && req.path === "/") || req.originalUrl.endsWith("/api/organizations")
    const isOrgSwitch = req.originalUrl.includes("/organizations/switch")
    const isOrgList = (req.baseUrl === "/api/organizations" && req.method === "GET") || req.originalUrl === "/api/organizations"
    const isMeRoute = req.originalUrl.includes("/api/auth/me")
    const isAdminRoute = req.originalUrl.includes("/api/admin")

    if (!user.currentOrganization) {
      if (isOrgCreate) {
        req.user = user
        return next()
      }

      if (user.organizations && user.organizations.length > 0) {
        const organizationId = user.organizations[0].organizationId
        user.currentOrganization = organizationId
        await user.save()
      } else if (!isAdminRoute) {
        return res.status(400).json({ 
          error: "No organization associated with this user",
          needsSetup: true
        })
      }
    }

    // Check organization approval status (if not an admin route or switching)
    if (user.currentOrganization && !isAdminRoute && !isOrgSwitch && !isOrgCreate && !isMeRoute && !isOrgList) {
      const organization = await Organization.findById(user.currentOrganization)
      if (organization && organization.status !== "approved") {
        return res.status(403).json({ 
          error: "Organization pending approval", 
          status: organization.status,
          orgName: organization.name
        })
      }
    }

    // Attach role in current organization
    const orgMembership = user.organizations.find(org => {
      const orgId = org.organizationId._id ? org.organizationId._id.toString() : org.organizationId.toString()
      return orgId === user.currentOrganization.toString()
    })
    
    req.user = user
    req.orgRole = orgMembership ? orgMembership.role : "Viewer"
    
    next()
  } catch (error) {
    return res.status(401).json({ error: "Not authorized to access this route" })
  }
}
