
const { admin } = require('../../config/firebase-config');
const { OrderModel } = require('../../Models/order-model');

// Authenticate user based on Firebase token
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = { id: decodedToken.uid };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
};

// Validate that user has purchased this order
const validatePurchase = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to access this order' });
    }
    
    if (order.status !== 'paid' && order.status !== 'completed') {
      return res.status(403).json({ error: 'Payment required to access files' });
    }
    
    req.order = order;
    next();
  } catch (error) {
    console.error('Order validation error:', error);
    res.status(500).json({ error: 'Server error validating purchase' });
  }
};

module.exports = { authenticateUser, validatePurchase };