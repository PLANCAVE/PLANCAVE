const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');

const { 
  getProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getProductStats
} = require('../utils/adminProductController');
const { 
  getUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser,
  getUserStats
} = require('../utils/adminUserController');
console.log({ getUsers, getUserById, createUser, updateUser, deleteUser, getUserStats });
const { 
  getDashboardOverview, 
  getUsageAnalytics, 
  getRevenueAnalytics 
} = require('../utils/adminAnalyticsController');

// Product routes
router.route('/products')
  .get(protect, admin, getProducts)
  .post(protect, admin, createProduct);

router.route('/products/stats')
  .get(protect, admin, getProductStats);

router.route('/products/:id')
  .get(protect, admin, getProductById)
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);

// User routes
router.route('/users')
  .get(protect, admin, getUsers)
  .post(protect, admin, createUser);

router.route('/users/stats')
  .get(protect, admin, getUserStats);

router.route('/users/:id')
  .get(protect, admin, getUserById)
  .put(protect, admin, updateUser)
  .delete(protect, admin, deleteUser);

// Analytics routes
router.route('/analytics/overview')
  .get(protect, admin, getDashboardOverview);

router.route('/analytics/usage')
  .get(protect, admin, getUsageAnalytics);

router.route('/analytics/revenue')
  .get(protect, admin, getRevenueAnalytics);

module.exports = router;