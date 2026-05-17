import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import connectDB from "./config/database.js"
import authRoutes from "./routes/auth.js"
import clientRoutes from "./routes/clients.js"
import invoiceRoutes from "./routes/invoices.js"
import paymentRoutes from "./routes/payments.js"
import reportRoutes from "./routes/reports.js"
import userRoutes from "./routes/users.js"
import historyRoutes from "./routes/history.js"
import companyRoutes from "./routes/company.js"
import organizationRoutes from "./routes/organizations.js"
import billingRoutes from "./routes/billing.js"
import adminRoutes from "./routes/admin.js"
import productRoutes from "./routes/products.js"
import { errorHandler } from "./middleware/errorHandler.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT

// Stripe webhook needs raw body
app.use("/api/billing/webhook", express.raw({ type: "application/json" }))

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL 
}))
app.use(express.json())

// Database Connection
connectDB()

// Routes
app.get("/", (req, res) => {
  res.send("Welcome to the Invoice Management System API")
})

app.use("/api/auth", authRoutes)
app.use("/api/clients", clientRoutes)
app.use("/api/invoices", invoiceRoutes)
app.use("/api/payments", paymentRoutes)
app.use("/api/reports", reportRoutes)
app.use("/api/users", userRoutes)
app.use("/api/history", historyRoutes)
app.use("/api/company", companyRoutes)
app.use("/api/organizations", organizationRoutes)
app.use("/api/billing", billingRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/products", productRoutes)

// Debug: list registered routes
app._router.stack
  .filter(r => r.route)
  .forEach(r => {
    const methods = Object.keys(r.route.methods).map(m => m.toUpperCase()).join(', ')
    console.log(`${methods} ${r.route.path}`)
  })

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Invoice Management API is running" })
})

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" })
})


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
