const express = require("express");
const router = express.Router();
const Cart = require("../Models/Cart");

router.post("/addToCart", async (req, res) => {
  const { userId, productId, quantity } = req.body;

  try {
    // Validate the input
    if (!userId || !productId) {
      return res.status(400).json({ error: "User ID and Product ID are required" });
    }

    // Check if the user already has a cart
    let cart = await Cart.findOne({ userId });

    if (cart) {
      // Check if the product already exists in the cart
      const productIndex = cart.products.findIndex(
        (product) => product.productId === productId
      );

      if (productIndex > -1) {
        // If the product exists, update its quantity
        cart.products[productIndex].quantity += quantity || 1;
      } else {
        // If the product doesn’t exist, add it to the cart
        cart.products.push({ productId, quantity: quantity || 1 });
      }
    } else {
      // If no cart exists, create a new one
      cart = new Cart({
        userId,
        products: [{ productId, quantity: quantity || 1 }],
      });
    }

    // Save the cart
    await cart.save();

    res.json({ message: "Product added to cart", cart });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
