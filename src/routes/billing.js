import express from "express"
import Stripe from "stripe"
import { protect } from "../middleware/auth.js"
import Organization from "../models/Organization.js"

const router = express.Router()
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

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
