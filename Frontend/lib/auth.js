// lib/auth.js
import crypto from 'crypto';
import { getDb } from './mongodb';

export async function sendPasswordResetEmail(email) {
  const db = await getDb();
  const user = await db.collection('users').findOne({ email });
  
  if (!user) throw new Error('User not found');

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000); // 1 hour
  
  await db.collection('passwordResets').insertOne({
    userId: user._id,
    token,
    expires
  });

  // In production, send email with reset link
  const resetLink = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
  console.log('Reset link:', resetLink); // Remove in production
  
  return true;
}