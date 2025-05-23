
const jwt = require('jsonwebtoken');
require('dotenv').config();

// General authentication middleware
const protect = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized, no token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized, invalid token' });
  }
};

// Admin check middleware
const admin = (req, res, next) => {
  if (req.user && (req.user.isAdmin || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied' });
  }
};

module.exports = { protect, admin };
