const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  fullPath: { type: String, required: true },
  downloadURL: { type: String, required: true },
  size: { type: Number, required: true },
  type: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  dimensions: {
    width: { type: Number },
    height: { type: Number }
  }
});

const planSchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  bedrooms: { type: Number, required: true, min: 1 },
  bathrooms: { type: Number, required: true, min: 1 },
  floors: { type: Number, required: true, min: 1 },
  area: { type: Number, required: true, min: 1 }, // in sqm
  
  // Categories and Subcategories
  mainCategory: {
    type: String,
    required: true,
    enum: ['by-bedrooms', 'by-size', 'by-style', 'by-budget', 'best-sellers', 'new-arrivals']
  },
  subCategory: {
    type: String,
    required: true,
    enum: [
      // By Bedrooms
      '1-bedroom', '2-bedroom', '3-bedroom', '4-bedroom', '5-plus-bedroom',
      // By Size
      'under-100sqm', '100-200sqm', '200-300sqm', '300-400sqm', '400-500sqm','500-750sqm', '750-plus-sqm',
      // By Style
      'bungalows', 'luxury villas', 'apartments', 'contemporary', 'residential', 'mansions',,
      // By Budget
      'under-50k', '50k-100k', '100k-150k', '150k-200k', '200k-plus',
      // Special Collections
      'best-sellers', 'new-arrivals'
    ]
  },
  
  // Style Details
  style: { 
    type: String,
    enum: ['Bungalows', 'Mansions', 'Apartments', 'Contemporary', 'Luxury Villas', 'Residentials'],
  },
  
  // File References
  files: {
    cad: [fileSchema],    // Array of CAD files
    pdf: [fileSchema],    // Construction PDFs
    renders: [fileSchema], // 3D renders
    blueprints: [fileSchema], // 2D blueprints
    documents: [fileSchema]  // Other documents
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add text search index
planSchema.index({
  name: 'text',
  description: 'text',
  'subCategory': 'text'
});

module.exports = mongoose.model('Plan', planSchema);