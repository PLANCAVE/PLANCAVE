
const { Pool } = require('pg');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');

// Configure your PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Set this in your environment
});

// Helper function to map user row to API response
function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    subscription: row.subscription,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, is_active, subscription, created_at, updated_at FROM users ORDER BY id'
  );
  const users = rows.map(mapUserRow);
  res.json(users);
});

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    'SELECT id, name, email, role, is_active, subscription, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  const user = mapUserRow(rows[0]);
  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Create a user
// @route   POST /api/admin/users
// @access  Private/Admin
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, isActive } = req.body;

  // Check if user exists
  const existsResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existsResult.rows.length > 0) {
    res.status(400);
    throw new Error('User already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Insert user
  const result = await pool.query(
    `INSERT INTO users (name, email, password, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id, name, email, role, is_active, subscription, created_at, updated_at`,
    [
      name,
      email,
      hashedPassword,
      role || 'user',
      isActive !== undefined ? isActive : true,
    ]
  );
  const user = mapUserRow(result.rows[0]);
  res.status(201).json(user);
});

// @desc    Update a user
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, role, isActive, subscription } = req.body;

  // Fetch existing user
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  const user = rows[0];
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Update fields if provided, else keep existing
  const updatedFields = {
    name: name || user.name,
    email: email || user.email,
    role: role || user.role,
    is_active: isActive !== undefined ? isActive : user.is_active,
    subscription: subscription || user.subscription,
  };

  const result = await pool.query(
    `UPDATE users
     SET name = $1, email = $2, role = $3, is_active = $4, subscription = $5, updated_at = NOW()
     WHERE id = $6
     RETURNING id, name, email, role, is_active, subscription, created_at, updated_at`,
    [
      updatedFields.name,
      updatedFields.email,
      updatedFields.role,
      updatedFields.is_active,
      updatedFields.subscription,
      id,
    ]
  );
  const updatedUser = mapUserRow(result.rows[0]);
  res.json(updatedUser);
});

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Check if user exists
  const { rows } = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
  if (!rows[0]) {
    res.status(404);
    throw new Error('User not found');
  }
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
  res.json({ message: 'User removed' });
});

// @desc    Get user statistics
// @route   GET /api/admin/users/stats
// @access  Private/Admin
const getUserStats = asyncHandler(async (_req, res) => {
  // Total users
  const totalUsersResult = await pool.query('SELECT COUNT(*) FROM users');
  const totalUsers = parseInt(totalUsersResult.rows[0].count, 10);

  // Active users
  const activeUsersResult = await pool.query('SELECT COUNT(*) FROM users WHERE is_active = TRUE');
  const activeUsers = parseInt(activeUsersResult.rows[0].count, 10);

  // Admin, designer, customer users
  const adminUsersResult = await pool.query(
    "SELECT COUNT(*) FROM users WHERE role IN ('admin', 'designer', 'customer')"
  );
  const adminUsers = parseInt(adminUsersResult.rows[0].count, 10);

  // New users this month
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newUsersThisMonthResult = await pool.query(
    'SELECT COUNT(*) FROM users WHERE created_at >= $1',
    [thisMonth]
  );
  const newUsersThisMonth = parseInt(newUsersThisMonthResult.rows[0].count, 10);

  // Users by subscription (join with products table)
  const usersBySubscriptionResult = await pool.query(`
    SELECT
      p.category AS subscription_category,
      COUNT(u.id) AS count
    FROM users u
    LEFT JOIN products p ON u.subscription = p.id
    GROUP BY p.category
  `);

  const usersBySubscription = usersBySubscriptionResult.rows.map(row => ({
    category: row.subscription_category,
    count: parseInt(row.count, 10),
  }));

  res.json({
    totalUsers,
    activeUsers,
    adminUsers,
    newUsersThisMonth,
    usersBySubscription,
  });
});

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
};
