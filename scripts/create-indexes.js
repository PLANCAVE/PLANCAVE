require('dotenv').config();
const { connectDB, closeConnection } = require('../config/db');

async function createIndexes() {
  try {
    console.log('Connecting to database...');
    const db = await connectDB();
    console.log('Connected. Creating indexes...');
    
    // Create indexes for the products collection
    await db.collection('products').createIndex({ name: 1 });
    console.log('Created index on name field');
    
    await db.collection('products').createIndex({ price: 1 });
    console.log('Created index on price field');
    
    await db.collection('products').createIndex({ category: 1 });
    console.log('Created index on category field');
    
    await db.collection('products').createIndex({ area: 1 });
    console.log('Created index on area field');
    
    await db.collection('products').createIndex({ bedrooms: 1 });
    console.log('Created index on bedrooms field');
    
    await db.collection('products').createIndex({ floors: 1 });
    console.log('Created index on floors field');
    
    // Compound indexes for common filter combinations
    await db.collection('products').createIndex({ category: 1, price: 1 });
    console.log('Created compound index on category and price');
    
    await db.collection('products').createIndex({ area: 1, bedrooms: 1 });
    console.log('Created compound index on area and bedrooms');
    
    console.log('All indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
  } finally {
    await closeConnection();
  }
}

// Run the function
createIndexes();