const User = require('../Models/User');
const asyncHandler = require('express-async-handler');

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = asyncHandler(async (_req, res) => {
  const users = await User.find({}).select('-password');
  res.json(users);
});

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  
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

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: role || 'user',
    isActive: isActive !== undefined ? isActive : true,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Update a user
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  const { name, email, role, isActive, subscription } = req.body;

  const user = await User.findById(req.params.id);

  if (user) {
    user.name = name || user.name;
    user.email = email || user.email;
    user.role = role || user.role;
    user.isActive = isActive !== undefined ? isActive : user.isActive;
    user.subscription = subscription || user.subscription;

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      subscription: updatedUser.subscription,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    await user.remove();
    res.json({ message: 'User removed' });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Get user statistics
// @route   GET /api/admin/users/stats
// @access  Private/Admin
const getUserStats = asyncHandler(async (_req, res) => {
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isActive: true });
  const adminUsers = await User.countDocuments({ role: 'admin' });
  
  // Get new users this month
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newUsersThisMonth = await User.countDocuments({
    createdAt: { $gte: thisMonth }
  });

  // Get users by subscription
  const usersBySubscription = await User.aggregate([
    {
      $lookup: {
        from: 'products',
        localField: 'subscription',
        foreignField: '_id',
        as: 'subscriptionDetails'
      }
    },
    {
      $unwind: {
        path: '$subscriptionDetails',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $group: {
        _id: '$subscriptionDetails.category',
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    totalUsers,
    activeUsers,
    adminUsers,
    newUsersThisMonth,
    usersBySubscription
  });
});

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStats
};