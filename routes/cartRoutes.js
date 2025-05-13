const express = require('express');
const Cart = require('../Models/Cart'); // Import Cart schema
const Plan = require('../Models/Plan'); // Import Plan schema for validation
const router = express.Router();

// Get cart for a specific user
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found for this user' });
    }
    res.status(200).json(cart);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a plan to the cart
router.post('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { planId, quantity } = req.body;

  try {
    console.log('Attempting to add plan to cart:', { userId, planId, quantity });

    // Ensure the plan exists
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Check if the user already has a cart
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      // Create a new cart if none exists
      cart = new Cart({ userId, items: [{ productId: planId, quantity }] });
    } else {
      // Check if the plan already exists in the cart
      const existingItem = cart.items.find((item) => item.productId.toString() === planId);
      if (existingItem) {
        // Update the quantity of the existing item
        existingItem.quantity += quantity;
      } else {
        // Add the plan to the cart
        cart.items.push({ productId: planId, quantity });
      }
    }

    const updatedCart = await cart.save();
    res.status(201).json(updatedCart);
  } catch (error) {
    console.error('Error adding plan to cart:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove a plan from the cart
router.delete('/:userId/:planId', async (req, res) => {
  const { userId, planId } = req.params;

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found for this user' });
    }

    // Remove the plan from the cart
    cart.items = cart.items.filter((item) => item.productId.toString() !== planId);

    const updatedCart = await cart.save();
    res.status(200).json(updatedCart);
  } catch (error) {
    console.error('Error removing plan from cart:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update quantity of a plan in the cart
router.put('/:userId/:planId', async (req, res) => {
  const { userId, planId } = req.params;
  const { quantity } = req.body;

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found for this user' });
    }

    const item = cart.items.find((item) => item.productId.toString() === planId);
    if (item) {
      item.quantity = quantity; // Update quantity
    } else {
      return res.status(404).json({ message: 'Plan not found in the cart' });
    }

    const updatedCart = await cart.save();
    res.status(200).json(updatedCart);
  } catch (error) {
    console.error('Error updating plan quantity:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;