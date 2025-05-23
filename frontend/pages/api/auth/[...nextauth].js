console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET);
console.log('JWT_SECRET:', process.env.JWT_SECRET);

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
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    encryption: true,
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Authenticate against Flask backend
        try {
          const res = await axios.post(`${process.env.FLASK_BACKEND_URL || 'http://localhost:5001'}/login`, {
            username: credentials.username,
            password: credentials.password
          });
          const user = res.data;
          if (user && user.access_token) {
            // Return user object with JWT
            return {
              id: user.id,
              username: user.username,
              role: user.role,
              accessToken: user.access_token
            };
          }
          return null;
        } catch (error) {
          throw new Error(error.response?.data?.message || 'Invalid credentials');
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
    }),
  ],
  callbacks: {
    async jwt({ token, user, account,profile }) {
      // For CredentialsProvider (Flask), attach JWT
      if (user?.accessToken) {
        token.accessToken = user.accessToken;
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
      }
      // For OAuth providers, you may want to attach their access_token
      if (account && (account.provider === 'google' || account.provider === 'github')) {
        token.oauthAccessToken = account.access_token;
        // If you want to exchange this for a Flask JWT, do it here:
         const flaskRes = await axios.post(`${process.env.FLASK_BACKEND_URL}/oauth-login`, { provider: account.provider, access_token: account.access_token });
         token.accessToken = flaskRes.data.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      // For Flask JWT
      session.accessToken = token.accessToken || null;
      session.user = session.user || {};
      session.user.id = token.id || null;
      session.user.username = token.username || null;
      session.user.role = token.role || null;
      // For OAuth tokens (not Flask JWT)
      session.oauthAccessToken = token.oauthAccessToken || null;
      return session;
    }
  },
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/login',
    forgotPassword: '/forgot-password'
  }
});
