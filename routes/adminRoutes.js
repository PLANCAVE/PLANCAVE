
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');

// Use a backend-specific environment variable for Flask API URL
const FLASK_BACKEND_URL = process.env.FLASK_BACKEND_URL || 'http://localhost:5001/api';

// Proxy options
const proxyOptions = {
  target: FLASK_BACKEND_URL,
  changeOrigin: true,
  // Optionally, you can add pathRewrite if your Flask backend expects different paths
  // pathRewrite: { '^/admin': '/admin' },
  onProxyReq: (proxyReq, req, res) => {
    // Forward the original Authorization header if present
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }
  }
};

// Product routes
router.use('/products', protect, admin, createProxyMiddleware(proxyOptions));
router.use('/products/stats', protect, admin, createProxyMiddleware(proxyOptions));
router.use('/products/:id', protect, admin, createProxyMiddleware(proxyOptions));

// User routes
router.use('/users', protect, admin, createProxyMiddleware(proxyOptions));
router.use('/users/stats', protect, admin, createProxyMiddleware(proxyOptions));
router.use('/users/:id', protect, admin, createProxyMiddleware(proxyOptions));

// Analytics routes
router.use('/analytics/overview', protect, admin, createProxyMiddleware(proxyOptions));
router.use('/analytics/usage', protect, admin, createProxyMiddleware(proxyOptions));
router.use('/analytics/revenue', protect, admin, createProxyMiddleware(proxyOptions));

module.exports = router;
