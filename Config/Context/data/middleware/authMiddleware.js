const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware to check if the user is an admin
const adminAuthMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Get token from headers
    if (!token) return res.status(401).json({ error: 'Unauthorized, no token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify token
    if (!decoded || !decoded.isAdmin) return res.status(403).json({ error: 'Access denied' });

    req.user = decoded; // Attach user info to request
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized, invalid token' });
  }
};

module.exports = { adminAuthMiddleware };
