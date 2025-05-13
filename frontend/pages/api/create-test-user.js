import { connectToDatabase } from '../../utils/mongodb';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase();
    
    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email: 'admin@test.com' });
    
    if (existingUser) {
      return res.status(200).json({ message: 'Test user already exists', user: { email: 'admin@test.com' } });
    }
    
    // Create a new user
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const newUser = {
      name: 'Test Admin',
      email: 'admin@test.com',
      password: hashedPassword,
      role: 'admin',
      isAdmin: true,
      createdAt: new Date()
    };
    
    await db.collection('users').insertOne(newUser);
    
    return res.status(201).json({ 
      message: 'Test user created successfully',
      user: { email: 'admin@test.com', password: 'password123' }
    });
  } catch (error) {
    console.error('Error creating test user:', error);
    return res.status(500).json({ message: 'Error creating test user' });
  }
}