const express = require('express');
const router = express.Router();
const checkPayment = require('/home/badman/ThePlanCave/middleware/ckeckPaymentMiddleware.js'); // Import the middleware

// Firebase Storage Setup
const { getStorage, ref, getDownloadURL } = require('firebase-admin/storage');

router.get('/download/:productId', checkPayment, async (req, res) => {
  try {
    const { productId } = req.params;

    // Assuming the product model contains a field with the file URL in Firebase
    const product = await Product.findById(productId);
    if (!product || !product.fileUrl) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Generate a signed URL from Firebase Storage
    const storage = getStorage();
    const fileRef = ref(storage, product.fileUrl);
    const downloadUrl = await getDownloadURL(fileRef);

    res.json({ downloadUrl });
  } catch (error) {
    console.error('Error generating download link:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
