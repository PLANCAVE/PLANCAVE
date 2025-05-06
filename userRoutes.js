const express = require('express');
const User = require('../Models/User'); // Import the User schema

const router = express.Router();

// Example route: Get all users
router.get('/', async (_req, res) => {
  try {
    const users = await User.find(); // Fetch all users
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
