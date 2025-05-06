const express = require('express');
const router = express.Router();
const { upload, handleUploadErrors } = require('../middleware/upload');
const Plan = require('../Models/Plan');
// Fix the import path to match the actual file location
const { bucket, ref, uploadBytes, getDownloadURL, storage } = require('../config/firebase-config');
const fs = require('fs');
const path = require('path');

// Helper to upload to Firebase and clean temp files
async function processUpload(file, planId, fileType) {
  if (!file) return null;
  
  try {
    const fileExt = path.extname(file.originalname);
    const firebasePath = `plans/${planId}/${fileType}/${file.fieldname}-${Date.now()}${fileExt}`;
    const fileRef = ref(storage, firebasePath);
    
    // Read the temp file
    const fileBuffer = fs.readFileSync(file.path);
    
    // Upload to Firebase
    await uploadBytes(fileRef, fileBuffer);
    const downloadURL = await getDownloadURL(fileRef);
    
    // Delete temp file
    fs.unlinkSync(file.path);
    
    return {
      fileName: file.originalname,
      fullPath: firebasePath,
      downloadURL,
      size: file.size,
      type: file.mimetype,
      uploadedAt: new Date()
    };
  } catch (error) {
    // Make sure to clean up the temp file even if upload fails
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw error; // Re-throw to be handled by the route handler
  }
}

// Create plan with file uploads
router.post('/', upload, handleUploadErrors, async (req, res) => {
  try {
    const { body, files } = req;
    
    // Create basic plan document first to get an ID
    const plan = new Plan(body);
    
    // Initialize files object if it doesn't exist in the schema
    if (!plan.files) {
      plan.files = {};
    }
    
    // Save the plan first to get a valid _id
    await plan.save();
    
    // Process file uploads
    if (files) {
      // Process CAD files
      if (files.cad && files.cad.length > 0) {
        const cadResults = await Promise.all(
          files.cad.map(file => processUpload(file, plan._id, 'cad'))
        );
        plan.files.cad = cadResults.filter(result => result !== null);
      }
      
      // Process PDF files
      if (files.pdf && files.pdf.length > 0) {
        const pdfResults = await Promise.all(
          files.pdf.map(file => processUpload(file, plan._id, 'pdf'))
        );
        plan.files.pdf = pdfResults.filter(result => result !== null);
      }
      
      // Process renders
      if (files.renders && files.renders.length > 0) {
        const renderResults = await Promise.all(
          files.renders.map(file => processUpload(file, plan._id, 'renders'))
        );
        plan.files.renders = renderResults.filter(result => result !== null);
      }
      
      // Process blueprints
      if (files.blueprints && files.blueprints.length > 0) {
        const blueprintResults = await Promise.all(
          files.blueprints.map(file => processUpload(file, plan._id, 'blueprints'))
        );
        plan.files.blueprints = blueprintResults.filter(result => result !== null);
      }
      
      // Process documents
      if (files.documents && files.documents.length > 0) {
        const documentResults = await Promise.all(
          files.documents.map(file => processUpload(file, plan._id, 'documents'))
        );
        plan.files.documents = documentResults.filter(result => result !== null);
      }
      
      // Save the plan again with the file information
      await plan.save();
    }
    
    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating plan:', error);
    
    // If plan was created but file upload failed, we might want to delete the plan
    // This is optional and depends on your business logic
    if (req.planId) {
      try {
        await Plan.findByIdAndDelete(req.planId);
      } catch (deleteError) {
        console.error('Error deleting plan after failed upload:', deleteError);
      }
    }
    
    // Clean up any remaining temp files
    if (req.files) {
      Object.values(req.files).forEach(fileArray => {
        fileArray.forEach(file => {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      });
    }
    
    res.status(400).json({ error: error.message });
  }
});

// Get all plans
router.get('/', async (_req, res) => {
  try {
    const plans = await Plan.find();
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get plan by ID
router.get('/:id', async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;