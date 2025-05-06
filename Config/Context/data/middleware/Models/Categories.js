const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
});
categorySchema.index({ name: 1 }); // Index category name

module.exports = mongoose.model('Category', categorySchema);
