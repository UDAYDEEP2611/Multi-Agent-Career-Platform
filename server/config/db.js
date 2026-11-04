const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MongoDB error: MONGODB_URI is not set");
    process.exit(1);
  }

  try 
      {
    await mongoose.connect(uri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB error:", error.message);
    process.exit(1);
  }
}



module.exports = connectDB;
