import ActivityLog from "../models/ActivityLog.js"
import pusher from "../utils/pusher.js"

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

    // Notify admins of new system logs
    try {
      await pusher.trigger("admin-channel", "system-update", {
        message: `New activity in ${module}: ${action}`,
        module,
        action
      })
    } catch (pusherError) {
      console.error("Pusher notification failed:", pusherError.message)
    }
  } catch (error) {
    console.error("Activity logging failed:", error)
  }
}
