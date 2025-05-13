const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to User schema
  plans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Plan' }], // Array of Plan references
}, { timestamps: true });
//wishlistSchema.index({ userId: 1 }); // Index userId to find user-specific wishlist

module.exports = mongoose.model('Wishlist', wishlistSchema);
