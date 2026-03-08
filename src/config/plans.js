export const PLANS = {
  Free: {
    name: "Free",
    price: 0,
    invoiceLimit: 10,
    features: ["Basic Invoicing", "Client Management"],
  },
  Starter: {
    name: "Starter",
    price: 9,
    invoiceLimit: Infinity,
    features: ["Unlimited Invoices", "Client Management"],
  },
  Pro: {
    name: "Pro",
    price: 19,
    invoiceLimit: Infinity,
    features: ["Unlimited Invoices", "Reports", "PDF Branding"],
  },
  Business: {
    name: "Business",
    price: 49,
    invoiceLimit: Infinity,
    features: ["Unlimited Invoices", "Team Members", "Reports", "PDF Branding"],
  },
}
