const jwt = require('jsonwebtoken');

/**
 * Middleware to protect routes using JWT.
 * Usage: app.use('/protected', authenticateToken)
 */
const authenticateToken = (req, res, next) => {
  // Accept token from Authorization: Bearer ... or x-access-token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : req.headers['x-access-token'];

  if (!token) return res.status(401).json({ message: 'No token provided.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken };
