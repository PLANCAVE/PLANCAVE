import React, { useState } from 'react';
import { Package, Eye, Edit, Trash2, Plus, Search, Filter, MoreVertical, FileText, Ruler, Building } from 'lucide-react';

const ProductManagement = ({ onAddDrawing,
  products = [], 
  filteredProducts = [], 
  formatCurrency = (amount) => `$${amount.toFixed(2)}`, 
  handleDeleteProduct = () => {} 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // table or grid

  // Mock data for architectural drawings
  const mockProducts = [
    {
      id: 1,
      name: "Modern Villa Floor Plan",
      description: "Contemporary 3-bedroom villa with open floor plan and sustainable design features",
      category: "Residential",
      price: 299.99,
      stock: 15,
      status: "active",
      type: "Floor Plan",
      dimensions: "2500 sq ft",
      style: "Modern"
    },
    {
      id: 2,
      name: "Office Complex Blueprint",
      description: "Complete architectural drawings for 5-story commercial office building",
      category: "Commercial",
      price: 899.99,
      stock: 8,
      status: "active",
      type: "Blueprint",
      dimensions: "45000 sq ft",
      style: "Contemporary"
    },
    {
      id: 3,
      name: "Luxury Apartment Layout",
      description: "High-end apartment design with premium finishes and smart home integration",
      category: "Residential",
      price: 549.99,
      stock: 2,
      status: "active",
      type: "Layout",
      dimensions: "1800 sq ft",
      style: "Luxury"
    },
    {
      id: 4,
      name: "Industrial Warehouse Design",
      description: "Functional warehouse design with loading docks and office space",
      category: "Industrial",
      price: 1299.99,
      stock: 0,
      status: "inactive",
      type: "Design",
      dimensions: "75000 sq ft",
      style: "Industrial"
    },
    {
      id: 5,
      name: "Cozy Cottage Plans",
      description: "Charming small home design perfect for countryside living",
      category: "Residential",
      price: 199.99,
      stock: 25,
      status: "active",
      type: "Plans",
      dimensions: "1200 sq ft",
      style: "Traditional"
    }
  ];

  const displayProducts = filteredProducts.length > 0 ? filteredProducts : mockProducts;
  const categories = ['all', ...new Set(displayProducts.map(p => p.category))];

  const filteredBySearch = displayProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const finalProducts = selectedCategory === 'all' 
    ? filteredBySearch 
    : filteredBySearch.filter(p => p.category === selectedCategory);

  const getStatusColor = (status) => {
    return status === 'active' 
      ? 'bg-green-100 text-green-800 border-green-200' 
      : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStockColor = (stock) => {
    if (stock === 0) return 'bg-red-100 text-red-800 border-red-200';
    if (stock < 5) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Residential': return <Building className="w-4 h-4" />;
      case 'Commercial': return <Package className="w-4 h-4" />;
      case 'Industrial': return <Ruler className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Architectural Drawings</h1>
                <p className="text-gray-600">Manage your architectural drawing inventory</p>
              </div>
            </div>
           
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Drawings</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{displayProducts.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Listings</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {displayProducts.filter(p => p.status === 'active').length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Eye className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Low Stock</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  {displayProducts.filter(p => p.stock < 5 && p.stock > 0).length}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Value</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {formatCurrency(displayProducts.reduce((sum, p) => sum + (p.price * p.stock), 0))}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Ruler className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search architectural drawings..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </button>
            </div>
          </div>
        </div>
          {/* Add Drawing Button */}
                <div className="flex justify-end mb-4">
                  <button
                    onClick={onAddDrawing}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <Plus className="h-5 w-5" />
                    <span>Add Drawing</span>
                  </button>
                </div>

        {/* Product Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {finalProducts.length > 0 ? (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-6 font-semibold text-gray-900">Drawing</th>
                      <th className="text-left py-3 px-6 font-semibold text-gray-900">Category</th>
                      <th className="text-left py-3 px-6 font-semibold text-gray-900">Type</th>
                      <th className="text-left py-3 px-6 font-semibold text-gray-900">Dimensions</th>
                      <th className="text-left py-3 px-6 font-semibold text-gray-900">Price</th>
                      <th className="text-left py-3 px-6 font-semibold text-gray-900">Stock</th>
                      <th className="text-left py-3 px-6 font-semibold text-gray-900">Status</th>
                      <th className="text-right py-3 px-6 font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {finalProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                              {getCategoryIcon(product.category)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                              <p className="text-sm text-gray-600 truncate">{product.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full border border-blue-200">
                            {getCategoryIcon(product.category)}
                            {product.category}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-900 font-medium">{product.type}</td>
                        <td className="py-4 px-6 text-gray-600">{product.dimensions}</td>
                        <td className="py-4 px-6 text-gray-900 font-semibold">{formatCurrency(product.price)}</td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex px-2 py-1 text-sm font-medium rounded-full border ${getStockColor(product.stock)}`}>
                            {product.stock}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex px-2 py-1 text-sm font-medium rounded-full border ${getStatusColor(product.status)}`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              onClick={() => handleDeleteProduct(product.id, product.name)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-200">
                {finalProducts.map((product) => (
                  <div key={product.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                        {getCategoryIcon(product.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                        
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full border border-blue-200">
                            {product.category}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full border border-gray-200">
                            {product.type}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStockColor(product.stock)}`}>
                            Stock: {product.stock}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(product.status)}`}>
                            {product.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <div>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(product.price)}</p>
                            <p className="text-sm text-gray-600">{product.dimensions}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              onClick={() => handleDeleteProduct(product.id, product.name)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="p-6 bg-gray-100 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No drawings found</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {searchTerm || selectedCategory !== 'all' 
                  ? "No architectural drawings match your current search or filter criteria." 
                  : "Start building your architectural drawing collection by adding your first design."}
              </p>

      
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductManagement;