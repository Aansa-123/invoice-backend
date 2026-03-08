import ActivityLog from "../models/ActivityLog.js"

export const logActivity = async ({ userId, organizationId, action, module, details, metadata }) => {
  try {
    await ActivityLog.create({
      userId,
      organizationId,
      action,
      module,
      details,
      metadata
    })
  } catch (error) {
    console.error("Activity logging failed:", error)
  }
}
