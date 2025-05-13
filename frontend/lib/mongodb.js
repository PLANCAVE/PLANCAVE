// lib/mongodb.js
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables explicitly
try {
  // For ESM
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, '../..');
  
  // Try loading from different possible locations
  dotenv.config({ path: path.join(rootDir, '.env.local') });
  dotenv.config({ path: path.join(rootDir, '.env') });
  
  console.log('After explicit loading, MONGO_URI:', process.env.MONGO_URI);
} catch (error) {
  // For CommonJS or if there's an error
  console.error('Error loading environment variables:', error);
  
  // Try a simpler approach
  dotenv.config();
}

// Debug information
console.log('Current working directory:', process.cwd());
console.log('Environment variables available:', Object.keys(process.env));
console.log('MONGO_URI value:', process.env.MONGO_URI);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Try alternative ways to access the variable
const mongoUri = process.env.MONGO_URI || 
                process.env.MONGODB_URI || 
                'mongodb+srv://plancave:Timbuktu25@cluster0.0dhgr.mongodb.net/theplancave?retryWrites=true&w=majority&appName=Cluster0';

console.log('Using MongoDB URI:', mongoUri);

if (!mongoUri) {
  throw new Error('MongoDB URI not found. Please check your environment variables.');
}

const uri = mongoUri;
const options = {};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;