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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-teal-50/30">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a] text-white py-20 overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <h1 className="text-4xl md:text-6xl font-serif font-light tracking-wide mb-6 drop-shadow-2xl">
            Find Your Perfect Architectural Design
          </h1>
          <p className="text-xl md:text-2xl text-teal-100 max-w-3xl font-light">
            Browse thousands of professional architectural and structural designs from expert designers
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-10">
        <div className="card shadow-2xl border-2 border-teal-100">
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
            <button className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-3 rounded-lg hover:shadow-lg hover:shadow-teal-500/50 transition-all flex items-center gap-2">
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
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-600"></div>
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
                <div className="card hover:shadow-2xl hover:shadow-teal-500/20 hover:border-teal-200 transition-all cursor-pointer group transform hover:-translate-y-1 duration-300">
                  <div className="relative h-48 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg overflow-hidden mb-4">
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
                    <div className="absolute top-2 right-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg">
                      KSH {plan.price.toLocaleString()}
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-xl mb-2 group-hover:text-teal-600 transition-colors">
                    {plan.name}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-lg font-medium">
                      {plan.category}
                    </span>
                    <span className="font-medium">• {plan.sales_count} sales</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    <span>{plan.area}m²</span>
                    <span>• {plan.bedrooms} bed</span>
                    <span>• {plan.bathrooms} bath</span>
                    <span>• {plan.floors} floor</span>
                  </div>
                  
                  {isAuthenticated && (
                    <div className="flex gap-2">
                      <button className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600 text-white py-2.5 rounded-lg hover:shadow-lg hover:shadow-teal-500/50 transition-all text-sm font-semibold flex items-center justify-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        Purchase
                      </button>
                      <button className="bg-teal-50 hover:bg-teal-100 text-teal-600 p-2.5 rounded-lg transition-colors">
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
