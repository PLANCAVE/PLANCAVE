const admin = require('firebase-admin');
const path = require('path');

// Load service account
let serviceAccount;
try {
  serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require(path.resolve(__dirname, '../the-plan-cave-c6137-firebase-adminsdk.json'));
} catch (error) {
  console.error('Error loading Firebase service account:', error);
  process.exit(1);
}

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'the-plan-cave-c6137.appspot.com'
  });
} catch (error) {
  if (error.code === 'app/duplicate-app') {
    console.log('Firebase app already initialized');
  } else {
    console.error('Firebase initialization error:', error);
    process.exit(1);
  }
}

// Get services
const bucket = admin.storage().bucket();

// Enhanced Firebase Storage helpers
const storageHelpers = {
  uploadFile: async (fileBuffer, destinationPath, metadata = {}) => {
    const file = bucket.file(destinationPath);
    await file.save(fileBuffer, {
      metadata: {
        contentType: metadata.contentType || 'auto',
        metadata: metadata.customMetadata || {}
      }
    });
    return file;
  },
  getPublicUrl: async (filePath) => {
    const file = bucket.file(filePath);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2500' // Far future expiration
    });
    return url;
  },
  deleteFile: async (filePath) => {
    await bucket.file(filePath).delete();
  }
};

module.exports = {
  admin,
  bucket,
  storage: admin.storage(),
  
  // For compatibility with the Firebase client SDK style you're using
  ref: (path) => bucket.file(path),
  uploadBytes: async (fileRef, buffer, metadata) => {
    await fileRef.save(buffer, {
      metadata: {
        contentType: metadata?.contentType || 'auto',
        metadata: metadata?.customMetadata || {}
      }
    });
    return { ref: fileRef };
  },
  getDownloadURL: async (fileRef) => {
    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-01-2500'
    });
    return url;
  },
  
  // Additional helpers
  ...storageHelpers
};