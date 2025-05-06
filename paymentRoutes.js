// routes/paymentRoutes.js
router.get("/payments/:checkoutRequestID", async (req, res) => {
    const { checkoutRequestID } = req.params;
  
    try {
      const payment = await PaymentModel.findOne({ checkoutRequestID });
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
  
      res.json({ status: payment.status });
    } catch (error) {
      console.error("Error fetching payment status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });