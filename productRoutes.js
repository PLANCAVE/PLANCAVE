// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const Product = require('../Models/Products');
const mongoose = require('mongoose');

// Helper function to check MongoDB connection
const checkMongoConnection = async () => {
  if (mongoose.connection.readyState !== 1) {
    console.log('MongoDB not connected, attempting reconnection...');
    try {
      // Assuming connectDB is available - you might need to import it
      const { connectDB } = require('../config/db');
      await connectDB();
      return true;
    } catch (error) {
      console.error('Failed to reconnect to MongoDB:', error);
      return false;
    }
  }
  return true;
};

// Debug route to check connection and schema
router.get('/debug', async (_req, res) => {
  try {
    // Check MongoDB connection
    const dbState = mongoose.connection.readyState;
    const dbStateText = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    }[dbState] || 'unknown';
    
    // Get Product schema info
    const productSchema = mongoose.model('Product').schema;
    const schemaFields = Object.keys(productSchema.paths);
    
    // Try to fetch one product as a test
    let sampleProduct = null;
    let error = null;
    try {
      sampleProduct = await Product.findOne().lean().maxTimeMS(5000);
    } catch (err) {
      error = err.message;
    }
    
    // Return debug info
    res.status(200).json({
      mongoConnection: {
        readyState: dbState,
        status: dbStateText
      },
      productSchema: {
        modelName: 'Product',
        fields: schemaFields
      },
      sampleProduct,
      error
    });
  } catch (error) {
    res.status(500).json({ message: 'Debug route error', error: error.message });
  }
});

// GET all products with filtering, pagination and retry logic
router.get('/', async (req, res) => {
  console.log('-------- PRODUCT ROUTE REQUEST --------');
  console.log('Query params:', req.query);
  console.log('URL:', req.originalUrl);
  
  // Check MongoDB connection first
  const isConnected = await checkMongoConnection();
  if (!isConnected) {
    return res.status(500).json({ 
      message: 'Database connection error',
      error: 'Failed to connect to MongoDB' 
    });
  }
  
  try {
    // Get pagination parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    
    // Build filter object - only include non-null/undefined values
    const filters = {};
    const filterFields = ['style', 'budget', 'size', 'category', 'id', 'area', 'bedrooms', 'floors'];
    
    filterFields.forEach(field => {
      if (req.query[field] && req.query[field] !== 'null' && req.query[field] !== 'undefined') {
        filters[field] = req.query[field];
      }
    });
    
    console.log('Applying filters:', filters);
    console.log('Pagination: page', page, 'limit', limit, 'skip', skip);
    
    // Set maxTimeMS to prevent timeout
    const options = { maxTimeMS: 30000 }; // 30 second timeout
    
    // Apply filters to query with maxTimeMS
    const products = await Product.find(filters, null, options)
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() for better performance
    
    // Get total count for pagination
    const total = await Product.countDocuments(filters);
    const totalPages = Math.ceil(total / limit);
    
    // Return formatted response
    res.status(200).json({
      data: products,
      totalPages,
      currentPage: page,
      totalItems: total
    });
  } catch (error) {
    console.error('Product fetch error:', error);
    
    // Check if this is a timeout error
    if (error.message && error.message.includes('timed out')) {
      return res.status(500).json({
        message: 'Database query timed out',
        error: error.message,
        suggestion: 'Try more specific filters or increase server timeout settings'
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to fetch products', 
      error: error.message 
    });
  }
});

// GET product by ID 
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).maxTimeMS(10000);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch product', error: error.message });
  }
});

// POST create a new product (Admin only)
router.post('/', async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
});

// PUT update a product by ID (Admin only)
router.put('/:id', async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedProduct) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
});

// DELETE a product by ID (Admin only)
router.delete('/:id', async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product', error: error.message });
  }
});

module.exports = router;