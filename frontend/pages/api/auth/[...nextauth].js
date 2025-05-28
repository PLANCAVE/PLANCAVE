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
  // pages/api/auth/[...nextauth].js
CredentialsProvider({
  id: 'credentials',
  name: 'Credentials',
  credentials: {
    username: { label: "Username", type: "text" },
    password: { label: "Password", type: "password" }
  },
  async authorize(credentials) {
    try {
      const res = await axios.post(`${process.env.FLASK_BACKEND_URL}/login`, {
        username: credentials.username,
        password: credentials.password
      });

      // DEBUG: Log raw response
     console.log('Flask response:', JSON.stringify(res.data, null, 2));

      if (!res.data?.user?.role) {
        throw new Error('Role missing in response');
      }

      // Map to NextAuth's expected user object
      return {
        id: res.data.user.id,
        name: res.data.user.username,
        email: `${res.data.user.username}@gmail.com`, // Required field
        role: res.data.user.role, // Critical for admin access
        accessToken: res.data.access_token, // Required field
      };
    } catch (error) {
      console.error('Login failed:', error.response?.data || error.message);
      return null;
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
async jwt({ token, user, account }) {
  if (account) {
    // OAuth login: Validate token via Flask /oauth-login endpoint
    try {
      const res = await axios.post(`${process.env.FLASK_BACKEND_URL}/oauth-login`, {
        provider: account.provider,
        access_token: account.access_token
      });

      if (res.data?.user?.role) {
        token.role = res.data.user.role;
      } else {
        throw new Error("OAuth response missing role information");
      }
    } catch (error) {
      console.error("OAuth JWT callback failed:", error.response?.data || error.message);
      token.role = null;
    }
  } else if (user) {
    // Credentials login: Assign role directly from user object
    token.role = user.role || null;
  }

  return token;
},


  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: "localhost" 
      }
    }
  }
});
