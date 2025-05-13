const express = require('express');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

const initUserRoutes = (db, authenticateToken, isAdmin) => {
  const router = express.Router();
  const usersCollection = db.collection('users');

  // Apply authentication middleware to all routes
  router.use(authenticateToken);

  /**
   * @route GET /api/users
   * @desc Get all users
   * @access Admin
   */
  router.get('/', isAdmin, async (req, res) => {
    try {
      const users = await usersCollection.find({}).toArray();
      const formattedUsers = users.map(user => ({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isActive: user.isActive
      }));
      res.json(formattedUsers);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  /**
   * @route GET /api/users/:id
   * @desc Get user by ID
   * @access Private (own user or admin)
   */
  router.get('/:id', async (req, res) => {
    try {
      let userId;
      try {
        userId = new ObjectId(req.params.id);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid user ID format' });
      }
      const requestingUserId = new ObjectId(req.user.id);
      if (!requestingUserId.equals(userId) && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      const user = await usersCollection.findOne({ _id: userId });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isActive: user.isActive
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  /**
   * @route PUT /api/users/:id
   * @desc Update user
   * @access Admin
   */
  router.put('/:id', isAdmin, async (req, res) => {
    const { email, firstName, lastName, role, isActive } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    try {
      let userId;
      try {
        userId = new ObjectId(req.params.id);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid user ID format' });
      }
      const userExists = await usersCollection.findOne({ _id: userId });
      if (!userExists) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (email !== userExists.email) {
        const emailExists = await usersCollection.findOne({ email, _id: { $ne: userId } });
        if (emailExists) {
          return res.status(400).json({ message: 'Email is already in use' });
        }
      }
      const result = await usersCollection.updateOne(
        { _id: userId },
        {
          $set: {
            email,
            firstName,
            lastName,
            role,
            isActive,
            updatedAt: new Date()
          }
        }
      );
      if (result.modifiedCount === 0) {
        return res.status(400).json({ message: 'No changes made' });
      }
      const updatedUser = await usersCollection.findOne({ _id: userId });
      res.json({
        message: 'User updated successfully',
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          isActive: updatedUser.isActive
        }
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  /**
   * @route DELETE /api/users/:id
   * @desc Delete user
   * @access Admin
   */
  router.delete('/:id', isAdmin, async (req, res) => {
    try {
      let userId;
      try {
        userId = new ObjectId(req.params.id);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid user ID format' });
      }
      const user = await usersCollection.findOne({ _id: userId });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (user.role === 'admin') {
        const adminCount = await usersCollection.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Cannot delete the last admin user' });
        }
      }
      const requestingUserId = new ObjectId(req.user.id);
      if (requestingUserId.equals(userId)) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }
      await usersCollection.deleteOne({ _id: userId });
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  /**
   * @route PUT /api/users/:id/password
   * @desc Update user password
   * @access Private (own user or admin)
   */
  router.put('/:id/password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    try {
      let userId;
      try {
        userId = new ObjectId(req.params.id);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid user ID format' });
      }
      const requestingUserId = new ObjectId(req.user.id);
      if (!requestingUserId.equals(userId) && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      const user = await usersCollection.findOne({ _id: userId });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (req.user.role !== 'admin') {
        if (!currentPassword) {
          return res.status(400).json({ message: 'Current password is required' });
        }
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
          return res.status(400).json({ message: 'Invalid current password' });
        }
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      await usersCollection.updateOne(
        { _id: userId },
        {
          $set: {
            password: hashedPassword,
            updatedAt: new Date()
          }
        }
      );
      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Update password error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  /**
   * @route GET /api/users/profile/me
   * @desc Get current user profile
   * @access Private
   */
  router.get('/profile/me', async (req, res) => {
    try {
      let userId;
      try {
        userId = new ObjectId(req.user.id);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid user ID format' });
      }
      const user = await usersCollection.findOne({ _id: userId });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  /**
   * @route GET /api/users/search
   * @desc Search users by email, firstName, or lastName
   * @access Admin
   */
  router.get('/search', isAdmin, async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'Missing search query' });
    try {
      const users = await usersCollection.find({
        $or: [
          { email: { $regex: q, $options: 'i' } },
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } }
        ]
      }).toArray();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  return router;
};

module.exports = initUserRoutes;
