const Payment = require('../Models/Payment');

const checkPayment = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming user info is stored in req.user after authentication
    const { productId } = req.params; // Get product ID from the request

    // Find a successful payment for this user and product
    const payment = await Payment.findOne({
      userId,
      productId,
      status: 'completed'
    });

    if (!payment) {
      return res.status(403).json({ message: 'Access denied. Please purchase this file first.' });
    }

    // If payment is found, proceed to download
    next();
  } catch (error) {
    console.error('Error checking payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = checkPayment;
