import { useState, useEffect } from 'react';
import { browsePlans } from '../api';
import { Search, Filter, Heart, ShoppingCart, Building2, Award, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Plan {
  id: string;
  name: string;
  project_type: string;
  description: string;
  package_level: string;
  price: number;
  area: number;
  bedrooms?: number;
  bathrooms?: number;
  floors: number;
  includes_boq: boolean;
  disciplines_included: any;
  image_url: string;
  sales_count: number;
  certifications?: string[];
  created_at: string;
}

export default function BrowsePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [search, setSearch] = useState('');
  const [projectType, setProjectType] = useState('');
  const [packageLevel, setPackageLevel] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [includesBoq, setIncludesBoq] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    loadPlans();
  }, [search, projectType, packageLevel, minPrice, maxPrice, includesBoq, bedrooms]);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (projectType) params.project_type = projectType;
      if (packageLevel) params.package_level = packageLevel;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      if (includesBoq) params.includes_boq = includesBoq;
      if (bedrooms) params.bedrooms = bedrooms;
      
      const response = await browsePlans(params);
      setPlans(response.data.results || []);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setProjectType('');
    setPackageLevel('');
    setMinPrice('');
    setMaxPrice('');
    setIncludesBoq('');
    setBedrooms('');
  };

  const getPackageBadgeColor = (level: string) => {
    switch(level) {
      case 'basic': return 'bg-gray-100 text-gray-700';
      case 'standard': return 'bg-blue-100 text-blue-700';
      case 'premium': return 'bg-purple-100 text-purple-700';
      case 'complete': return 'bg-gradient-to-r from-purple-600 to-pink-600 text-white';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-teal-50/30">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a] text-white py-20 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <h1 className="text-4xl md:text-6xl font-serif font-light tracking-wide mb-6 drop-shadow-2xl">
            Professional Construction Plans
          </h1>
          <p className="text-xl md:text-2xl text-teal-100 max-w-3xl font-light">
            Complete architectural, structural, MEP & BOQ packages from certified designers
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-10">
        <div className="card shadow-2xl border-2 border-teal-100">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search plans by name or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                  showFilters 
                    ? 'bg-teal-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Filter className="w-5 h-5" />
                Filters
              </button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="input-field"
                  >
                    <option value="">All Types</option>
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Institutional">Institutional</option>
                    <option value="Mixed-Use">Mixed-Use</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Package Level</label>
                  <select
                    value={packageLevel}
                    onChange={(e) => setPackageLevel(e.target.value)}
                    className="input-field"
                  >
                    <option value="">All Packages</option>
                    <option value="basic">Basic (Arch)</option>
                    <option value="standard">Standard (Arch+Struct)</option>
                    <option value="premium">Premium (Arch+Struct+MEP+BOQ)</option>
                    <option value="complete">Complete (Everything)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Includes BOQ</label>
                  <select
                    value={includesBoq}
                    onChange={(e) => setIncludesBoq(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Any</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
                  <select
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Any</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5+</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Price (KSH)</label>
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="0"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Price (KSH)</label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="100000"
                    className="input-field"
                  />
                </div>

                <div className="col-span-2 flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="text-sm text-gray-600 hover:text-gray-900 underline"
                  >
                    Clear all filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-teal-600"></div>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No plans found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your filters or search terms</p>
            <button onClick={clearFilters} className="btn-primary">
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {plans.length} Plans Available
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Link
                  key={plan.id}
                  to={`/plans/${plan.id}`}
                  className="card hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group overflow-hidden"
                >
                  {/* Image */}
                  <div className="relative h-56 overflow-hidden rounded-t-xl -m-6 mb-4">
                    <img
                      src={plan.image_url || '/placeholder.jpg'}
                      alt={plan.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute top-4 right-4 flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPackageBadgeColor(plan.package_level)}`}>
                        {plan.package_level?.toUpperCase()}
                      </span>
                    </div>
                    {plan.includes_boq && (
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 bg-green-500 text-white rounded-full text-xs font-bold flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          BOQ Included
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-teal-600 transition-colors">
                        {plan.name}
                      </h3>
                      <span className="text-2xl font-bold text-teal-600">
                        KSH {plan.price.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {plan.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {plan.project_type}
                      </span>
                      <span>{plan.area}m²</span>
                      {plan.bedrooms && <span>{plan.bedrooms} Bed</span>}
                      <span>{plan.floors} Floor{plan.floors > 1 ? 's' : ''}</span>
                    </div>

                    {/* Disciplines */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {plan.disciplines_included?.architectural && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">📐 Arch</span>
                      )}
                      {plan.disciplines_included?.structural && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">🏗️ Struct</span>
                      )}
                      {(plan.disciplines_included?.mep?.electrical || plan.disciplines_included?.mep?.plumbing || plan.disciplines_included?.mep?.mechanical) && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">⚡ MEP</span>
                      )}
                      {plan.disciplines_included?.civil && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">🛣️ Civil</span>
                      )}
                      {plan.disciplines_included?.fire_safety && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">🚨 Fire</span>
                      )}
                      {plan.disciplines_included?.interior && (
                        <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs">🎨 Interior</span>
                      )}
                    </div>

                    {/* Certifications */}
                    {plan.certifications && plan.certifications.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                        <Award className="w-4 h-4 text-yellow-500" />
                        <span>{plan.certifications.length} Certification{plan.certifications.length > 1 ? 's' : ''}</span>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="text-sm text-gray-500">
                        {plan.sales_count} sold
                      </span>
                      <div className="flex gap-2">
                        {isAuthenticated && (
                          <>
                            <button 
                              onClick={(e) => {e.preventDefault(); /* Add to favorites */}}
                              className="p-2 hover:bg-red-50 rounded-full transition-colors"
                            >
                              <Heart className="w-5 h-5 text-gray-400 hover:text-red-500" />
                            </button>
                            <button 
                              onClick={(e) => {e.preventDefault(); /* Add to cart */}}
                              className="p-2 hover:bg-green-50 rounded-full transition-colors"
                            >
                              <ShoppingCart className="w-5 h-5 text-gray-400 hover:text-green-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
