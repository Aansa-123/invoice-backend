import mongoose from "mongoose"
import dotenv from "dotenv"
import User from "../src/models/User.js"
import Client from "../src/models/Client.js"
import Invoice from "../src/models/Invoice.js"
import CompanySettings from "../src/models/CompanySettings.js"

dotenv.config()

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log("Connected to MongoDB")

    // Clear existing data
    await User.deleteMany({})
    await Client.deleteMany({})
    await Invoice.deleteMany({})
    await CompanySettings.deleteMany({})

    // Create test user
    const user = await User.create({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    })

    console.log("User created:", user.email)

    // Create company settings
    await CompanySettings.create({
      userId: user._id,
      businessName: "Test Business",
      address: "123 Business St",
      phone: "555-0100",
      email: "business@example.com",
    })

    // Create test clients
    const clients = await Client.insertMany([
      {
        userId: user._id,
        name: "Acme Corp",
        email: "contact@acme.com",
        phone: "555-0101",
        address: "456 Corp Ave",
      },
      {
        userId: user._id,
        name: "Tech Solutions",
        email: "info@techsolutions.com",
        phone: "555-0102",
        address: "789 Tech Blvd",
      },
    ])

    console.log("Clients created:", clients.length)

    // Create test invoices
    const invoices = await Invoice.insertMany([
      {
        userId: user._id,
        invoiceNumber: "INV-2802-4081-00001",
        clientId: clients[0]._id,
        items: [
          { name: "Web Design", quantity: 1, price: 1500 },
          { name: "Development", quantity: 40, price: 100 },
        ],
        subtotal: 5500,
        tax: 550,
        discount: 0,
        total: 6050,
        status: "Paid",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      {
        userId: user._id,
        invoiceNumber: "INV-2026-7401-00002",
        clientId: clients[1]._id,
        items: [{ name: "Consulting", quantity: 20, price: 150 }],
        subtotal: 3000,
        tax: 300,
        discount: 100,
        total: 3200,
        status: "Pending",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    ])

    console.log("Invoices created:", invoices.length)
    console.log("Database seeded successfully!")
    process.exit(0)
  } catch (error) {
    console.error("Error seeding database:", error)
    process.exit(1)
  }
}

seedDatabase()
