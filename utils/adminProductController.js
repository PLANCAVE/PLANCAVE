const Product = require('../Models/Products');
const asyncHandler = require('express-async-handler');

// @desc    Get all products
// @route   GET /api/admin/products
// @access  Private/Admin
const getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({});
  res.json(products);
});

// @desc    Get product by ID
// @route   GET /api/admin/products/:id
// @access  Private/Admin
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  
  if (product) {
    res.json(product);
  } else {
    res.status(404);
    throw new Error('Product not found');
  }
});

// @desc    Create a product
// @route   POST /api/admin/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
  const { name, description, price, category, features, active } = req.body;

  const product = new Product({
    name,
    description,
    price,
    category,
    features: features || [],
    active: active !== undefined ? active : true,
    subscribers: 0,
  });

  const createdProduct = await product.save();
  res.status(201).json(createdProduct);
});

// @desc    Update a product
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
  const { name, description, price, category, features, active } = req.body;

  const product = await Product.findById(req.params.id);

  if (product) {
    product.name = name || product.name;
    product.description = description || product.description;
    product.price = price || product.price;
    product.category = category || product.category;
    product.features = features || product.features;
    product.active = active !== undefined ? active : product.active;
    product.updatedAt = Date.now();

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } else {
    res.status(404);
    throw new Error('Product not found');
  }
});

// @desc    Delete a product
// @route   DELETE /api/admin/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (product) {
    await product.remove();
    res.json({ message: 'Product removed' });
  } else {
    res.status(404);
    throw new Error('Product not found');
  }
});

// @desc    Get product statistics
// @route   GET /api/admin/products/stats
// @access  Private/Admin
const getProductStats = asyncHandler(async (req, res) => {
  const totalProducts = await Product.countDocuments();
  const activeProducts = await Product.countDocuments({ active: true });
  
  // Get products by category
  const productsByCategory = await Product.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalSubscribers: { $sum: '$subscribers' },
        averagePrice: { $avg: '$price' }
      }
    }
  ]);

  res.json({
    totalProducts,
    activeProducts,
    productsByCategory
  });
});

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats
};