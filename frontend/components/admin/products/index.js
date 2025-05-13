import { useEffect, useState } from 'react';
import axios from 'axios';
import Sidebar from '@/components/admin/Sidebar';
import ProductCard from '@/components/admin/ProductCard';
import Link from 'next/link';

export default function ProductList() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    axios.get('/api/products')
      .then(res => setProducts(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-100">
    <Sidebar />
    <div className="flex-1 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">All Products</h2>
        <Link href="/admin/products/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          + Add Product
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Example card */}
        <ProductCard
          title="Modern 3-Bedroom House"
          price={12000}
          id="1"
          imageUrl="/placeholder.jpg"
        />
      </div>
    </div>
  </div>
);
};


