import { v2 as cloudinary } from "cloudinary"
import dotenv from "dotenv"

dotenv.config()

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL.trim(),
    secure: true
  })
} else {
  cloudinary.config({
    cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
    api_key: (process.env.CLOUDINARY_API_KEY || "").trim(),
    api_secret: (process.env.CLOUDINARY_API_SECRET || "").trim(),
    secure: true
  })
}

console.log("Cloudinary Config Loaded:", {
  using_url: !!process.env.CLOUDINARY_URL,
  cloud_name: cloudinary.config().cloud_name,
  api_key: cloudinary.config().api_key,
  has_secret: !!cloudinary.config().api_secret
})

export default cloudinary
