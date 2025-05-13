const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,  // This already creates an index
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // If you need userId field, define it here with the sparse option
  userId: {
    type: String,
    sparse: true,  // This allows the field to be optional
    index: true    // This creates an index
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, { timestamps: true });


module.exports = mongoose.model('User', userSchema, 'users');