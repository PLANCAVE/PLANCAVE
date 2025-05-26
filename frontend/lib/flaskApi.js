import axios from 'axios';
import { getSession } from 'next-auth/react';

// Create a configured Axios instance
const instance = axios.create({
  baseURL: process.env.FLASK_BACKEND_URL || 'http://localhost:5001',
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Request interceptor to add auth token
instance.interceptors.request.use(
  async (config) => {
    // For server-side calls
    if (typeof window === 'undefined') {
      return config;
    }

    // Client-side calls - get session
    const session = await getSession();
    
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
instance.interceptors.response.use(
  (response) => {
    return response.data; // Return only the data part
  },
  (error) => {
    // Handle errors
    if (error.response) {
      // Server responded with error status
      const errorMessage = error.response.data?.message || 
                         error.response.statusText || 
                         'Request failed';

      const customError = new Error(errorMessage);
      customError.status = error.response.status;
      customError.data = error.response.data;
      
      return Promise.reject(customError);
    } else if (error.request) {
      // Request was made but no response
      return Promise.reject(new Error('No response from server'));
    } else {
      // Something else happened
      return Promise.reject(error);
    }
  }
);

// Specific methods for your admin routes
const flaskApi = {
  // Auth-related methods
  login: (credentials) => instance.post('/login', credentials),
  oauthLogin: (providerData) => instance.post('/oauth-login', providerData),
  verifyToken: () => instance.get('/verify-token'),

  // Admin methods
  getUsers: () => instance.get('/admin/users'),
  createUser: (userData) => instance.post('/admin/create_user', userData),
  getProducts: () => instance.get('/admin/products'),
  getRevenue: () => instance.get('/admin/revenue'),
  getAnalytics: () => instance.get('/admin/analytics/usage'),

  // Server-side call helper
  serverSideGet: async (req, url) => {
    const session = await getSession({ req });
    return instance.get(url, {
      headers: {
        Authorization: `Bearer ${session?.accessToken}`
      }
    });
  }
};

export default flaskApi;