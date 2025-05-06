const mongoose = require('mongoose');

// Define the file schema
const fileSchema = new mongoose.Schema({
  // File information
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  downloadURL: { type: String, required: true },
  size: { type: Number },
  type: { type: String },
  fileType: { 
    type: String, 
    enum: ['cad', 'pdf', 'render', 'blueprint', 'document'], 
    required: true 
  },
  // Relationships
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  // Timestamps
  uploadedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Create the File model
const File = mongoose.model('File', fileSchema);

// File model operations
const FileModel = {
  async create(fileData) {
    try {
      const file = new File(fileData);
      await file.save();
      return file;
    } catch (error) {
      console.error('Error creating file record:', error);
      throw error;
    }
  },
  
  async findOne(query) {
    try {
      return await File.findOne({
        orderId: query.orderId,
        fileType: query.fileType
      });
    } catch (error) {
      console.error('Error finding file:', error);
      throw error;
    }
  },
  
  async findByOrderId(orderId) {
    try {
      return await File.find({ orderId }).sort({ createdAt: -1 });
    } catch (error) {
      console.error(`Error finding files for order ${orderId}:`, error);
      throw error;
    }
  },
  
  // Additional useful methods
  async findByPlanId(planId) {
    try {
      return await File.find({ planId }).sort({ createdAt: -1 });
    } catch (error) {
      console.error(`Error finding files for plan ${planId}:`, error);
      throw error;
    }
  },
  
  async findByType(fileType) {
    try {
      return await File.find({ fileType }).sort({ createdAt: -1 });
    } catch (error) {
      console.error(`Error finding files of type ${fileType}:`, error);
      throw error;
    }
  }
};

module.exports = { FileModel, File };