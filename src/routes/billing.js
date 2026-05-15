import express from "express"
import Stripe from "stripe"
import multer from "multer"
import cloudinary from "../config/cloudinary.js"
import { protect } from "../middleware/auth.js"
import Organization from "../models/Organization.js"
import Plan from "../models/Plan.js"
import OrganizationSubscription from "../models/Subscription.js"
import SubscriptionPayment from "../models/SubscriptionPayment.js"

const router = express.Router()
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

// Multer config for memory storage
const storage = multer.memoryStorage()
const upload = multer({ storage })

// Get all active plans
router.get("/plans", protect, async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true })
    res.json({ success: true, data: plans })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Mock Upgrade Plan with Manual Payment
router.post("/upgrade", protect, upload.single("screenshot"), async (req, res) => {
  try {
    const { planName, paymentMethod, transactionId } = req.body
    const organization = await Organization.findById(req.user.currentOrganization)

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" })
    }

    const planObj = await Plan.findOne({ name: planName })
    if (!planObj) {
      return res.status(404).json({ error: "Plan not found" })
    }

    let screenshotUrl = ""
    if (req.file) {
      const fileStr = req.file.buffer.toString("base64")
      const fileType = req.file.mimetype
      const uploadResponse = await cloudinary.uploader.upload(`data:${fileType};base64,${fileStr}`, {
        folder: "payment_screenshots",
      })
      screenshotUrl = uploadResponse.secure_url
    }

    const durationDays = planObj.durationDays || 30
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + durationDays)

    // Update Organization
    await Organization.findByIdAndUpdate(req.user.currentOrganization, {
      plan: planObj._id,
      "subscription.status": "active",
      "subscription.plan": planName,
      "subscription.end": endDate,
    })

    // Create Subscription record
    await OrganizationSubscription.create({
      organization: organization._id,
      plan: planObj._id,
      paymentStatus: "Paid",
      startDate: new Date(),
      endDate: endDate,
      isActive: true,
    })

    // Create SubscriptionPayment record
    await SubscriptionPayment.create({
      organization: organization._id,
      plan: planObj._id,
      amount: planObj.price,
      status: "success",
      paymentMethod: paymentMethod || "Manual Payment",
      transactionId: transactionId || `MOCK-${Date.now()}`,
      screenshot: screenshotUrl,
      paymentDate: new Date(),
    })

    res.json({
      success: true,
      message: "Plan upgraded successfully",
      data: {
        plan: planName,
        endDate: endDate,
      }
    })
  } catch (error) {
    console.error("Cloudinary upload error:", error)
    res.status(500).json({ error: error.message })
  }
})

// Get Subscription Payment History
router.get("/history", protect, async (req, res) => {
  try {
    const history = await SubscriptionPayment.find({ 
      organization: req.user.currentOrganization 
    }).populate("plan").sort({ paymentDate: -1 })

    res.json({
      success: true,
      data: history
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create Checkout Session
router.post("/create-checkout-session", protect, async (req, res) => {
  try {
    const { priceId } = req.body
    const organization = await Organization.findById(req.user.currentOrganization)

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" })
    }

    // Mock payment response for now as requested
    await Organization.findByIdAndUpdate(req.user.currentOrganization, {
      "subscription.status": "active",
      "subscription.plan": "Pro",
    })

    res.json({ 
      message: "your payment is done", 
      paymentSuccess: true,
      url: `${process.env.FRONTEND_URL}/billing?success=true` 
    })
    
    /* 
    // Commented out Stripe integration for later
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: req.user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
      metadata: {
        organizationId: organization._id.toString(),
      },
    })

    res.json({ id: session.id, url: session.url })
    */
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Webhook to handle subscription events
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe is not configured" })
  }

  const sig = req.headers["stripe-signature"]

  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object
      await Organization.findByIdAndUpdate(session.metadata.organizationId, {
        "subscription.status": "active",
        "subscription.stripeCustomerId": session.customer,
        "subscription.stripeSubscriptionId": session.subscription,
        "subscription.plan": "Pro", // Should be determined by priceId
      })
      break
    case "customer.subscription.deleted":
      const subscription = event.data.object
      await Organization.findOneAndUpdate(
        { "subscription.stripeSubscriptionId": subscription.id },
        { "subscription.status": "canceled", "subscription.plan": "Free" }
      )
      break
    // Add more cases as needed
  }

  res.json({ received: true })
})

export default router
