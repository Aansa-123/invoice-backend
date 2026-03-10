import mongoose from "mongoose"
import dotenv from "dotenv"
import Plan from "../src/models/Plan.js"
import { PLANS } from "../src/config/plans.js"

dotenv.config()

const seedPlans = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log("Connected to MongoDB")

    // Clear existing plans
    await Plan.deleteMany({})
    console.log("Cleared existing plans")

    const plansToInsert = Object.values(PLANS).map(plan => ({
      name: plan.name,
      price: plan.price,
      durationDays: plan.durationDays,
      clientLimit: plan.clientLimit,
      invoiceLimit: plan.invoiceLimit,
      features: plan.features,
      isActive: true
    }))

    await Plan.insertMany(plansToInsert)
    console.log("Plans seeded successfully!")
    
    process.exit(0)
  } catch (error) {
    console.error("Error seeding plans:", error)
    process.exit(1)
  }
}

seedPlans()
