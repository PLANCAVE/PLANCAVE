import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import clientPromise from '../../../lib/mongodb';
import { compare } from 'bcryptjs';
import crypto from 'crypto';

export default NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  adapter: MongoDBAdapter(clientPromise),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days for "Remember me"
    updateAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    encryption: true,
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        const client = await clientPromise;
        const db = client.db('theplancave');
        const user = await db.collection('users').findOne({ email: credentials.email });

        if (!user) throw new Error('No user found with this email');
        if (!user.password) throw new Error('Please use the provider you signed up with');

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) throw new Error('Invalid password');

        // Handle "Remember me" from form
        if (req.body?.remember) {
          // Extend session duration
          return { 
            id: user._id.toString(), 
            email: user.email, 
            name: user.name,
            maxAge: 30 * 24 * 60 * 60 // 30 days
          };
        }

        return { id: user._id.toString(), email: user.email, name: user.name };
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.maxAge = user.maxAge; // For "Remember me"
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      return session;
    }
  },
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/login',
    forgotPassword: '/forgot-password'
  },
  events: {
    async createUser(message) {
      // Create password reset token when new user signs up
      const client = await clientPromise;
      const db = client.db('theplancave');
      const token = crypto.randomBytes(32).toString('hex');
      
      await db.collection('passwordResets').insertOne({
        userId: message.user.id,
        token,
        expires: new Date(Date.now() + 3600000) // 1 hour
      });
    }
  }
});