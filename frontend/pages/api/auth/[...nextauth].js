// pages/api/auth/[...nextauth].js
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local from the parent directory (adjust path as needed)
dotenv.config({ path: path.resolve(process.cwd(), '../.env.local') });

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import axios from 'axios';

// Use const for API_URL declaration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
console.log('API URL being used:', API_URL);

export default NextAuth({ 
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          console.log('Attempting to authenticate with backend at:', `${API_URL}/api/admin/login`);
          
          // Updated endpoint to match your backend API
          const response = await axios.post(`${API_URL}/api/admin/login`, {
            email: credentials.email,
            password: credentials.password
          });
          
          console.log('Auth response status:', response.status);
          
          // Don't log full response as it may contain sensitive data
          console.log('Auth response contains user data:', !!response.data);
          
          const user = response.data;
          
          if (user) {
            return {
              id: user._id || user.id,
              name: user.name || user.user?.name,
              email: user.email || user.user?.email,
              role: user.role || user.user?.role || 'user',
              accessToken: user.token
            };
          }
          
          return null;
        } catch (error) {
          console.error('Authentication error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
          });
          
          // Provide more specific error messages based on status codes
          if (error.response?.status === 401) {
            throw new Error(error.response.data.message || 'Invalid email or password');
          }
          
          throw new Error('Authentication failed. Please try again.');
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Add user details and token to the JWT
        token.accessToken = user.accessToken;
        token.role = user.role;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Add information from token to the session
      session.accessToken = token.accessToken;
      
      // Ensure user object exists
      if (!session.user) {
        session.user = {};
      }
      
      // Add role and ID to user object
      session.user.role = token.role;
      session.user.id = token.userId;
      
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
    error: '/login', // Go to login page on error
  },
  debug: process.env.NODE_ENV === 'development',
});