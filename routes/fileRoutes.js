const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const router = express.Router();

// Reference to MongoDB collections
let filesCollection;

// Authentication middleware
let authenticateToken;
let isAdmin;

// Firebase storage bucket
let bucket;

// Initialize the router with MongoDB collections and middleware
const initFileRoutes = (db, authMiddleware, adminMiddleware, firebaseBucket = null) => {
  filesCollection = db.collection('files');
  authenticateToken = authMiddleware;
  isAdmin = adminMiddleware;
  bucket = firebaseBucket;
  
  // Apply authentication middleware to all routes
  router.use(authenticateToken);
  
  // Create indexes
  filesCollection.createIndex({ uploadedBy: 1 });
  filesCollection.createIndex({ fileName: 1 });
  
  return router;
};

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Upload file to Firebase Storage
 * @param {Object} file - File object
 * @param {string} fileName - Name to save the file as
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
async function uploadToFirebase(file, fileName) {
  if (!bucket) {
    throw new Error('Firebase storage not configured');
  }
  
  const fileBuffer = file.data;
  const fileUpload = bucket.file(fileName);
  
  await fileUpload.save(fileBuffer, {
    metadata: {
      contentType: file.mimetype
    }
  });
  
  // Make the file publicly accessible
  await fileUpload.makePublic();
  
  // Get the public URL
  return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
}

/**
 * @route POST /api/files/upload
 * @desc Upload a new file
 * @access Private
 */
router.post('/upload', async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ message: 'No files were uploaded.' });
    }

    const file = req.files.file;
    const fileId = uuidv4();
    const fileName = fileId + '-' + file.name;
    
    let filePath;
    let publicUrl;
    
    // Determine storage method
    const useFirebase = bucket && (req.body.storage === 'firebase' || process.env.DEFAULT_STORAGE === 'firebase');
    
    if (useFirebase) {
      // Upload to Firebase Storage
      publicUrl = await uploadToFirebase(file, fileName);
      filePath = publicUrl;
    } else {
      // Upload to local filesystem
      filePath = path.join(uploadsDir, fileName);
      await file.mv(filePath);
      publicUrl = `/uploads/${fileName}`;
    }

    // Store file metadata in database
    const userId = new ObjectId(req.user.id);
    const fileMetadata = {
      fileId,
      originalName: file.name,
      fileName: fileName,
      path: publicUrl,
      size: file.size,
      mimetype: file.mimetype,
      storage: useFirebase ? 'firebase' : 'local',
      uploadedBy: userId,
      uploadedAt: new Date(),
      isActive: true
    };

    await filesCollection.insertOne(fileMetadata);

    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        id: fileId,
        originalName: file.name,
        fileName: fileName,
        path: publicUrl,
        size: file.size,
        mimetype: file.mimetype,
        storage: useFirebase ? 'firebase' : 'local'
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

/**
 * @route GET /api/files
 * @desc Get all files
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    // Admin can see all files, regular users only see their own
    const query = req.user.role === 'admin' 
      ? { isActive: true } 
      : { uploadedBy: new ObjectId(req.user.id), isActive: true };
    
    const files = await filesCollection.find(query).toArray();
    
    const fileList = files.map(file => ({
      id: file.fileId,
      originalName: file.originalName,
      fileName: file.fileName,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      storage: file.storage || 'local',
      uploadedAt: file.uploadedAt
    }));
    
    res.json(fileList);
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/files/:id
 * @desc Get file by ID
 * @access Private
 */
router.get('/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    
    // Admin can see all files, regular users only see their own
    const query = req.user.role === 'admin' 
      ? { fileId, isActive: true } 
      : { fileId, uploadedBy: new ObjectId(req.user.id), isActive: true };
    
    const file = await filesCollection.findOne(query);
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const fileMetadata = {
      id: file.fileId,
      originalName: file.originalName,
      fileName: file.fileName,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      storage: file.storage || 'local',
      uploadedAt: file.uploadedAt
    };
    
    res.json(fileMetadata);
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/files/:id
 * @desc Update file
 * @access Private
 */
router.put('/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    
    // Check if file exists and user has permission
    const query = req.user.role === 'admin' 
      ? { fileId, isActive: true } 
      : { fileId, uploadedBy: new ObjectId(req.user.id), isActive: true };
    
    const existingFile = await filesCollection.findOne(query);
    
    if (!existingFile) {
      return res.status(404).json({ message: 'File not found or access denied' });
    }
    
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ message: 'No files were uploaded.' });
    }
    
    // Determine storage method
    const useFirebase = bucket && (req.body.storage === 'firebase' || 
                                  (existingFile.storage === 'firebase' && req.body.storage !== 'local'));
    
    // Delete existing file
    if (existingFile.storage === 'firebase' && bucket) {
      // Delete from Firebase
      try {
        const fileName = existingFile.fileName;
        await bucket.file(fileName).delete();
      } catch (error) {
        console.warn('Error deleting file from Firebase:', error);
      }
    } else {
      // Delete from local filesystem
      const existingFilePath = path.join(uploadsDir, existingFile.fileName);
      if (fs.existsSync(existingFilePath)) {
        fs.unlinkSync(existingFilePath);
      }
    }
    
    // Upload new file
    const file = req.files.file;
    const fileName = fileId + '-' + file.name;
    let filePath;
    let publicUrl;
    
    if (useFirebase) {
      // Upload to Firebase Storage
      publicUrl = await uploadToFirebase(file, fileName);
      filePath = publicUrl;
    } else {
      // Upload to local filesystem
      filePath = path.join(uploadsDir, fileName);
      await file.mv(filePath);
      publicUrl = `/uploads/${fileName}`;
    }

    // Update file metadata
    const updateResult = await filesCollection.updateOne(
      { fileId },
      { 
        $set: {
          originalName: file.name,
          fileName: fileName,
          path: publicUrl,
          size: file.size,
          mimetype: file.mimetype,
          storage: useFirebase ? 'firebase' : 'local',
          updatedBy: new ObjectId(req.user.id),
          updatedAt: new Date()
        } 
      }
    );
    
    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({ message: 'File update failed' });
    }
    
    // Get updated file metadata
    const updatedFile = await filesCollection.findOne({ fileId });

    res.json({
      message: 'File updated successfully',
      file: {
        id: updatedFile.fileId,
        originalName: updatedFile.originalName,
        fileName: updatedFile.fileName,
        path: updatedFile.path,
        size: updatedFile.size,
        mimetype: updatedFile.mimetype,
        storage: updatedFile.storage
      }
    });
  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

/**
 * @route DELETE /api/files/:id
 * @desc Delete file
 * @access Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    
    // Check if file exists and user has permission
    const query = req.user.role === 'admin' 
      ? { fileId, isActive: true } 
      : { fileId, uploadedBy: new ObjectId(req.user.id), isActive: true };
    
    const existingFile = await filesCollection.findOne(query);
    
    if (!existingFile) {
      return res.status(404).json({ message: 'File not found or access denied' });
    }
    
    // Option 1: Soft delete (just mark as inactive)
    await filesCollection.updateOne(
      { fileId },
      { 
        $set: {
          isActive: false,
          deletedBy: new ObjectId(req.user.id),
          deletedAt: new Date()
        } 
      }
    );
    
    // Option 2: Hard delete (uncomment to enable)
    // If using Firebase and it's a Firebase file
    /*
    if (existingFile.storage === 'firebase' && bucket) {
      try {
        await bucket.file(existingFile.fileName).delete();
      } catch (error) {
        console.warn('Error deleting file from Firebase:', error);
      }
    } else {
      // Delete file from filesystem
      const filePath = path.join(uploadsDir, existingFile.fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Delete from database
    await filesCollection.deleteOne({ fileId });
    */
    
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = initFileRoutes;