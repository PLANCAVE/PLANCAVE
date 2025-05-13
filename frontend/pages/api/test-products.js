// pages/api/test-products.js
import clientPromise from '../../lib/mongodb';

export default async function handler(_req, res) {
  try {
    const client = await clientPromise;
    const db = client.db("theplancave"); // Replace with your actual database name

    // Get all products
    const products = await db.collection('products').find({}).toArray();
    
    console.log('Found products:', products.length);

    return res.status(200).json({ 
      message: 'Connection successful',
      productCount: products.length,
      products: products 
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    return res.status(500).json({ message: 'Database connection error', error: error.message });
  }
}