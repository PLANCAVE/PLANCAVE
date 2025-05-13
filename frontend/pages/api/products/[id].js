import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;

  // Validate ID
  if (!id) {
    return res.status(400).json({ message: 'Product ID is required' });
  }

  try {
    // Establish database connection
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'theplancave');
    const collection = db.collection('products');

    // Try different ID formats
    let product;

    // First try with ObjectId (most common MongoDB ID format)
    try {
      if (ObjectId.isValid(id)) {
        product = await collection.findOne({ _id: new ObjectId(id) });
      }
    } catch (e) {
      console.log('Error with ObjectId:', e.message);
    }

    // If not found, try with original string ID
    if (!product) {
      product = await collection.findOne({ _id: id });
    }

    // If still not found, try with numeric ID
    if (!product) {
      try {
        const numericId = parseInt(id);
        if (!isNaN(numericId)) {
          product = await collection.findOne({ _id: numericId });
        }
      } catch (e) {
        console.log('Error with numeric ID:', e.message);
      }
    }

    // Log the query result for debugging
    console.log('Query result:', {
      id,
      found: !!product,
      idType: typeof id
    });

    if (!product) {
      return res.status(404).json({ 
        message: 'Product not found',
        requestedId: id
      });
    }

    // Success response
    return res.status(200).json(product);

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      message: 'Database operation failed',
      error: error.message,
      requestedId: id
    });
  }
}