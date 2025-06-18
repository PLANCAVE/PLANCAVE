import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';

export default NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 4 * 60 * 60, // 4 hours
    updateAge: 60 * 60 // 1 hour
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          const response = await fetch(`${process.env.DATABASE_URL}/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Authentication failed');
          }

          if (!data.access_token) {
            throw new Error('Invalid response from auth server');
          }

          return {
            id: data.user?.id || credentials.username,
            username: credentials.username,
            email: data.user?.email || `${credentials.username}@example.com`,
            role: data.user?.role || 'user',
            accessToken: data.access_token,
            user: data.user // Include full user data
          };
        } catch (error) {
          console.error('Credentials auth error:', error);
          return null;
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      async profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: 'user'
        };
      }
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      async profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          role: 'user'
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user && account) {
        // For credential login
       if (user && account) {
      token.role = user.role; // Ensure role is set in token
      token.accessToken = user.accessToken;
      token.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role // Make sure this is set
      };
    }
        // For OAuth providers
        else {
          try {
            const oauthResponse = await fetch(`${process.env.DATABASE_URL}/oauth-login`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                provider: account.provider,
                provider_id: user.id,
                email: user.email,
                name: user.name
              })
            });

            const oauthData = await oauthResponse.json();
            
            if (oauthResponse.ok && oauthData.access_token) {
              token.accessToken = oauthData.access_token;
              token.user = oauthData.user || {
                id: user.id,
                email: user.email,
                name: user.name,
                role: 'user'
              };
            }
          } catch (error) {
            console.error('OAuth token creation failed:', error);
          }
        }
      }
      return token;
    },
     async session({ session, token }) {
    // Make sure these values are properly assigned
    session.accessToken = token.accessToken;
    session.user = {
      ...session.user,
      ...token.user,
      id: token.user?.id || token.sub,
      role: token.user?.role || token.role || 'user' // Multiple fallbacks
    };
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login?error=auth_error'
  },
  events: {
    async signOut({ token, session }) {
      // Clean up on signout
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  },
  debug: process.env.NODE_ENV === 'development'
});