import { getDb } from '../../../lib/mongodb';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../../../lib/mailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'No user found with this email' });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    // Store token in database
    await db.collection('passwordResets').insertOne({
      userId: user._id,
      token,
      expires
    });

    // Send email (in production)
    if (process.env.NODE_ENV === 'production') {
      await sendPasswordResetEmail(user.email, token);
    } else {
      // In development, log the reset link
      console.log(`Password reset link: http://localhost:3000/reset-password?token=${token}`);
    }

    return res.status(200).json({ 
      message: 'Password reset link sent to your email' 
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ 
      message: 'An error occurred. Please try again.' 
    });
  }
}