import { getDb } from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../../middleware/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const db = await getDb();

    switch (req.method) {
      case 'GET':
        // Get dashboard data
        const [products, users, analytics] = await Promise.all([
          db.collection('products').find().toArray(),
          db.collection('users').find().toArray(),
          db.collection('analytics').find().sort({ timestamp: -1 }).limit(30).toArray()
        ]);

        // Calculate statistics
        const stats = {
          totalProducts: products.length,
          totalUsers: users.length,
          activeUsers: users.filter(u => u.lastActive > Date.now() - 24 * 60 * 60 * 1000).length,
          totalRevenue: products.reduce((sum, p) => sum + (p.price || 0), 0),
          revenueGrowth: 0 // You'll need to implement the growth calculation based on your needs
        };

        // Format analytics data for charts
        const usageData = analytics.map(a => ({
          day: new Date(a.timestamp).toLocaleDateString('en-US', { weekday: 'short' }),
          visits: a.visits
        }));

        return res.status(200).json({ products, stats, usageData });

      case 'POST':
        // Add new product
        const newProduct = {
          ...req.body,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const result = await db.collection('products').insertOne(newProduct);
        return res.status(201).json({ message: 'Product added successfully', product: { ...newProduct, _id: result.insertedId } });

      case 'PUT':
        // Update product
        const { _id, ...updateData } = req.body;
        const updated = await db.collection('products').findOneAndUpdate(
          { _id: new ObjectId(_id) },
          { 
            $set: {
              ...updateData,
              updatedAt: new Date()
            }
          },
          { returnDocument: 'after' }
        );
        return res.status(200).json({ message: 'Product updated successfully', product: updated });

      case 'DELETE':
        // Delete product
        const { id } = req.query;
        await db.collection('products').deleteOne({ _id: new ObjectId(id) });
        return res.status(200).json({ message: 'Product deleted successfully' });

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Dashboard API Error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
} 