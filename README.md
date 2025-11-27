# Invoice Management System - Backend

A professional Node.js/Express backend for invoice management with MongoDB. RESTful API with JWT authentication and PDF invoice generation.

## Features

- **User Authentication** - Secure JWT-based authentication
- **Client Management** - Full CRUD operations for managing clients
- **Invoice Management** - Create, update, delete, and track invoices
- **Automatic Invoice Numbering** - Sequential invoice ID generation
- **PDF Invoice Generation** - Professional PDF documents with company branding
- **Company Settings** - Manage business information and settings
- **Status Tracking** - Invoice status (Paid, Pending, Overdue)
- **Comprehensive Error Handling** - Detailed error responses
- **CORS Support** - Configured for frontend integration
- **Database Seeding** - Sample data for testing

## Prerequisites

- **Node.js** 16+ 
- **MongoDB** 4.4+ (Local or Atlas)
- **npm** or **yarn**

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the backend root:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/invoice

# JWT Authentication
JWT_SECRET=your-super-secret-key-here
JWT_EXPIRE=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

### 3. Seed database with sample data (optional)
```bash
npm run seed
```

### 4. Start development server
```bash
npm run dev
```

The API will run on **`http://localhost:3000`**

## Available Scripts

```bash
# Development server with auto-reload
npm run dev

# Production server
npm start

# Seed database with sample data
npm run seed
```

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   └── errorHandler.js      # Error handling
│   ├── models/
│   │   ├── User.js              # User schema
│   │   ├── Client.js            # Client schema
│   │   ├── Invoice.js           # Invoice schema
│   │   └── CompanySettings.js   # Company settings schema
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── clients.js           # Client routes
│   │   ├── invoices.js          # Invoice routes
│   │   └── company.js           # Company settings routes
│   ├── services/
│   │   └── pdfGenerator.js      # PDF generation service
│   └── index.js                 # Express app entry point
├── scripts/
│   └── seed.js                  # Database seeding
├── .env.example
├── package.json
└── README.md
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user (requires auth) |

**Register Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Login Request:**
```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

### Clients

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | Get all clients (requires auth) |
| GET | `/api/clients/:id` | Get single client (requires auth) |
| POST | `/api/clients` | Create client (requires auth) |
| PUT | `/api/clients/:id` | Update client (requires auth) |
| DELETE | `/api/clients/:id` | Delete client (requires auth) |

**Create/Update Client Request:**
```json
{
  "name": "Client Name",
  "email": "client@example.com",
  "phone": "+1234567890",
  "address": "123 Main St, City"
}
```

### Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | Get all invoices (supports filters) |
| GET | `/api/invoices/:id` | Get single invoice |
| POST | `/api/invoices` | Create invoice |
| PUT | `/api/invoices/:id` | Update invoice |
| DELETE | `/api/invoices/:id` | Delete invoice |
| GET | `/api/invoices/:id/pdf` | Download invoice as PDF |

**Create Invoice Request:**
```json
{
  "clientId": "client_mongo_id",
  "invoiceDate": "2025-11-25",
  "dueDate": "2025-12-25",
  "items": [
    {
      "name": "Service 1",
      "price": 1000,
      "quantity": 1
    }
  ],
  "tax": 0,
  "discount": 0,
  "notes": "Payment terms: Net 30"
}
```

### Company Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/company` | Get company settings |
| PUT | `/api/company` | Update company settings |

**Update Company Request:**
```json
{
  "businessName": "Your Company",
  "email": "company@example.com",
  "phone": "+1234567890",
  "address": "123 Business St",
  "logo": "base64-image-string"
}
```

## Technologies Used

- **Express.js** - REST API framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **JWT** - JSON Web Token authentication
- **bcryptjs** - Password hashing
- **PDFKit** - PDF generation
- **CORS** - Cross-origin requests handling
- **dotenv** - Environment variables

## Error Handling

All API endpoints return JSON responses with appropriate HTTP status codes:

- **200** - Success
- **201** - Created
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **500** - Server Error

Error Response Format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Tokens expire after 7 days by default (configurable via `JWT_EXPIRE`).

## Database Models

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  createdAt: Date,
  updatedAt: Date
}
```

### Client
```javascript
{
  userId: ObjectId (ref: User),
  name: String,
  email: String,
  phone: String,
  address: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Invoice
```javascript
{
  userId: ObjectId (ref: User),
  clientId: ObjectId (ref: Client),
  invoiceNumber: String (unique),
  invoiceDate: Date,
  dueDate: Date,
  items: [{
    name: String,
    price: Number,
    quantity: Number
  }],
  subtotal: Number,
  tax: Number,
  discount: Number,
  total: Number,
  status: String (Paid/Pending/Overdue),
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

## Troubleshooting

### MongoDB Connection Error
- Verify MongoDB is running
- Check `MONGODB_URI` in .env
- Ensure database user has correct permissions

### JWT Token Errors
- Make sure token is included in Authorization header
- Verify token hasn't expired
- Check `JWT_SECRET` matches between client and server

### PDF Generation Issues
- Ensure all required fields are present in invoice
- Check that client data exists
- Verify company settings are configured

## Development Guidelines

1. **Code Style** - Follow ESLint configuration
2. **Error Handling** - Always use proper error middleware
3. **Database** - Use Mongoose models for all DB operations
4. **Authentication** - Use auth middleware on protected routes
5. **Validation** - Validate input data before processing

## API Response Examples

### Success Response
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Invalid credentials",
  "error": "Email or password is incorrect"
}
```

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please create an issue in the repository.
