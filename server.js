const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config({ path: '../.env.local' });
const { ClerkExpressWithAuth } = require('@clerk/clerk-sdk-node');
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const fileUpload = require('express-fileupload');
const fs = require('fs');

// Import routes
const routes = require('./routes');
const categoriesRoutes = require('../categories');
const userRoutes = require('../routes/userRoutes');
const planRoutes = require('../routes/planRoutes');
const wishlistRoutes = require('../routes/wishlistRoutes');
const cartRoutes = require('../routes/cartRoutes');
const productRoutes = require('../routes/productRoutes');
const categoryRoutes = require('../routes/categoryRoutes');
const uploadRoutes = require('./uploads/uploadRoutes');
const searchRouter = require('../routes/search');
const { webhookRoutes } = require('../routes/webhook-routes');
const { fileRoutes } = require('../routes/file-routes');
const { setupAuth } = require('./middleware/auth-middleware');
const stkPushRoutes = require('../routes/stkPushRoutes');
const { cacheMiddleware } = require('../middleware/cache');

// Import scheduled jobs
const { scheduleJobs } = require('../utils/scheduledJobs');

// Import models
const Product = require('../Models/Products');
 
// Import database connection - Fix: Import the object with the connectDB method
const { connectDB } = require('../config/db');

// Start scheduled jobs
scheduleJobs();

// Validate environment variables
const requiredEnvVars = [
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'MONGO_URI',
    'PORT',
];

requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
        console.error(`Error: ${envVar} is missing in the .env.local file.`);
        process.exit(1);
    }
});

console.log('MongoDB URI:', process.env.MONGO_URI ? 'Set (value hidden)' : 'Not set');
console.log('Clerk Publishable Key:', process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'Set (value hidden)' : 'Not set');

// Connect to MongoDB using the connectDB method
connectDB()
  .then(() => console.log('Connected to MongoDB via mongoose'))
  .catch(err => {
    console.error('Failed to connect to MongoDB via mongoose:', err);
    process.exit(1);
  });

// Initialize Express app
const app = express();
const port = process.env.PORT || 5000;

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: './uploads',
    filename: (_req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

// Add file upload middleware
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Configure middleware
app.use(express.json({ 
  verify: (req, _res, buf) => {
    // Save the raw body for webhook signature verification
    req.rawBody = buf;
  }
}));
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Atlas client for search functionality
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000 // Timeout after 10 seconds
});

// Initialize MongoDB collections
let ordersCollection;

// Connect to MongoDB Atlas
async function connectToMongoDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB Atlas');
        
        // Initialize collections
        ordersCollection = client.db('theplancave').collection('orders');
    } catch (err) {
        console.error('MongoDB Atlas connection error:', err);
    }
}
connectToMongoDB();


// File upload validation middleware
const validateFileUpload = (req, res, next) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const file = req.files.file;
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/CAD'
  ];
  
  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  
  next();
};

// Clerk Authentication Middleware
const clerkMiddleware = ClerkExpressWithAuth({
    frontendApi: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    apiKey: process.env.CLERK_SECRET_KEY,
});

// Health check route
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API Routes - Make sure these are router instances, not objects
// Check if each import is a router before using it
if (typeof categoriesRoutes === 'function' || categoriesRoutes.router) {
  app.use('/api/categories', categoriesRoutes);
}
app.use('/api/products', cacheMiddleware(300), productRoutes);

if (typeof userRoutes === 'function' || userRoutes.router) {
  app.use('/api/users', userRoutes);
}

if (typeof planRoutes === 'function' || planRoutes.router) {
  app.use('/api/plans', planRoutes);
}

if (typeof wishlistRoutes === 'function' || wishlistRoutes.router) {
  app.use('/api/wishlist', wishlistRoutes);
}

if (typeof cartRoutes === 'function' || cartRoutes.router) {
  app.use('/api/cart', cartRoutes);
}

if (typeof productRoutes === 'function' || productRoutes.router) {
  app.use('/api/products', productRoutes);
}

if (typeof categoryRoutes === 'function' || categoryRoutes.router) {
  app.use('/api/categories', categoryRoutes);
}

if (typeof uploadRoutes === 'function' || uploadRoutes.router) {
  app.use('/uploads', uploadRoutes);
}

if (typeof stkPushRoutes === 'function' || stkPushRoutes.router) {
  app.use('/api/stkPush', stkPushRoutes);
}

if (typeof searchRouter === 'function' || searchRouter.router) {
  app.use('/api', searchRouter);
}

if (typeof routes === 'function' || routes.router) {
  app.use('/', routes);
}

// Special routes - Make sure these are functions
if (typeof webhookRoutes === 'function') {
  webhookRoutes(app);
} else {
  console.error('webhookRoutes is not a function');
}

if (typeof fileRoutes === 'function') {
  fileRoutes(app);
} else {
  console.error('fileRoutes is not a function');
}

// Success page route
app.get('/success', (_req, res) => {
  res.sendFile(path.join(__dirname, 'pages'));
});
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    message: 'Server error',
    error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// File upload helper function
async function uploadFileToServer(file, directory) {
  return new Promise((resolve, reject) => {
    // Create directory if it doesn't exist
    const uploadDir = path.join(__dirname, directory);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Generate unique filename
    const fileExt = path.extname(file.name);
    const fileName = `${Date.now()}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);
    
    // Move file to destination
    file.mv(filePath, (err) => {
      if (err) {
        return reject(err);
      }
      
      resolve({
        fileName,
        originalName: file.name,
        path: `${directory}/${fileName}`,
        size: file.size,
        type: file.mimetype
      });
    });
  });
}

// File upload route using local storage instead of Firebase
app.post('/api/upload', validateFileUpload, async (req, res) => {
  try {
    const file = req.files.file;
    const { orderId, userId } = req.body;
    
    if (!orderId || !userId) {
      return res.status(400).json({ 
        error: 'Order ID and User ID are required' 
      });
    }

    // Upload file to server
    const uploadDir = `uploads/orders/${orderId}`;
    const fileData = await uploadFileToServer(file, uploadDir);
    
    // Generate download URL
    const downloadURL = `/api/${fileData.path}`;

    // Update MongoDB order with file reference
    const updateResult = await ordersCollection.updateOne(
      { _id: new ObjectId(orderId) },
      { 
        $push: { 
          attachments: {
            _id: new ObjectId(), // Generate new ID for the attachment
            url: downloadURL,
            path: fileData.path,
            name: file.name,
            type: file.mimetype,
            size: file.size,
            uploadedAt: new Date()
          }
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({ error: 'Order not found or update failed' });
    }

    res.status(200).json({ 
      success: true, 
      fileId: updateResult.upsertedId,
      downloadURL,
      metadata: {
        name: file.name,
        size: file.size,
        type: file.mimetype
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve uploaded files
app.get('/api/uploads/:type/:id/:filename', (req, res) => {
  const { type, id, filename } = req.params;
  const filePath = path.join(__dirname, 'uploads', type, id, filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Get file URL
app.get('/api/files/:orderId/:fileId', async (req, res) => {
  try {
    const { orderId, fileId } = req.params;

    // Find file in MongoDB
    const order = await ordersCollection.findOne({
      _id: new ObjectId(orderId),
      'attachments._id': new ObjectId(fileId)
    });

    if (!order) {
      return res.status(404).json({ error: 'Order or file not found' });
    }

    const fileData = order.attachments.find(
      att => att._id.toString() === fileId
    );

    // Return file URL
    res.status(200).json({
      url: fileData.url,
      metadata: {
        name: fileData.name,
        type: fileData.type,
        size: fileData.size,
        uploadedAt: fileData.uploadedAt
      }
    });
  } catch (error) {
    console.error('Error getting file URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete file
app.delete('/api/files/:orderId/:fileId', async (req, res) => {
  try {
    const { orderId, fileId } = req.params;

    // Find the file in MongoDB first
    const order = await ordersCollection.findOne({
      _id: new ObjectId(orderId),
      'attachments._id': new ObjectId(fileId)
    });

    if (!order) {
      return res.status(404).json({ error: 'Order or file not found' });
    }

    const fileToDelete = order.attachments.find(
      att => att._id.toString() === fileId
    );

    // Delete file from server
    const filePath = path.join(__dirname, fileToDelete.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove reference from MongoDB
    await ordersCollection.updateOne(
      { _id: new ObjectId(orderId) },
      { $pull: { attachments: { _id: new ObjectId(fileId) } } }
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all orders (MongoDB version)
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await ordersCollection.find().toArray();
    res.status(200).json({ orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single order (MongoDB version)
app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const order = await ordersCollection.findOne({ 
      _id: new ObjectId(req.params.orderId) 
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.status(200).json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create order (MongoDB version)
app.post('/api/orders', async (req, res) => {
  try {
    const orderData = req.body;
    
    if (!orderData?.userId || !orderData?.items) {
      return res.status(400).json({ error: 'Invalid order data' });
    }
    
    const orderWithTimestamps = {
      ...orderData,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending'
    };
    
    const result = await ordersCollection.insertOne(orderWithTimestamps);
    
    res.status(201).json({
      _id: result.insertedId,
      ...orderWithTimestamps
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Backend API endpoint for fetching products with pagination
app.get('/api/products', async (req, res) => {
  const { page = 1, limit = 6, ...filters } = req.query; // Default page = 1, limit = 6
  const skip = (page - 1) * limit; // Calculate how many documents to skip

  try {
    const products = await Product.find(filters)
      .skip(skip) // Skip documents for pagination
      .limit(Number(limit)); // Limit the number of documents returned

    const totalProducts = await Product.countDocuments(filters); // Total number of products
    const totalPages = Math.ceil(totalProducts / limit); // Calculate total pages

    res.json({
      data: products,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error fetching products' });
  }
});


// Fallback route for SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'pages'));
});

// Apply Clerk middleware after routes that don't need authentication
app.use(clerkMiddleware);

// Error handling middleware
app.use((err, _req, res, _next) => {
  console.error('Error details:', err.stack);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Export app and client for testing or external use
module.exports = { app, client };