
const { Pool } = require('pg');
const asyncHandler = require('express-async-handler');

// Configure your PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Set this in your environment
});

// Helper function to parse product row to API response
function mapProductRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: parseFloat(row.price),
    category: row.category,
    features: row.features || [],
    active: row.active,
    subscribers: row.subscribers,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// @desc    Get all products
// @route   GET /api/admin/products
// @access  Private/Admin
const getProducts = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY id');
  const products = rows.map(mapProductRow);
  res.json(products);
});

// @desc    Get product by ID
// @route   GET /api/admin/products/:id
// @access  Private/Admin
const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  const product = mapProductRow(rows[0]);
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
  const result = await pool.query(
    `INSERT INTO products (name, description, price, category, features, active, subscribers, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 0, NOW(), NOW())
     RETURNING *`,
    [
      name,
      description,
      price,
      category,
      features || [],
      active !== undefined ? active : true,
    ]
  );
  const createdProduct = mapProductRow(result.rows[0]);
  res.status(201).json(createdProduct);
});

// @desc    Update a product
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, features, active } = req.body;

  // Fetch existing product
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  const product = rows[0];
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // Update fields if provided, else keep existing
  const updatedFields = {
    name: name || product.name,
    description: description || product.description,
    price: price !== undefined ? price : product.price,
    category: category || product.category,
    features: features || product.features,
    active: active !== undefined ? active : product.active,
  };

  const result = await pool.query(
    `UPDATE products
     SET name = $1, description = $2, price = $3, category = $4, features = $5, active = $6, updated_at = NOW()
     WHERE id = $7
     RETURNING *`,
    [
      updatedFields.name,
      updatedFields.description,
      updatedFields.price,
      updatedFields.category,
      updatedFields.features,
      updatedFields.active,
      id,
    ]
  );
  const updatedProduct = mapProductRow(result.rows[0]);
  res.json(updatedProduct);
});

// @desc    Delete a product
// @route   DELETE /api/admin/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Check if product exists
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  if (!rows[0]) {
    res.status(404);
    throw new Error('Product not found');
  }
  await pool.query('DELETE FROM products WHERE id = $1', [id]);
  res.json({ message: 'Product removed' });
});

// @desc    Get product statistics
// @route   GET /api/admin/products/stats
// @access  Private/Admin
const getProductStats = asyncHandler(async (_req, res) => {
  // Total products
  const totalProductsResult = await pool.query('SELECT COUNT(*) FROM products');
  const totalProducts = parseInt(totalProductsResult.rows[0].count, 10);

  // Active products
  const activeProductsResult = await pool.query('SELECT COUNT(*) FROM products WHERE active = TRUE');
  const activeProducts = parseInt(activeProductsResult.rows[0].count, 10);

  // Products by category
  const productsByCategoryResult = await pool.query(`
    SELECT
      category,
      COUNT(*) AS count,
      SUM(subscribers) AS total_subscribers,
      AVG(price) AS average_price
    FROM products
    GROUP BY category
  `);

  const productsByCategory = productsByCategoryResult.rows.map(row => ({
    category: row.category,
    count: parseInt(row.count, 10),
    totalSubscribers: parseInt(row.total_subscribers, 10) || 0,
    averagePrice: parseFloat(row.average_price) || 0,
  }));

  res.json({
    totalProducts,
    activeProducts,
    productsByCategory,
  });
});

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
};
