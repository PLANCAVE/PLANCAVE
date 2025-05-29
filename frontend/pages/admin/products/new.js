import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { flaskApi } from '../../../axios';
import { toast } from 'react-toastify';

const NewProductPage = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    bedrooms: '',
    category: '',
    bathrooms: '',
    area: '',
    image: ''
  });
  const [errors, setErrors] = useState({});

  // Open modal on component mount with slight delay for smooth animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsModalOpen(true);
    }, 50);
    
    return () => {
      clearTimeout(timer);
      setIsModalOpen(false);
    };
  }, []);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate form fields
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.price) newErrors.price = 'Price is required';
    else if (isNaN(formData.price) || Number(formData.price) <= 0) newErrors.price = 'Price must be a positive number';

    if (!formData.bedrooms) newErrors.bedrooms = 'Bedrooms is required';
    else if (isNaN(formData.bedrooms) || Number(formData.bedrooms) < 0 || !Number.isInteger(Number(formData.bedrooms)))
      newErrors.bedrooms = 'Bedrooms must be a non-negative integer';

    if (!formData.bathrooms) newErrors.bathrooms = 'Bathrooms is required';
    else if (isNaN(formData.bathrooms) || Number(formData.bathrooms) < 0 || !Number.isInteger(Number(formData.bathrooms)))
      newErrors.bathrooms = 'Bathrooms must be a non-negative integer';

    if (!formData.area) newErrors.area = 'Area is required';
    else if (isNaN(formData.area) || Number(formData.area) <= 0)
      newErrors.area = 'Area must be a positive number';

    if (!formData.category.trim()) newErrors.category = 'Category is required';
    if (!formData.image.trim()) newErrors.image = 'Image URL is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('flask_token');
      if (!token) {
        toast.error('You must be logged in to create a product');
        handleClose();
        router.push('/login');
        return;
      }

      await flaskApi.post(
        '/admin/products',
        {
          ...formData,
          price: Number(formData.price),
          bedrooms: Number(formData.bedrooms),
          bathrooms: Number(formData.bathrooms),
          area: Number(formData.area)
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );

      toast.success('Product created successfully!');
      handleClose();
      // Navigate to products page after successful creation
      setTimeout(() => {
        router.push('/admin/products');
      }, 300);
    } catch (error) {
      toast.error(error.response?.data?.message || 'An error occurred while creating the product');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Improved close handler with proper state management
  const handleClose = () => {
    if (isClosing) return; // Prevent multiple close attempts
    
    setIsClosing(true);
    setIsModalOpen(false);
    
    // Clear form data and errors
    setFormData({
      name: '',
      description: '',
      price: '',
      bedrooms: '',
      category: '',
      bathrooms: '',
      area: '',
      image: ''
    });
    setErrors({});
    
    // Navigate back to dashboard after animation completes
    setTimeout(() => {
      router.push('/Dashboard');
    }, 300);
  };

  // Handle backdrop click with proper event handling
  const handleBackdropClick = (e) => {
    // Only close if clicking the backdrop itself, not child elements
    if (e.target === e.currentTarget && !isSubmitting) {
      handleClose();
    }
  };

  // Handle escape key press
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        handleClose();
      }
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen, isSubmitting]);

  // Don't render anything if component is closing
  if (isClosing && !isModalOpen) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 z-50 overflow-y-auto transition-all duration-300 ease-in-out ${
        isModalOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
      }`}
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-300" />

      {/* Modal container */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div 
          className={`relative bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden transition-all duration-300 ease-in-out ${
            isModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()} // Prevent modal from closing when clicking inside
        >
          {/* Modal header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Add a new plan</h1>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className={`p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
                }`}
                aria-label="Close modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Modal body */}
          <div className="p-6 overflow-y-auto max-h-[80vh]">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name */}
                <div className="col-span-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Plan Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        errors.name ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'
                      } ${isSubmitting ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      placeholder="Luxury Villa"
                    />
                    {errors.name && (
                      <div className="absolute right-3 top-3 text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>

                {/* Price */}
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                    Price ($)*
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">$</span>
                    </div>
                    <input
                      type="number"
                      id="price"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      step="0.01"
                      min="0"
                      className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        errors.price ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'
                      } ${isSubmitting ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      placeholder="0.00"
                    />
                    {errors.price && (
                      <div className="absolute right-3 top-3 text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
                </div>

                {/* Bedrooms */}
                <div>
                  <label htmlFor="bedrooms" className="block text-sm font-medium text-gray-700 mb-2">
                    Bedrooms*
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="bedrooms"
                      name="bedrooms"
                      value={formData.bedrooms}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      min="0"
                      step="1"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        errors.bedrooms ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'
                      } ${isSubmitting ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      placeholder="3"
                    />
                    {errors.bedrooms && (
                      <div className="absolute right-3 top-3 text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {errors.bedrooms && <p className="mt-1 text-sm text-red-600">{errors.bedrooms}</p>}
                </div>

                {/* Bathrooms */}
                <div>
                  <label htmlFor="bathrooms" className="block text-sm font-medium text-gray-700 mb-2">
                    Bathrooms*
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="bathrooms"
                      name="bathrooms"
                      value={formData.bathrooms}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      min="0"
                      step="1"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        errors.bathrooms ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'
                      } ${isSubmitting ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      placeholder="2"
                    />
                    {errors.bathrooms && (
                      <div className="absolute right-3 top-3 text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {errors.bathrooms && <p className="mt-1 text-sm text-red-600">{errors.bathrooms}</p>}
                </div>

                {/* Area */}
                <div>
                  <label htmlFor="area" className="block text-sm font-medium text-gray-700 mb-2">
                    Area (sq ft)*
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="area"
                      name="area"
                      value={formData.area}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      min="0"
                      step="0.01"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        errors.area ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'
                      } ${isSubmitting ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      placeholder="1500"
                    />
                    {errors.area && (
                      <div className="absolute right-3 top-3 text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {errors.area && <p className="mt-1 text-sm text-red-600">{errors.area}</p>}
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                    Category*
                  </label>
                  <div className="relative">
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none ${
                        errors.category ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'
                      } ${isSubmitting ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="">Select a category</option>
                      <option value="Contemporary">Contemporary</option>
                      <option value="Apartment">Apartment</option>
                      <option value="Residential">Residential</option>
                      <option value="Modern Villa">Modern Villa</option>
                      <option value="Rustic">Rustic</option>
                      <option value="Bungalow">Bungalow</option>
                      <option value="Mansion">Mansion</option>
                    </select>
                    <div className="absolute right-3 top-3 text-gray-400 pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {errors.category && (
                      <div className="absolute right-10 top-3 text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
                </div>

                {/* Image URL */}
                <div className="col-span-2">
                  <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-2">
                    Image URL*
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      id="image"
                      name="image"
                      value={formData.image}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        errors.image ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'
                      } ${isSubmitting ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      placeholder="https://example.com/image.jpg"
                    />
                    {errors.image && (
                      <div className="absolute right-3 top-3 text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {errors.image && <p className="mt-1 text-sm text-red-600">{errors.image}</p>}
                </div>

                {/* Description */}
                <div className="col-span-2">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description*
                  </label>
                  <div className="relative">
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      rows="4"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none ${
                        errors.description ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'
                      } ${isSubmitting ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      placeholder="Describe the property in detail..."
                    />
                    {errors.description && (
                      <div className="absolute right-3 top-3 text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
                </div>
              </div>

              {/* Image Preview */}
              {formData.image && (
                <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h2 className="text-lg font-medium text-gray-800 mb-3">Image Preview</h2>
                  <div className="border rounded-md p-2 bg-white">
                    <img
                      src={formData.image}
                      alt="Plan preview"
                      className="max-h-64 w-full object-cover rounded-md"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/800x500?text=Image+Not+Found';
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="mt-8 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className={`px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg hover:from-blue-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all ${
                    isSubmitting ? 'opacity-80 cursor-not-allowed' : 'hover:scale-105 hover:shadow-lg'
                  }`}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    'Create Plan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewProductPage;