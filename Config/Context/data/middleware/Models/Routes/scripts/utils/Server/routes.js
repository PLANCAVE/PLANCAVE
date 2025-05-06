const express = require('express');
const axios = require('axios');
const { requireAuth } = require('@clerk/clerk-sdk-node');

const router = express.Router();

// Axios instance
const axiosInstance = axios.create({
    baseURL: 'http://localhost:5000/api', // Adjust the API base URL as needed
});

// Example public route
router.get('/', (_req, res) => {
    res.send('Welcome to The Plan Cave API!');
});

// Example usage of axiosInstance in a route
router.get('/api/products', async (req, res) => {
    try {
        console.log('Request query params:', req.query);
        const response = await axiosInstance.get('/products', { params: req.query });
        console.log('API response data:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching products from API:', error.message);
        res.status(500).json({ error: 'Failed to fetch products from API' });
    }
});


// Example authenticated route
router.get('/protected', requireAuth, (req, res) => {
    if (!req.auth?.user) {
        return res.status(401).json({ error: 'Unauthorized access' });
    }
    res.json({
        message: `Hello ${req.auth.user.firstName}, you are successfully authenticated!`,
        user: req.auth.user,
    });
});

module.exports = router;
