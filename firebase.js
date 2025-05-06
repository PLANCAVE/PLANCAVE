const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Path to service account key file
const serviceAccountPath = path.resolve(__dirname, '../the-plan-cave-c6137-firebase-adminsdk.json');

// Check if service account file exists
if (!fs.existsSync(serviceAccountPath)) {
  console.error('Firebase service account key file not found!');
  console.error('Expected location:', serviceAccountPath);
  process.exit(1);
}

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    storageBucket: "the-plan-cave-c6137.firebasestorage.app"
  });
  console.log('Firebase Admin SDK initialized successfully');
}

// Get Firestore and Storage instances
const db = admin.firestore();
const bucket = admin.storage().bucket();
const auth = admin.auth();

// Helper function to get a signed URL for a file
const getSignedUrl = async (filePath, expiresIn = 3600) => {
  try {
    const [url] = await bucket.file(filePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + (expiresIn * 1000) // Convert seconds to milliseconds
    });
    return url;
  } catch (error) {
    console.error(`Error generating signed URL for ${filePath}:`, error);
    throw error;
  }
};

// Helper function to upload a file to Firebase Storage
const uploadFile = async (localFilePath, destinationPath, metadata = {}) => {
  try {
    const [file] = await bucket.upload(localFilePath, {
      destination: destinationPath,
      metadata: {
        contentType: metadata.contentType || 'application/octet-stream',
        metadata: metadata
      }
    });
    
    console.log(`File uploaded successfully to ${destinationPath}`);
    return file;
  } catch (error) {
    console.error(`Error uploading file to ${destinationPath}:`, error);
    throw error;
  }
};

// Helper function to delete a file from Firebase Storage
const deleteFile = async (filePath) => {
  try {
    await bucket.file(filePath).delete();
    console.log(`File ${filePath} deleted successfully`);
    return true;
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    throw error;
  }
};

// Helper function to check if a file exists in Firebase Storage
const fileExists = async (filePath) => {
  try {
    const [exists] = await bucket.file(filePath).exists();
    return exists;
  } catch (error) {
    console.error(`Error checking if file ${filePath} exists:`, error);
    throw error;
  }
};

module.exports = {
  admin,
  db,
  bucket,
  auth,
  getSignedUrl,
  uploadFile,
  deleteFile,
  fileExists
};