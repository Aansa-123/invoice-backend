import mongoose from "mongoose"
import dotenv from "dotenv"
dotenv.config()

const dropIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log("Connected to MongoDB")
    
    const db = mongoose.connection.db
    const collection = db.collection("companysettings")
    
    // Check if index exists
    const indexes = await collection.indexes()
    console.log("Current indexes:", indexes)
    
    const userIdIndex = indexes.find(idx => idx.name === "userId_1")
    if (userIdIndex) {
      await collection.dropIndex("userId_1")
      console.log("Dropped userId_1 index from companysettings")
    } else {
      console.log("userId_1 index not found in companysettings")
    }
    
    // Also check organizations collection just in case
    const orgCollection = db.collection("organizations")
    const orgIndexes = await orgCollection.indexes()
    console.log("Organization indexes:", orgIndexes)
    
    process.exit(0)
  } catch (error) {
    console.error("Error dropping index:", error)
    process.exit(1)
  }
}

dropIndex()
