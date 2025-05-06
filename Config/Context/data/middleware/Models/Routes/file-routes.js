// file-routes.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateUser } = require('../Server/middleware/auth-middleware');
const { OrderModel } = require('../Models/order-model');

// Route handler for file downloads
const fileRoutes = (app) => {
  // Route to get all downloadable files for a user
  app.get('/api/files', authenticateUser, async (req, res) => {
    try {
      // Find all orders for this user that are paid
      const orders = await OrderModel.find({ 
        userId: req.user.id, 
        paymentStatus: 'paid' 
      });
      
      if (!orders || orders.length === 0) {
        return res.status(200).json({ files: [] });
      }
      
      // Prepare files list for response
      const filesList = orders.flatMap(order => {
        return (order.files || []).map(file => ({
          id: file._id || file.id,
          filename: file.filename,
          orderId: order._id,
          createdAt: file.createdAt || order.createdAt,
          type: file.type || path.extname(file.filename).substring(1)
        }));
      });
      
      return res.status(200).json({ files: filesList });
    } catch (error) {
      console.error('Error fetching files:', error);
      return res.status(500).json({ error: 'Failed to retrieve files' });
    }
  });
  
  // Route to download a specific file
  app.get('/api/files/:orderId/:fileId', authenticateUser, async (req, res) => {
    try {
      const { orderId, fileId } = req.params;
      
      // Find the order
      const order = await OrderModel.findById(orderId);
      
      // Check if order exists and belongs to user
      if (!order || order.userId.toString() !== req.user.id) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Check if payment status is paid
      if (order.paymentStatus !== 'paid') {
        return res.status(403).json({ error: 'Payment required to download this file' });
      }
      
      // Find the specific file in the order
      const file = order.files.find(f => f._id.toString() === fileId || f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Get file path
      const filePath = path.join(
        __dirname, 
        '../', 
        process.env.FILE_STORAGE_PATH || 'storage',
        'orders',
        orderId.toString(),
        file.filename
      );
      
      // Check if file exists on disk
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on server' });
      }
      
      // Track download (optional)
      if (!file.downloads) file.downloads = 0;
      file.downloads++;
      file.lastDownloaded = new Date();
      await order.save();
      
      // Send file
      return res.download(filePath, file.filename);
    } catch (error) {
      console.error('Error downloading file:', error);
      return res.status(500).json({ error: 'Failed to download file' });
    }
  });
  
  // Success page route that checks if an order is ready for download
  app.get('/api/orders/:orderId/status', authenticateUser, async (req, res) => {
    try {
      const { orderId } = req.params;
      
      // Find the order
      const order = await OrderModel.findById(orderId);
      
      // Check if order exists and belongs to user
      if (!order || order.userId.toString() !== req.user.id) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      return res.status(200).json({
        orderId: order._id,
        status: order.paymentStatus,
        filesReady: order.files && order.files.length > 0,
        filesCount: order.files ? order.files.length : 0
      });
    } catch (error) {
      console.error('Error checking order status:', error);
      return res.status(500).json({ error: 'Failed to check order status' });
    }
  });
};

module.exports = {
  fileRoutes
};