router.put("/updateCart", async (req, res) => {
    const { userId, productId, quantity } = req.body;
  
    try {
      const cart = await cart.findOne({ userId });
  
      if (!cart) {
        return res.status(404).json({ error: "Cart not found" });
      }
  
      // Find the product in the cart
      const productIndex = cart.products.findIndex(
        (product) => product.productId === productId
      );
  
      if (productIndex > -1) {
        if (quantity === 0) {
          // Remove the product if quantity is set to 0
          cart.products.splice(productIndex, 1);
        } else {
          // Update the quantity
          cart.products[productIndex].quantity = quantity;
        }
  
        await cart.save();
        res.json({ message: "Cart updated", cart });
      } else {
        res.status(404).json({ error: "Product not found in cart" });
      }
    } catch (error) {
      console.error("Error updating cart:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  