

require('dotenv').config({ path: require('path').resolve(process.cwd(), '/home/badman/ThePlanCave/.env.local') });

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import axios from 'axios';

export default NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 4 * 60 * 60,
    updateAge: 60 * 60,
  },
  providers: [
    CredentialsProvider({
      id: 'flask-credentials',
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          const response = await axios.post(
            `${process.env.FLASK_BACKEND_URL}/login`,
            credentials
          );

          if (!response.data?.access_token) {
            throw new Error('Invalid response from auth server');
          }

          return {
            id: response.data.id,
            username: credentials.username,
            role: response.data.role,  // Ensuring role persists
            accessToken: response.data.access_token
          };
        } catch (error) {
          throw new Error(error.response?.data?.message || 'Authentication failed');
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.accessToken = user.accessToken;
      }
      return token;
    },

    async session({ session, token }) {
      console.log("Session callback:", session);
      console.log("Token contents:", token);

      session.user = {
        id: token.id,
        role: token.role || 'user',  // Ensure role persists
      };
      session.accessToken = token.accessToken;
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  debug: process.env.NODE_ENV === 'development',
});
