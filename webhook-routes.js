const crypto = require('crypto');
const { OrderModel } = require('../Models/order-model');
const { generateOrderFiles } = require('../utils/file-service');

// Handle payment webhook
const handlePaymentWebhook = async (req, res) => {
  try {
    // Get the signature from headers
    const signature = req.headers['x-payment-signature'];
    
    // Verify webhook (adjust for your payment provider)
    const payload = req.body;
    let payloadString = payload;
    
    // If payload is a Buffer, convert to string
    if (Buffer.isBuffer(payload)) {
      payloadString = payload.toString();
    }
    
    // If payload is already a string, use it directly
    if (typeof payloadString !== 'string') {
      payloadString = JSON.stringify(payloadString);
    }
    
    // Verify signature (implementation depends on your payment provider)
    const expectedSignature = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET)
      .update(payloadString)
      .digest('hex');
      
    if (process.env.NODE_ENV === 'production' && signature !== expectedSignature) {
      return res.status(400).send('Invalid signature');
    }

    // Parse the payload if needed
    const event = typeof payload === 'string' ? JSON.parse(payload) : payload;
    
    // Process the webhook event based on type
    if (event.type === 'payment_success' || event.type === 'checkout.session.completed') {
      const orderId = event.data.orderId || event.data.metadata?.orderId;
      
      if (!orderId) {
        return res.status(400).send('Order ID not found in webhook payload');
      }
      
      // Find the order in database
      const order = await OrderModel.findById(orderId);
      
      if (!order) {
        return res.status(404).send(`Order ${orderId} not found`);
      }
      
      // Update order status
      order.paymentStatus = 'paid';
      order.updatedAt = new Date();
      await order.save();
      
      // Generate files for the order
      await generateOrderFiles(order);
      
      console.log(`Payment confirmed for order ${orderId}`);
      return res.status(200).send('Webhook processed successfully');
    }
    
    // Handle other event types if needed
    return res.status(200).send('Event received but no action taken');
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).send('Error processing webhook');
  }
};

// Route handler for webhook
const webhookRoutes = (app) => {
  app.post('/api/webhooks/payment', handlePaymentWebhook);
};

module.exports = {
  webhookRoutes,
  handlePaymentWebhook // Export for testing
};