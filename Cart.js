const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema({
  userId: {
    type: String,
    required: [true, "User ID is required"],
    index: true
  },
  items: [
    {
      productId: {
        type: String,
        required: [true, "Product ID is required"]
      },
      quantity: {
        type: Number,
        default: 1,
        min: [1, "Quantity must be at least 1"]
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Add index for products array to improve query performance
cartSchema.index({ userId: 1 });
cartSchema.index({ "items.productId": 1 });
// Virtual field for calculating total price
cartSchema.virtual("totalPrice", {
  get() {
    return this.products.reduce((sum, product) => {
      const price = product.productId; // Assuming productId is the price (or adjust accordingly)
      return sum + price * product.quantity;
    }, 0);
  }
});

module.exports = mongoose.model("Cart", cartSchema);