const jwt = require('jsonwebtoken');

/**
 * Generate a JWT for a user
 * @param {Object} user - The user object (should contain at least id, email, role)
 * @returns {string} - Signed JWT
 */
function generateJwtForUser(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in environment variables');
  }
  // You can customize the payload as needed
  const payload = {
    id: user._id ? user._id.toString() : user.id,
    email: user.email,
    role: user.role,
  };
  // Token expires in 7 days (adjust as needed)
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verify a JWT and return the decoded payload
 * @param {string} token - JWT string
 * @returns {Object} - Decoded payload
 * @throws {Error} - If verification fails
 */
function verifyJwt(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in environment variables');
  }
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = {
  generateJwtForUser,
  verifyJwt,
};