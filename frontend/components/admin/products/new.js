
import React from 'react';
import Sidebar from '@/components/admin/Sidebar';
import ProductForm from '@/components/admin/ProductForm';

const NewProductPage = () => {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 p-6">
        <h2 className="text-xl font-semibold mb-4">Add New Product</h2>
        <ProductForm mode="create" />
      </div>
    </div>
  );
};

export default NewProductPage;