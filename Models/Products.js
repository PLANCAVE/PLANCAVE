const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    name: String,
    category: String,
    description: String,
    price: Number,
    image: String,
    bedrooms: Number,
    bathrooms: Number,
    floors: Number,
    area: Number,
    cadFileUrl: String, 
    pdfFileUrl: String, 
});

productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ category: 1, price: 1 });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
