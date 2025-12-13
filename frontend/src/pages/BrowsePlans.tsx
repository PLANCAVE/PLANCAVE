import { useState, useEffect } from 'react';
import { browsePlans } from '../api';
import { Search, Filter, Heart, ShoppingCart, Building2, Award, FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCustomerData } from '../contexts/CustomerDataContext';

interface Plan {
  id: string;
  name: string;
  project_type: string;
  category?: string;
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
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [projectType, setProjectType] = useState('');
  const [packageLevel, setPackageLevel] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [includesBoq, setIncludesBoq] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { favoriteIds, cartIds, toggleFavorite, toggleCartItem } = useCustomerData();
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [cartBusyId, setCartBusyId] = useState<string | null>(null);

  const planCategories = [
    'Mansion',
    'Bungalow',
    'Townhouse',
    'Duplex',
    'Apartment',
    'Villa',
    'Commercial Complex'
  ];

  // Initial load: fetch all available plans from backend
  useEffect(() => {
    const loadAllPlans = async () => {
      setLoading(true);
      try {
        const response = await browsePlans();
        const results: Plan[] = response.data.results || [];
        setAllPlans(results);
        setPlans(results);
      } catch (error) {
        console.error('Failed to load plans:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAllPlans();
  }, []);

  // Client-side filtering so all plans are visible by default
  useEffect(() => {
    let filtered = [...allPlans];

    if (search) {
      const lower = search.toLowerCase();
      filtered = filtered.filter(plan =>
        plan.name.toLowerCase().includes(lower) ||
        plan.description.toLowerCase().includes(lower)
      );
    }

    if (category) {
      filtered = filtered.filter(plan => plan.category === category);
    }

    if (projectType) {
      filtered = filtered.filter(plan => plan.project_type === projectType);
    }

    if (packageLevel) {
      filtered = filtered.filter(plan => plan.package_level === packageLevel);
    }

    if (minPrice) {
      const min = Number(minPrice);
      if (!Number.isNaN(min)) {
        filtered = filtered.filter(plan => plan.price >= min);
      }
    }

    if (maxPrice) {
      const max = Number(maxPrice);
      if (!Number.isNaN(max)) {
        filtered = filtered.filter(plan => plan.price <= max);
      }
    }

    if (includesBoq) {
      const val = includesBoq === 'true';
      filtered = filtered.filter(plan => plan.includes_boq === val);
    }

    if (bedrooms) {
      const beds = Number(bedrooms);
      if (!Number.isNaN(beds)) {
        if (beds === 5) {
          // 5+ option
          filtered = filtered.filter(plan => (plan.bedrooms || 0) >= 5);
        } else {
          filtered = filtered.filter(plan => plan.bedrooms === beds);
        }
      }
    }

    setPlans(filtered);
  }, [allPlans, search, category, projectType, packageLevel, minPrice, maxPrice, includesBoq, bedrooms]);

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setProjectType('');
    setPackageLevel('');
    setMinPrice('');
    setMaxPrice('');
    setIncludesBoq('');
    setBedrooms('');
  };

  const ensureAuthenticated = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return false;
    }
    return true;
  };

  const handleFavoriteClick = async (planId: string) => {
    if (!ensureAuthenticated()) return;
    setFavoriteBusyId(planId);
    try {
      await toggleFavorite(planId);
    } finally {
      setFavoriteBusyId(null);
    }
  };

  const handleCartClick = async (planId: string) => {
    if (!ensureAuthenticated()) return;
    setCartBusyId(planId);
    try {
      await toggleCartItem(planId);
    } finally {
      setCartBusyId(null);
    }
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

  const apiBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-teal-50/30">
      {/* Header with browse label and controls */}
      <div className="relative bg-gradient-to-r from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a] h-16 md:h-20 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="absolute top-0 right-10 w-40 h-40 bg-teal-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-10 w-32 h-32 bg-cyan-400/10 rounded-full blur-3xl"></div>

        <div className="relative z-10 h-full">
          <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between gap-4">
            <span className="text-xs font-medium tracking-wide text-teal-100 uppercase">
              Browse plans
            </span>
            <div className="flex flex-wrap justify-end gap-2 items-center">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-white/95 text-gray-800 hover:bg-white shadow-sm"
              >
                <Search className="w-4 h-4 text-gray-500" />
                <span>Search plans</span>
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium border transition-all shadow-sm ${
                  showFilters 
                    ? 'bg-teal-600 text-white border-teal-500' 
                    : 'bg-white/90 text-gray-800 border-white/70 hover:bg-white'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filter plans</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters content */}
      <div className="max-w-5xl mx-auto px-4 mt-2 md:mt-4 relative z-10 space-y-3">
        {/* Search Bar - only shows when user wants to search */}
        {showSearch && (
          <div className="flex justify-center">
            <div className="relative flex-1 max-w-xl w-full">
              <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9 py-2 text-sm rounded-full shadow-sm"
              />
            </div>
          </div>
        )}

        {/* Advanced Filters */}
        {showFilters && (
          <div className="card shadow-md border border-teal-100/60 mt-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input-field"
                  >
                    <option value="">All Categories</option>
                    {planCategories.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
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
            </div>
          )}
      </div>

      {/* Plans Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
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
              <h2 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                {plans.length === 1 ? '1 plan' : `${plans.length} plans`} available
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Link
                  key={plan.id}
                  to={`/plans/${plan.id}`}
                  className="card hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group overflow-hidden border border-gray-100"
                >
                  {/* Image */}
                  <div className="relative h-52 overflow-hidden -m-6 mb-4 bg-gray-100">
                    <img
                      src={(plan.image_url ? `${apiBaseUrl}${plan.image_url}` : '/placeholder.jpg')}
                      alt={plan.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
                        {plan.name.trim()}
                      </h3>
                      <span className="text-sm font-bold text-teal-300 bg-black/40 px-2 py-1 rounded-md whitespace-nowrap">
                        KSH {Number(plan.price).toLocaleString()}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3 flex gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shadow-sm ${getPackageBadgeColor(plan.package_level)}`}>
                        {plan.package_level?.toUpperCase()}
                      </span>
                    </div>
                    {plan.includes_boq && (
                      <div className="absolute top-3 left-3">
                        <span className="px-2 py-0.5 bg-green-500 text-white rounded-full text-[11px] font-semibold flex items-center gap-1 shadow-sm">
                          <FileText className="w-3 h-3" />
                          BOQ
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="space-y-3">
                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                        <Building2 className="w-3 h-3" />
                        {plan.project_type}
                      </span>
                      {plan.category && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                          {plan.category}
                        </span>
                      )}
                      <span className="text-gray-500">{plan.area} m²</span>
                      {plan.bedrooms && <span className="text-gray-500">{plan.bedrooms} Bed</span>}
                      <span className="text-gray-500">{plan.floors} Floor{plan.floors > 1 ? 's' : ''}</span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {plan.description}
                    </p>

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
                      <div className="flex items-center gap-2 text-[11px] text-gray-600 mb-2">
                        <Award className="w-4 h-4 text-yellow-500" />
                        <span>{plan.certifications.length} Certification{plan.certifications.length > 1 ? 's' : ''}</span>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500">Starting from</p>
                        <p className="text-base font-semibold text-gray-900">
                          KSH {Number(plan.price).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleFavoriteClick(plan.id);
                          }}
                          disabled={favoriteBusyId === plan.id}
                          className={`p-2 rounded-full transition-colors border ${favoriteIds.has(plan.id) ? 'bg-red-50 border-red-100 text-red-500' : 'border-gray-200 hover:bg-red-50 text-gray-400 hover:text-red-500'}`}
                          aria-pressed={favoriteIds.has(plan.id)}
                          aria-label={favoriteIds.has(plan.id) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Heart className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleCartClick(plan.id);
                          }}
                          disabled={cartBusyId === plan.id}
                          className={`p-2 rounded-full transition-colors border ${cartIds.has(plan.id) ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'border-gray-200 hover:bg-green-50 text-gray-400 hover:text-emerald-600'}`}
                          aria-pressed={cartIds.has(plan.id)}
                          aria-label={cartIds.has(plan.id) ? 'Remove from cart' : 'Add to cart'}
                        >
                          <ShoppingCart className="w-5 h-5" />
                        </button>
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
