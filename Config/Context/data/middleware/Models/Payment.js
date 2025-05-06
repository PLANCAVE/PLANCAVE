// models/Payment.js
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  checkoutRequestID: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
  transactionId: { type: String }, // Make optional
  productId: { type: String }, // Make optional
  userId: { type: String }, // Make optional
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Payment", paymentSchema);