const axios = require('axios');

const FLASK_BACKEND_URL = process.env.FLASK_BACKEND_URL || "http://localhost:5001";

/**
 * Generate a JWT for a user using Flask backend
 * @param {Object} user - The user object (should contain at least username & password)
 * @returns {Promise<string>} - Signed JWT
 */
async function generateJwtForUser(user) {
  try {
    const response = await axios.post(`${FLASK_BACKEND_URL}/login`, {
      username: user.username,
      password: user.password,
    });

    if (!response.data || !response.data.access_token) {
      throw new Error("Failed to retrieve JWT from Flask backend");
    }

    return response.data.access_token;
  } catch (error) {
    console.error("Error generating JWT:", error.response?.data || error.message);
    throw new Error("JWT generation failed");
  }
}

/**
 * Verify a JWT using Flask backend
 * @param {string} token - JWT string
 * @returns {Promise<Object>} - Decoded payload
 * @throws {Error} - If verification fails
 */
async function verifyJwt(token) {
  try {
    const response = await axios.post(`${FLASK_BACKEND_URL}/verify_token`, {
      token,
    });

    if (!response.data || !response.data.valid) {
      throw new Error("JWT verification failed");
    }

    return response.data.payload; // Assuming Flask returns decoded user data
  } catch (error) {
    console.error("Error verifying JWT:", error.response?.data || error.message);
    throw new Error("Token verification failed");
  }
}

module.exports = {
  generateJwtForUser,
  verifyJwt,
};
