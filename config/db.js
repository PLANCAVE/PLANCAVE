require("dotenv").config();
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("ERROR: MONGODB_URI is not defined");
  process.exit(1);
}

// Connection options to optimize stability
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000, // Avoid premature server timeout
  socketTimeoutMS: 45000, // Prevent socket closure issues
  maxPoolSize: 100, // Maintain connection pool efficiently
  minPoolSize: 10,
  heartbeatFrequencyMS: 10000,
};

let cachedClient = null; // Ensures a reusable singleton connection

async function connectDB() {
  if (cachedClient && mongoose.connection.readyState === 1) {
    console.log("Using cached MongoDB connection.");
    return cachedClient;
  }

  try {
    cachedClient = await mongoose.connect(uri, mongooseOptions);
    console.log("MongoDB connected successfully!");

    // Connection event listeners
    mongoose.connection.on("error", (err) => {
      console.error("Mongoose connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("Mongoose connection lost. Attempting reconnection...");
      connectDB(); // Auto-reconnect on disconnect
    });

    return cachedClient;
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }
}

// Function to validate connection state before queries
function checkConnection() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Database not connected. Ensure connectDB() is called first.");
  }
}

// Graceful shutdown handling to clean up connections
async function closeConnection() {
  try {
    if (cachedClient) {
      await mongoose.disconnect();
      cachedClient = null;
      console.log("MongoDB connection closed cleanly.");
    }
  } catch (err) {
    console.error("Error closing MongoDB connection:", err);
  }
}

process.on("SIGINT", closeConnection);
process.on("SIGTERM", closeConnection);

module.exports = { connectDB, checkConnection, mongoose };
