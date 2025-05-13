
const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();


const {
  passwordUtils,
  tokenUtils,
  sanitization
} = require('../utils/security');

// Reference to the MongoDB collections
let usersCollection;

// Initialize the router with the MongoDB collections
const initAuthRoutes = (db) => {
  usersCollection = db.collection('users');
  return router;
};

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', async (req, res) => {
  // Sanitize input
  const sanitizedBody = sanitization.sanitizeObject(req.body);
  const { email, password, firstName, lastName, role = 'user' } = sanitizedBody;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  // Validate password strength
  const { isValid, message } = passwordUtils.validatePasswordStrength(password);
  if (!isValid) {
    return res.status(400).json({ message });
  }

  try {
    // Check if user exists
    const userExists = await usersCollection.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await passwordUtils.hashPassword(password);

    // Create user
    const result = await usersCollection.insertOne({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      createdAt: new Date(),
      lastLogin: null,
      isActive: true
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: result.insertedId,
        email,
        role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/auth/login
 * @desc Authenticate user & get token
 * @access Public
 */
router.post('/login', async (req, res) => {
  // Sanitize input
  const sanitizedBody = sanitization.sanitizeObject(req.body);
  const { email, password } = sanitizedBody;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Find user
    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is disabled. Please contact admin.' });
    }

    // Check password
    const validPassword = await passwordUtils.comparePassword(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Update last login
    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    // Generate JWT token
    const token = tokenUtils.generateToken(
      { id: user._id, email: user.email, role: user.role },
      '24h'
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/auth/verify
 * @desc Verify JWT token
 * @access Public
 */
router.post('/verify', async (req, res) => {
  // Sanitize input
  const sanitizedBody = sanitization.sanitizeObject(req.body);
  const { token } = sanitizedBody;

  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }

  try {
    const decoded = tokenUtils.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ valid: false, message: 'Invalid token' });
    }

    // Check if user still exists and is active
    const userId = new ObjectId(decoded.id);
    const user = await usersCollection.findOne({ _id: userId });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is disabled' });
    }

    res.json({
      valid: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    res.status(401).json({ valid: false, message: 'Invalid token' });
  }
});

module.exports = initAuthRoutes;
