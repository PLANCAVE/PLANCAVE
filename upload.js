const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure storage
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, 'uploads/') // Temporary local storage
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (_req, file, cb) => {
  const filetypes = {
    'cad': ['application/dwg', 'application/cad', 'application/x-dwg'],
    'pdf': ['application/pdf'],
    'renders': ['image/jpeg', 'image/png', 'image/webp'],
    'blueprints': ['image/jpeg', 'image/png', 'application/pdf'],
    'documents': ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  };

  const isValidType = Object.entries(filetypes).some(([field, types]) => 
    types.includes(file.mimetype) && file.fieldname === field
  );

  if (isValidType) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}. Accepted types: ${JSON.stringify(filetypes)}`));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 25MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: fileFilter
}).fields([
  { name: 'cad', maxCount: 2 }, // Max 2 CAD files
  { name: 'pdf', maxCount: 3 }, // Max 3 PDFs
  { name: 'renders', maxCount: 10 }, // Max 10 renders
  { name: 'blueprints', maxCount: 5 },
  { name: 'documents', maxCount: 5 }
]);

// Middleware to handle upload errors
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    return res.status(400).json({
      error: 'File upload error',
      details: err.message
    });
  } else if (err) {
    // An unknown error occurred
    return res.status(500).json({
      error: 'Server error during file upload',
      details: err.message
    });
  }
  next();
};

module.exports = { upload, handleUploadErrors };