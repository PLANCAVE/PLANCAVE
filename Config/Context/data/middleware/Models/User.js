const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Plan' }],
  cart: [
    {
      plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
      quantity: { type: Number, default: 1 },
    },
  ],
}, { timestamps: true });

userSchema.index({ username: 1 }, { unique: true }); // Ensure unique username

module.exports = mongoose.model('User', userSchema);

