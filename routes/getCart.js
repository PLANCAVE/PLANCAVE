router.get("/getCart/:userId", async (req, res) => {
    const { userId } = req.params;
  
    try {
      // Find the user's cart
      const cart = await cart.findOne({ userId });
  
      if (!cart) {
        return res.status(404).json({ error: "Cart not found" });
      }
  
      res.json(cart);
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  