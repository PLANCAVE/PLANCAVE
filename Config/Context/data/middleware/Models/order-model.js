const mongoose = require('mongoose');

// Define the order schema
const orderSchema = new mongoose.Schema({
  // Customer information
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },
  // Order items
  items: [{
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 }
  }],
  // Payment information
  payment: {
    method: { type: String, enum: ['credit_card', 'paypal', 'bank_transfer'], required: true },
    transactionId: String,
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' }
  },
  // Order status
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'cancelled'], 
    default: 'pending' 
  },
  // Order totals
  subtotal: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  total: { type: Number, required: true },
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create the Order model
const Order = mongoose.model('Order', orderSchema);

// Order model operations
const OrderModel = {
  async create(orderData) {
    try {
      const order = new Order(orderData);
      await order.save();
      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  },
  
  async findById(orderId) {
    try {
      const order = await Order.findById(orderId);
      return order;
    } catch (error) {
      console.error(`Error finding order ${orderId}:`, error);
      throw error;
    }
  },
  
  async updateStatus(orderId, status) {
    try {
      return await Order.findByIdAndUpdate(
        orderId, 
        { 
          status, 
          updatedAt: Date.now() 
        },
        { new: true }
      );
    } catch (error) {
      console.error(`Error updating order ${orderId}:`, error);
      throw error;
    }
  },
  
  async findAll() {
    try {
      return await Order.find().sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error finding all orders:', error);
      throw error;
    }
  }
};

module.exports = { OrderModel, Order };