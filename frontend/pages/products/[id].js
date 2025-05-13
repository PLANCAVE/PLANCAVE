import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

export default function ProductDetail() {
    const { user, isLoaded, isSignedIn } = useUser();
    const router = useRouter();
    const { id } = router.query;
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [_error, setError] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const fetchProduct = async () => {
        try {
            console.log('Fetching product with ID:', id); // Debug log
            const response = await fetch(`/api/products/${id}`);
            console.log('Response status:', response.status); // Debug log

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Product data received:', data); // Debug log
            setProduct(data);
            setError(null);
        } catch (error) {
            console.error('Fetch error:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push('/sign-in');
            return;
        }

        if (id && isSignedIn) {
            setLoading(true); // Reset loading state before fetching
            fetchProduct();
        }
    }, [id, isSignedIn, isLoaded]);

    // Combined loading state check
    if (!isLoaded || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    // Authentication check
    if (!isSignedIn) {
        return <div>Please sign in to view this product</div>;
    }

  

    // Product not found
    if (!product) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
                <Link 
                    href="/all-products"
                    className="text-blue-600 hover:text-blue-800 flex items-center"
                >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Continue Shopping
                </Link>
            </div>
        );
    }
  return (
    <>
      <Head>
        <title>{product.name} | The Plan Cave</title>
        <meta name="description" content={`Details for ${product.name}`} />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Navigation Bar */}
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-start h-16 items-center">
              <Link 
                href="/"
                className="text-gray-600 hover:text-gray-900 flex items-center"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Back to Products
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="aspect-w-16 aspect-h-9 bg-gray-200 rounded-lg overflow-hidden">
                <img
                  src={product.images?.[currentImageIndex] || product.image}
                  alt={product.name}
                  className="object-cover w-full h-full"
                />
              </div>
              
              {/* Thumbnail Gallery */}
              {product.images && product.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {product.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`aspect-w-1 aspect-h-1 rounded-md overflow-hidden ${
                        currentImageIndex === index ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      <img
                        src={image}
                        alt={`${product.name} view ${index + 1}`}
                        className="object-cover w-full h-full"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
                <p className="mt-2 text-sm text-gray-500">Plan ID: {product.id}</p>
              </div>

              <div className="text-2xl font-bold text-gray-900">
                ${product.price}
              </div>

              <div className="border-t border-b border-gray-200 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Bedrooms</p>
                    <p className="font-medium">{product.bedrooms}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Bathrooms</p>
                    <p className="font-medium">{product.bathrooms}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Floors</p>
                    <p className="font-medium">{product.floors}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Area</p>
                    <p className="font-medium">{product.area} sqm</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h2 className="text-lg font-semibold mb-2">Description</h2>
                <p className="text-gray-600">{product.description}</p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors">
                  Buy Now
                </button>
                <button className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-md hover:bg-gray-50 transition-colors">
                  Add to Wishlist
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}