const express = require('express');
const router = express.Router();
const Category = require('../Models/Categories'); // Import the Category model

// Check MongoDB connection status
const checkConnection = (req, res, next) => {
  const mongoose = require('mongoose');
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const state = mongoose.connection.readyState;
  if (state !== 1) {
    return res.status(500).json({ 
      message: 'Database connection not established',
      connectionState: state
    });
  }
  next();
};

// Apply connection check middleware to all routes
router.use(checkConnection);

// GET all categories
router.get('/', async (_req, res) => {
  try {
    console.log('Fetching categories...');
    const categories = await Category.find().sort({ name: 1 });
    console.log(`Found ${categories.length} categories`);
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

// GET category by ID
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Error fetching category', error: error.message });
  }
});

// POST create new category
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    
    // Check if category already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }
    
    // Create new category
    const newCategory = new Category({
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await newCategory.save();
    res.status(201).json({
      message: 'Category created successfully',
      category: newCategory
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Error creating category', error: error.message });
  }
});

// PUT update category
router.put('/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Find category by ID
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Check if updated name already exists (excluding current category)
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ 
        name, 
        _id: { $ne: req.params.id } 
      });
      
      if (existingCategory) {
        return res.status(400).json({ message: 'Category with this name already exists' });
      }
    }
    
    // Update category
    category.name = name || category.name;
    category.description = description !== undefined ? description : category.description;
    category.updatedAt = new Date();
    
    await category.save();
    res.json({
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Error updating category', error: error.message });
  }
});

// DELETE category
router.delete('/:id', async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Error deleting category', error: error.message });
  }
});

module.exports = router;