const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
const express = require('express');
const mongoose = require('mongoose');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const admin = require('firebase-admin');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');



// Import utilities
const scheduleJobs = require('../utils/scheduledJobs');
const { sessionUtils } = require('../utils/security');


// Import middleware
const { authenticateToken, isAdmin } = require('../middleware/auth');
const {
  applySecurityHeaders,
  rateLimit,
  sanitizeBody,
  sanitizeQuery,
  forceHttps,
  setCsrfToken
} = require('../middleware/security');
const { webhookRoutes } = require('../routes/webhook-routes');

// Initialize Express app
const app = express();

// Initialize Firebase Admin
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    console.log('Firebase Admin initialized successfully');
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    console.log('Firebase Admin initialized successfully from file');
  } else {
    console.warn('Firebase credentials not found, Firebase functionality will be disabled');
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
}

// Schedule jobs
scheduleJobs();

// Log MongoDB connection info
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Set (value hidden)' : 'Not set');

// MongoDB connection
let db;
let usersCollection;
let filesCollection;

// Connect to MongoDB using Mongoose for models and native driver for admin collections
async function connectToMongoDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MongoDB connection string not found. Set MONGODB_URI in your environment variables.');
    }
    
    // Connect with Mongoose for models
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB with Mongoose');
    
    // Also connect with native driver for admin panel collections
    const client = new MongoClient(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();
    db = client.db(process.env.MONGO_DB_NAME || 'admin_panel');
    usersCollection = db.collection('users');
    filesCollection = db.collection('files');
    
    // Create indexes
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await filesCollection.createIndex({ fileId: 1 }, { unique: true });
    await filesCollection.createIndex({ uploadedBy: 1 });
    
    // Check if admin exists, create if not
    const adminExists = await usersCollection.findOne({ role: 'admin' });
    if (!adminExists) {
      const { passwordUtils } = require('../utils/security');
      const hashedPassword = await passwordUtils.hashPassword('admin123');
      await usersCollection.insertOne({
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        createdAt: new Date(),
        lastLogin: null,
        isActive: true
      });
      console.log('Admin user created');
    }
    
    return { db, mongoose };
  } catch (error) {
    console.error('MongoDB initialization error:', error);
    throw error;
  }
}




// Security middleware
app.use(helmet()); // Sets various HTTP headers for security
app.use(applySecurityHeaders);
app.use(forceHttps); // Redirect to HTTPS in production

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'your-cookie-secret'));

// Sanitize input
app.use(sanitizeBody);
app.use(sanitizeQuery);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true
}));

// File upload middleware
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  },
  abortOnLimit: true,
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Firebase Storage helper function
function getFirebaseStorage() {
  if (!admin.apps.length) {
    return null;
  }
  return admin.storage().bucket();
}

// Initialize database and setup routes
async function initializeApp() {
  try {
    // Connect to MongoDB
    const { db } = await connectToMongoDB();
    const bucket = getFirebaseStorage();

    // Session configuration
    app.use(session({
      secret: process.env.SESSION_SECRET || 'your-session-secret',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || process.env.MONGO_URI,
        ttl: 14 * 24 * 60 * 60, // 14 days
        autoRemove: 'native'
      }),
      cookie: sessionUtils.getCookieOptions()
    }));

    // Set CSRF token for all requests
    app.use(setCsrfToken);

    // Rate limiting for API routes
    app.use('/api/', rateLimit({
      limit: 100,
      windowMs: 15 * 60 * 1000 // 15 minutes
    }));

    // More aggressive rate limiting for auth routes
    app.use('/api/auth/', rateLimit({
      limit: 10,
      windowMs: 15 * 60 * 1000 // 15 minutes
    }));

    // Import route files
    // For routes that use MongoDB native driver
    const authRoutes = require('../routes/authRoutes')(db);
    const userRoutes = require('../routes/userRoutes')(db, authenticateToken, isAdmin);
    const fileRoutes = require('../routes/fileRoutes')(db, authenticateToken, isAdmin, bucket);
    const signupRoute = require('./routes/auth/signup');
    

    
    // For routes that use Mongoose models - import directly
    const productRoutes = require('../routes/productRoutes');
    const categoriesRoutes = require('../routes/categoriesRoutes');

    // Mount routes
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/files', fileRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/categories', categoriesRoutes);
    app.use('/api/auth', signupRoute);

    // Profile route
    app.get('/api/profile', authenticateToken, async (req, res) => {
      try {
        let userId;
        try {
          userId = new ObjectId(req.user.id);
        } catch (error) {
          return res.status(400).json({ message: 'Invalid user ID format' });
        }
        
        const user = await usersCollection.findOne({ _id: userId });
        
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        });
      } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error' });
      }
    });

    // Firebase auth status endpoint
    app.get('/api/firebase-status', (req, res) => {
      res.json({
        firebaseEnabled: admin.apps.length > 0,
        storageEnabled: !!getFirebaseStorage()
      });
    });
    
    // Try to load optional routes if they exist
    try {
      const planRoutes = require('../routes/planRoutes');
      app.use('/api/plans', planRoutes);
    } catch (err) {
      console.log('Plan routes not available:', err.message);
    }
    
    try {
      const wishlistRoutes = require('../routes/wishlistRoutes');
      app.use('/api/wishlist', wishlistRoutes);
    } catch (err) {
      console.log('Wishlist routes not available:', err.message);
    }
    
    try {
      const cartRoutes = require('../routes/cartRoutes');
      app.use('/api/cart', cartRoutes);
    } catch (err) {
      console.log('Cart routes not available:', err.message);
    }
    
    try {
      const uploadRoutes = require('../routes/uploadRoutes');
      app.use('/uploads', uploadRoutes);
    } catch (err) {
      console.log('Upload routes not available:', err.message);
    }
    
    try {
      const searchRouter = require('../routes/search');
      app.use('/api/search', searchRouter);
    } catch (err) {
      console.log('Search routes not available:', err.message);
    }

//const adminRoutes = require('../routes/admin'); // adjust path as needed
//app.use('/api', adminRoutes);


  // Error handling middleware
  app.use((err, _req, res, _next) => {
      console.error('Unhandled error:', err);
      res.status(500).json({ 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? undefined : err.message
      });
    });

    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Application initialization error:', error);
    process.exit(1);
  }
}

// Start the application
initializeApp().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});