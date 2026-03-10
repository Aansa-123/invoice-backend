export const authorize = (...roles) => {
  return (req, res, next) => {
    // Global Admins have access to everything
    if (req.user && req.user.role === "Admin") {
      return next()
    }

    if (!roles.includes(req.orgRole)) {
      return res.status(403).json({
        error: `Your role (${req.orgRole}) in this organization is not authorized to access this route`,
      })
    }
    next()
  }
}
