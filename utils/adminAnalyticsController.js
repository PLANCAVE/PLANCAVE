
const Analytics = require('../Models/Analytics');
const User = require('../Models/User');
const Product = require('../Models/Products');
const asyncHandler = require('express-async-handler');

/**
 * @desc    Get all users (admin)
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
});

/**
 * @desc    Get user by ID (admin)
 * @route   GET /api/admin/users/:id
 * @access  Private/Admin
 */
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json(user);
});

/**
 * @desc    Create a new user (admin)
 * @route   POST /api/admin/users
 * @access  Private/Admin
 */
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, ...rest } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email, and password are required');
  }
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }
  const user = await User.create({ name, email, password, ...rest });
  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    ...rest
  });
});

/**
 * @desc    Update a user (admin)
 * @route   PUT /api/admin/users/:id
 * @access  Private/Admin
 */
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  const { name, email, ...rest } = req.body;
  if (name) user.name = name;
  if (email) user.email = email;
  Object.assign(user, rest);
  await user.save();
  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    ...rest
  });
});

/**
 * @desc    Delete a user (admin)
 * @route   DELETE /api/admin/users/:id
 * @access  Private/Admin
 */
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  await user.remove();
  res.json({ message: 'User removed' });
});

/**
 * @desc    Get user statistics (admin)
 * @route   GET /api/admin/users/stats
 * @access  Private/Admin
 */
const getUserStats = asyncHandler(async (req, res) => {
  // Example: count users by registration month for the last 12 months
  const now = new Date();
  const lastYear = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);

  const stats = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: lastYear }
      }
    },
    {
      $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 }
    }
  ]);

  const formattedStats = stats.map(item => {
    const date = new Date(item._id.year, item._id.month - 1);
    return {
      month: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      count: item.count
    };
  });

  res.json(formattedStats);
});

/**
 * @desc    Get dashboard overview stats
 * @route   GET /api/admin/analytics/overview
 * @access  Private/Admin
 */
const getDashboardOverview = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isActive: true });
  const totalProducts = await Product.countDocuments();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayAnalytics = await Analytics.findOne({
    date: { $gte: today }
  }).sort({ date: -1 });

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayAnalytics = await Analytics.findOne({
    date: { $gte: yesterday, $lt: today }
  });

  const dailyActiveUsers = todayAnalytics?.dailyActiveUsers || 0;
  const dailyActiveUsersGrowth = yesterdayAnalytics?.dailyActiveUsers
    ? ((dailyActiveUsers - yesterdayAnalytics.dailyActiveUsers) / yesterdayAnalytics.dailyActiveUsers) * 100
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
    revenueGrowth
  });
});

/**
 * @desc    Get usage analytics
 * @route   GET /api/admin/analytics/usage
 * @access  Private/Admin
 */
const getUsageAnalytics = asyncHandler(async (req, res) => {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (req.query.days || 7));
  startDate.setHours(0, 0, 0, 0);

  const dailyAnalytics = await Analytics.find({
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: 1 });

  const usage = dailyAnalytics.map(day => ({
    day: day.date.toLocaleDateString('en-US', { weekday: 'short' }),
    visits: day.pageViews,
    activeUsers: day.dailyActiveUsers,
    date: day.date.toISOString().split('T')[0]
  }));

  const latestAnalytics = await Analytics.findOne().sort({ date: -1 });

  const userTypes = latestAnalytics?.productUsage
    ? Array.from(latestAnalytics.productUsage).map(([name, value]) => ({ name, value }))
    : [];

  const featureUsage = latestAnalytics?.featureUsage
    ? Array.from(latestAnalytics.featureUsage).map(([feature, usage]) => ({ feature, usage }))
    : [];

  const geoData = latestAnalytics?.geographicData
    ? Array.from(latestAnalytics.geographicData).map(([name, value]) => ({ name, value }))
    : [];

  res.json({
    dailyActive: latestAnalytics?.dailyActiveUsers || 0,
    weeklyActive: dailyAnalytics.reduce((sum, day) => sum + day.dailyActiveUsers, 0),
    averageSessionTime: latestAnalytics?.averageSessionTime || 0,
    usage,
    userTypes,
    featureUsage,
    geoData
  });
});

/**
 * @desc    Get revenue analytics
 * @route   GET /api/admin/analytics/revenue
 * @access  Private/Admin
 */
const getRevenueAnalytics = asyncHandler(async (req, res) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - (req.query.months || 6));

  const monthlyRevenue = await Analytics.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$date" },
          month: { $month: "$date" }
        },
        revenue: { $sum: "$revenue" }
      }
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 }
    }
  ]);

  const monthly = monthlyRevenue.map(item => {
    const date = new Date(item._id.year, item._id.month - 1);
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      revenue: item.revenue
    };
  });

  const total = monthly.reduce((sum, month) => sum + month.revenue, 0);

  let growth = 0;
  if (monthly.length >= 2) {
    const lastMonth = monthly[monthly.length - 1].revenue;
    const previousMonth = monthly[monthly.length - 2].revenue;
    growth = previousMonth ? ((lastMonth - previousMonth) / previousMonth) * 100 : 0;
  }

  const products = await Product.find();
  const revenueByProduct = products.map(product => ({
    name: product.name,
    value: product.price * product.subscribers
  }));

  res.json({
    total,
    growth,
    monthly,
    revenueByProduct
  });
});

/**
 * @desc    Track user activity (to be called from client app)
 * @route   POST /api/analytics/track
 * @access  Public
 */
const trackActivity = asyncHandler(async (req, res) => {
  const {
    userId,
    event,
    feature,
    sessionTime,
    country
  } = req.body;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let analytics = await Analytics.findOne({ date: { $gte: today } });

  if (!analytics) {
    analytics = new Analytics({
      date: today,
      dailyActiveUsers: 0,
      newUsers: 0,
      returningUsers: 0,
      pageViews: 0,
      averageSessionTime: 0,
      featureUsage: new Map(),
      geographicData: new Map(),
      productUsage: new Map(),
      revenue: 0
    });
  }

  switch (event) {
    case 'pageView':
      analytics.pageViews += 1;
      break;
    case 'userActive':
      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          const isNewUser = !user.lastLogin ||
            new Date(user.lastLogin).toDateString() !== today.toDateString();

          if (isNewUser) {
            analytics.dailyActiveUsers += 1;
            user.lastLogin = new Date();
            await user.save();

            if (user.createdAt && new Date(user.createdAt).toDateString() === today.toDateString()) {
              analytics.newUsers += 1;
            } else {
              analytics.returningUsers += 1;
            }

            if (user.subscription) {
              const product = await Product.findById(user.subscription);
              if (product) {
                const category = product.category;
                const currentCount = analytics.productUsage.get(category) || 0;
                analytics.productUsage.set(category, currentCount + 1);
              }
            } else {
              const currentCount = analytics.productUsage.get('Free') || 0;
              analytics.productUsage.set('Free', currentCount + 1);
            }
          }
        }
      }
      break;
    case 'featureUse':
      if (feature) {
        const currentCount = analytics.featureUsage.get(feature) || 0;
        analytics.featureUsage.set(feature, currentCount + 1);
      }
      break;
    case 'sessionEnd':
      if (sessionTime) {
        const totalTime = analytics.averageSessionTime * analytics.dailyActiveUsers;
        analytics.averageSessionTime = (totalTime + sessionTime) /
          (analytics.dailyActiveUsers || 1);
      }
      break;
    case 'purchase':
      if (req.body.amount) {
        analytics.revenue += req.body.amount;
      }
      break;
  }

  if (country) {
    const currentCount = analytics.geographicData.get(country) || 0;
    analytics.geographicData.set(country, currentCount + 1);
  }

  await analytics.save();

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
  getUserStats
};
