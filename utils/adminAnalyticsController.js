const { Pool } = require('pg');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');

// Configure your PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Set this in your environment
});

// Helper: Map user row to API response
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

// Helper: Map product row to API response
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

// ========== USER MANAGEMENT (Admin) ==========

const getUsers = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, is_active, subscription, created_at, updated_at FROM users ORDER BY id'
  );
  res.json(rows.map(mapUserRow));
});

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

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, ...rest } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email, and password are required');
  }
  const existsResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existsResult.rows.length > 0) {
    res.status(400);
    throw new Error('User already exists');
  }
  const hashedPassword = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users (name, email, password, role, is_active, subscription, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING id, name, email, role, is_active, subscription, created_at, updated_at`,
    [
      name,
      email,
      hashedPassword,
      rest.role || 'user',
      rest.isActive !== undefined ? rest.isActive : true,
      rest.subscription || null,
    ]
  );
  res.status(201).json(mapUserRow(result.rows[0]));
});

const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, role, isActive, subscription } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  const user = rows[0];
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
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
  res.json(mapUserRow(result.rows[0]));
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
  if (!rows[0]) {
    res.status(404);
    throw new Error('User not found');
  }
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
  res.json({ message: 'User removed' });
});

const getUserStats = asyncHandler(async (_req, res) => {
  // Count users by registration month for the last 12 months
  const now = new Date();
  const lastYear = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
  const statsResult = await pool.query(
    `SELECT
      EXTRACT(YEAR FROM created_at) AS year,
      EXTRACT(MONTH FROM created_at) AS month,
      COUNT(*) AS count
     FROM users
     WHERE created_at >= $1
     GROUP BY year, month
     ORDER BY year, month`,
    [lastYear]
  );
  const formattedStats = statsResult.rows.map(item => {
    const date = new Date(item.year, item.month - 1);
    return {
      month: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      count: parseInt(item.count, 10),
    };
  });
  res.json(formattedStats);
});

// ========== ANALYTICS ==========

const getDashboardOverview = asyncHandler(async (_req, res) => {
  // Total users
  const totalUsersResult = await pool.query('SELECT COUNT(*) FROM users');
  const totalUsers = parseInt(totalUsersResult.rows[0].count, 10);

  // Active users
  const activeUsersResult = await pool.query('SELECT COUNT(*) FROM users WHERE is_active = TRUE');
  const activeUsers = parseInt(activeUsersResult.rows[0].count, 10);

  // Total products
  const totalProductsResult = await pool.query('SELECT COUNT(*) FROM products');
  const totalProducts = parseInt(totalProductsResult.rows[0].count, 10);

  // Today and yesterday analytics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const todayAnalyticsResult = await pool.query(
    'SELECT * FROM analytics WHERE date = $1 LIMIT 1',
    [todayStr]
  );
  const todayAnalytics = todayAnalyticsResult.rows[0];

  const yesterdayAnalyticsResult = await pool.query(
    'SELECT * FROM analytics WHERE date = $1 LIMIT 1',
    [yesterdayStr]
  );
  const yesterdayAnalytics = yesterdayAnalyticsResult.rows[0];

  const dailyActiveUsers = todayAnalytics?.daily_active_users || 0;
  const dailyActiveUsersGrowth = yesterdayAnalytics?.daily_active_users
    ? ((dailyActiveUsers - yesterdayAnalytics.daily_active_users) / yesterdayAnalytics.daily_active_users) * 100
    : 0;

  const revenue = todayAnalytics?.revenue || 0;
  const revenueGrowth = yesterdayAnalytics?.revenue
    ? ((revenue - yesterdayAnalytics.revenue) / yesterdayAnalytics.revenue) * 100
    : 0;

  res.json({
    totalUsers,
    activeUsers,
    totalProducts,
    dailyActiveUsers,
    dailyActiveUsersGrowth,
    revenue,
    revenueGrowth,
  });
});

const getUsageAnalytics = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 7;
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const dailyAnalyticsResult = await pool.query(
    `SELECT * FROM analytics WHERE date BETWEEN $1 AND $2 ORDER BY date ASC`,
    [startStr, endStr]
  );
  const dailyAnalytics = dailyAnalyticsResult.rows;

  const usage = dailyAnalytics.map(day => ({
    day: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
    visits: day.page_views,
    activeUsers: day.daily_active_users,
    date: day.date.toISOString().split('T')[0],
  }));

  // Get the latest analytics row
  const latestAnalyticsResult = await pool.query(
    `SELECT * FROM analytics ORDER BY date DESC LIMIT 1`
  );
  const latestAnalytics = latestAnalyticsResult.rows[0];

  // Parse JSONB fields
  const userTypes = latestAnalytics?.product_usage
    ? Object.entries(latestAnalytics.product_usage).map(([name, value]) => ({ name, value }))
    : [];

  const featureUsage = latestAnalytics?.feature_usage
    ? Object.entries(latestAnalytics.feature_usage).map(([feature, usage]) => ({ feature, usage }))
    : [];

  const geoData = latestAnalytics?.geographic_data
    ? Object.entries(latestAnalytics.geographic_data).map(([name, value]) => ({ name, value }))
    : [];

  res.json({
    dailyActive: latestAnalytics?.daily_active_users || 0,
    weeklyActive: dailyAnalytics.reduce((sum, day) => sum + day.daily_active_users, 0),
    averageSessionTime: latestAnalytics?.average_session_time || 0,
    usage,
    userTypes,
    featureUsage,
    geoData,
  });
});

const getRevenueAnalytics = asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months, 10) || 6;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  // Monthly revenue aggregation
  const monthlyRevenueResult = await pool.query(
    `SELECT
      EXTRACT(YEAR FROM date) AS year,
      EXTRACT(MONTH FROM date) AS month,
      SUM(revenue) AS revenue
     FROM analytics
     WHERE date BETWEEN $1 AND $2
     GROUP BY year, month
     ORDER BY year, month`,
    [startStr, endStr]
  );
  const monthly = monthlyRevenueResult.rows.map(item => {
    const date = new Date(item.year, item.month - 1);
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      revenue: parseFloat(item.revenue),
    };
  });

  const total = monthly.reduce((sum, month) => sum + month.revenue, 0);

  let growth = 0;
  if (monthly.length >= 2) {
    const lastMonth = monthly[monthly.length - 1].revenue;
    const previousMonth = monthly[monthly.length - 2].revenue;
    growth = previousMonth ? ((lastMonth - previousMonth) / previousMonth) * 100 : 0;
  }

  // Revenue by product
  const productsResult = await pool.query('SELECT * FROM products');
  const products = productsResult.rows;
  const revenueByProduct = products.map(product => ({
    name: product.name,
    value: parseFloat(product.price) * (product.subscribers || 0),
  }));

  res.json({
    total,
    growth,
    monthly,
    revenueByProduct,
  });
});

// ========== TRACK ACTIVITY ==========

const trackActivity = asyncHandler(async (req, res) => {
  const {
    userId,
    event,
    feature,
    sessionTime,
    country,
    amount,
  } = req.body;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Get or create today's analytics row
  let analyticsResult = await pool.query('SELECT * FROM analytics WHERE date = $1 LIMIT 1', [todayStr]);
  let analytics = analyticsResult.rows[0];

  if (!analytics) {
    // Insert new analytics row for today
    await pool.query(
      `INSERT INTO analytics
        (date, daily_active_users, new_users, returning_users, page_views, average_session_time, feature_usage, geographic_data, product_usage, revenue, created_at, updated_at)
       VALUES
        ($1, 0, 0, 0, 0, 0, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 0, NOW(), NOW())`,
      [todayStr]
    );
    analyticsResult = await pool.query('SELECT * FROM analytics WHERE date = $1 LIMIT 1', [todayStr]);
    analytics = analyticsResult.rows[0];
  }

  // Helper to update JSONB fields
  const incrementJsonbField = async (field, key, increment = 1) => {
    await pool.query(
      `UPDATE analytics
       SET ${field} = COALESCE(${field}, '{}'::jsonb) || jsonb_build_object($1, COALESCE((${field} ->> $1)::int, 0) + $2),
           updated_at = NOW()
       WHERE date = $3`,
      [key, increment, todayStr]
    );
  };

  switch (event) {
    case 'pageView':
      await pool.query(
        `UPDATE analytics SET page_views = page_views + 1, updated_at = NOW() WHERE date = $1`,
        [todayStr]
      );
      break;
    case 'userActive':
      if (userId) {
        // Get user
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];
        if (user) {
          const lastLogin = user.last_login ? new Date(user.last_login) : null;
          const isNewUser =
            !lastLogin || lastLogin.toDateString() !== today.toDateString();

          if (isNewUser) {
            await pool.query(
              `UPDATE analytics SET daily_active_users = daily_active_users + 1, updated_at = NOW() WHERE date = $1`,
              [todayStr]
            );
            await pool.query(
              `UPDATE users SET last_login = NOW() WHERE id = $1`,
              [userId]
            );

            const createdAt = user.created_at ? new Date(user.created_at) : null;
            if (
              createdAt &&
              createdAt.toDateString() === today.toDateString()
            ) {
              await pool.query(
                `UPDATE analytics SET new_users = new_users + 1, updated_at = NOW() WHERE date = $1`,
                [todayStr]
              );
            } else {
              await pool.query(
                `UPDATE analytics SET returning_users = returning_users + 1, updated_at = NOW() WHERE date = $1`,
                [todayStr]
              );
            }

            // Product usage by category
            if (user.subscription) {
              const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [user.subscription]);
              const product = productResult.rows[0];
              if (product) {
                await incrementJsonbField('product_usage', product.category);
              }
            } else {
              await incrementJsonbField('product_usage', 'Free');
            }
          }
        }
      }
      break;
    case 'featureUse':
      if (feature) {
        await incrementJsonbField('feature_usage', feature);
      }
      break;
    case 'sessionEnd':
      if (sessionTime) {
        // Update average session time
        // Get current values
        const analyticsResult = await pool.query('SELECT average_session_time, daily_active_users FROM analytics WHERE date = $1', [todayStr]);
        const { average_session_time, daily_active_users } = analyticsResult.rows[0];
        const totalTime = average_session_time * daily_active_users;
        const newAverage = (totalTime + sessionTime) / (daily_active_users || 1);
        await pool.query(
          `UPDATE analytics SET average_session_time = $1, updated_at = NOW() WHERE date = $2`,
          [newAverage, todayStr]
        );
      }
      break;
    case 'purchase':
      if (amount) {
        await pool.query(
          `UPDATE analytics SET revenue = revenue + $1, updated_at = NOW() WHERE date = $2`,
          [amount, todayStr]
        );
      }
      break;
  }

  if (country) {
    await incrementJsonbField('geographic_data', country);
  }

  res.status(200).json({ success: true });
});

module.exports = {
  getDashboardOverview,
  getUsageAnalytics,
  getRevenueAnalytics,
  trackActivity,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
};
