export const PLANS = {
  Free: {
    name: "Free",
    price: 0,
    durationDays: 36500, // Unlimited-ish
    clientLimit: 1, // Per day
    invoiceLimit: 1, // Per day
    teamAllowed: false,
    reportsAllowed: false,
    features: ["1 Invoice per day", "1 Client per day"],
  },
  Monthly: {
    name: "Monthly",
    price: 19,
    durationDays: 30,
    clientLimit: -1, // Unlimited
    invoiceLimit: -1, // Unlimited
    teamAllowed: true,
    reportsAllowed: true,
    features: ["Unlimited Invoices", "Unlimited Clients", "Team Members", "Reports"],
  },
  Yearly: {
    name: "Yearly",
    price: 199,
    durationDays: 365,
    clientLimit: -1, // Unlimited
    invoiceLimit: -1, // Unlimited
    teamAllowed: true,
    reportsAllowed: true,
    features: ["Unlimited Invoices", "Unlimited Clients", "Team Members", "Reports", "Priority Support"],
  },
  Lifetime: {
    name: "Lifetime",
    price: 499,
    durationDays: 36500,
    clientLimit: -1, // Unlimited
    invoiceLimit: -1, // Unlimited
    teamAllowed: true,
    reportsAllowed: true,
    features: ["Unlimited Invoices", "Unlimited Clients", "Team Members", "Reports", "Lifetime Access"],
  },
}
