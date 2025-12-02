import { useState, useEffect } from 'react';
import { browsePlans } from '../api';
import { Search, Filter, Heart, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Plan {
  id: string;
  name: string;
  category: string;
  price: number;
  area: number;
  bedrooms: number;
  bathrooms: number;
  floors: number;
  image_url: string;
  sales_count: number;
}

export default function BrowsePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    loadPlans();
  }, [search, category]);

  const loadPlans = async () => {
    try {
      const params: any = {};
      if (search) params.search = search;
      if (category) params.category = category;
      
      const response = await browsePlans(params);
      setPlans(response.data.results || []);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Find Your Perfect Architectural Design
          </h1>
          <p className="text-xl text-primary-100 max-w-2xl">
            Browse thousands of professional architectural and structural designs from expert designers
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 -mt-8">
        <div className="card">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search plans..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-10"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field md:w-48"
            >
              <option value="">All Categories</option>
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
              <option value="Industrial">Industrial</option>
              <option value="Healthcare">Healthcare</option>
            </select>
            <button className="btn-secondary flex items-center gap-2">
              <Filter className="w-4 h-4" />
              More Filters
            </button>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading plans...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No plans found. Try adjusting your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Link key={plan.id} to={`/plans/${plan.id}`}>
                <div className="card hover:shadow-lg transition-shadow cursor-pointer group">
                  <div className="relative h-48 bg-gray-200 rounded-lg overflow-hidden mb-4">
                    {plan.image_url ? (
                      <img 
                        src={plan.image_url} 
                        alt={plan.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No Image
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-white px-3 py-1 rounded-full text-sm font-semibold">
                      KSH {plan.price.toLocaleString()}
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-lg mb-2 group-hover:text-primary-600 transition-colors">
                    {plan.name}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <span className="bg-primary-50 text-primary-700 px-2 py-1 rounded">
                      {plan.category}
                    </span>
                    <span>• {plan.sales_count} sales</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    <span>{plan.area}m²</span>
                    <span>• {plan.bedrooms} bed</span>
                    <span>• {plan.bathrooms} bath</span>
                    <span>• {plan.floors} floor</span>
                  </div>
                  
                  {isAuthenticated && (
                    <div className="flex gap-2">
                      <button className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        Purchase
                      </button>
                      <button className="btn-secondary p-2">
                        <Heart className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
