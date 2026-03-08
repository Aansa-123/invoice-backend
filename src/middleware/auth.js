import jwt from "jsonwebtoken"
import User from "../models/User.js"

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
    const user = await User.findById(decoded.id).select("-password")
    
    if (!user) {
      return res.status(401).json({ error: "User not found" })
    }

    if (!user.currentOrganization) {
      // Allow user to create organization if they don't have one
      if (req.baseUrl === "/api/organizations" && req.method === "POST") {
        req.user = user
        return next()
      }

      if (user.organizations && user.organizations.length > 0) {
        const organizationId = user.organizations[0].organizationId
        user.currentOrganization = organizationId
        await user.save()
      } else {
        return res.status(400).json({ 
          error: "No organization associated with this user",
          userId: user._id,
          email: user.email,
          orgCount: user.organizations ? user.organizations.length : 0,
          needsSetup: true
        })
      }
    }

    // Attach role in current organization
    const orgMembership = user.organizations.find(
      (org) => org.organizationId.toString() === user.currentOrganization.toString()
    )
    
    req.user = user
    req.user.role = orgMembership ? orgMembership.role : "Viewer"
    
    next()
  } catch (error) {
    return res.status(401).json({ error: "Not authorized to access this route" })
  }
}
