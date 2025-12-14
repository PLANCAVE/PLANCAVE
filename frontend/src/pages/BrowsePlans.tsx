import { useState, useEffect, useRef } from 'react';
import { browsePlans } from '../api';
import { Search, Heart, ShoppingCart, Building2, Award, FileText, ChevronDown } from 'lucide-react';
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
  features?: string[];
}

export default function BrowsePlans() {
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [search, setSearch] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedBudget, setSelectedBudget] = useState('');
  const [selectedBedrooms, setSelectedBedrooms] = useState('');
  const [selectedFloors, setSelectedFloors] = useState('');
  const [activePreset, setActivePreset] = useState<'shop' | 'top-selling'>('shop');
  const [openDropdown, setOpenDropdown] = useState<null | 'size' | 'style' | 'budget' | 'bedrooms' | 'floors'>(null);
  const [showSearch, setShowSearch] = useState(false);
  const filterBarRef = useRef<HTMLDivElement>(null);

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { favoriteIds, cartIds, toggleFavorite, toggleCartItem } = useCustomerData();
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [cartBusyId, setCartBusyId] = useState<string | null>(null);

  const planCategories = [
    'Residential',
    'Commercial',
    'Industrial',
    'Institutional',
    'Mixed-Use',
    'Mansion',
    'Bungalow',
    'Townhouse',
    'Duplex',
    'Apartment',
    'Villa',
    'Commercial Complex',
    'Modern',
    'Minimalist',
    'Contemporary'
  ];

  const sizeOptions = [
    { id: 'small', label: 'Small (50-100 m²)', min: 50, max: 100 },
    { id: 'medium', label: 'Medium (100-250 m²)', min: 100, max: 250 },
    { id: 'large', label: 'Large (250-500 m²)', min: 250, max: 500 },
    { id: 'xl', label: 'Extra Large (500+ m²)', min: 500 }
  ];

  const budgetOptions = [
    { id: 'budget', label: 'Budget (Under KSH 150K)', max: 150000 },
    { id: 'standard', label: 'Standard (KSH 150K-500K)', min: 150000, max: 500000 },
    { id: 'premium', label: 'Premium (KSH 500K-1.5M)', min: 500000, max: 1500000 },
    { id: 'luxury', label: 'Luxury (KSH 1.5M+)', min: 1500000 }
  ];

  const bedroomOptions = [
    { id: '1-2', label: '1-2 Bedrooms', min: 1, max: 2 },
    { id: '3-4', label: '3-4 Bedrooms', min: 3, max: 4 }, 
    { id: '5+', label: '5+ Bedrooms', min: 5 }
  ];

  const floorOptions = [
    { id: 'bungalow', label: 'Bungalow (1 Floor)' },
    { id: '2-story', label: '2 Story' },
    { id: 'multi', label: 'Multi-Story (3+ Floors)' }
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
      filtered = filtered.filter((plan) =>
        plan.name.toLowerCase().includes(lower) || plan.description.toLowerCase().includes(lower)
      );
    }

    if (selectedStyle) {
      const normalizedStyle = selectedStyle.toLowerCase();
      filtered = filtered.filter((plan) => 
        (plan.project_type || '').toLowerCase() === normalizedStyle ||
        (plan.category || '').toLowerCase() === normalizedStyle
      );
    }

    if (selectedSize) {
      const config = sizeOptions.find((option) => option.id === selectedSize);
      if (config) {
        filtered = filtered.filter((plan) => {
          const area = Number(plan.area) || 0;
          if (config.min && area < config.min) return false;
          if (config.max && area >= config.max) return false;
          return true;
        });
      }
    }

    if (selectedBudget) {
      const config = budgetOptions.find((option) => option.id === selectedBudget);
      if (config) {
        filtered = filtered.filter((plan) => {
          const price = Number(plan.price) || 0;
          if (config.min && price < config.min) return false;
          if (config.max && price > config.max) return false;
          return true;
        });
      }
    }

    if (selectedBedrooms) {
      const config = bedroomOptions.find(o => o.id === selectedBedrooms);
      if (config) {
        filtered = filtered.filter(plan => {
          const beds = plan.bedrooms || 0;
          return (!config.min || beds >= config.min) && 
                 (!config.max || beds <= config.max);
        });
      }
    }

    if (selectedFloors) {
      filtered = filtered.filter(plan => {
        const floors = plan.floors || 1;
        return (
          (selectedFloors === 'bungalow' && (floors === 1 || plan.project_type === 'Bungalows')) ||
          (selectedFloors === '2-story' && floors === 2) ||
          (selectedFloors === 'multi' && floors >= 3)
        );
      });
    }

    if (activePreset === 'top-selling') {
      filtered = [...filtered].sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
    }

    setPlans(filtered);
  }, [allPlans, search, selectedStyle, selectedSize, selectedBudget, selectedBedrooms, selectedFloors, activePreset]);

  const clearFilters = () => {
    setSearch('');
    setSelectedStyle('');
    setSelectedSize('');
    setSelectedBudget('');
    setSelectedBedrooms('');
    setSelectedFloors('');
    setActivePreset('shop');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: 'size' | 'style' | 'budget' | 'bedrooms' | 'floors') => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const dropdownButtonClass = (isActive: boolean) => {
    return `flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium transition ${isActive ? 'bg-[#0f4c45] text-white' : 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-200'}`;
  };

  const presetButtonClass = (isActive: boolean) =>
    `text-sm font-semibold tracking-wide ${
      isActive
        ? 'text-[#0f4c45] after:block after:h-0.5 after:bg-[#0f4c45] after:rounded-full'
        : 'text-gray-600 hover:text-[#0f4c45]'
    }`;

  const activeChips = [
    selectedStyle && { label: selectedStyle, onRemove: () => setSelectedStyle('') },
    selectedSize && {
      label: sizeOptions.find((option) => option.id === selectedSize)?.label || 'Size',
      onRemove: () => setSelectedSize(''),
    },
    selectedBudget && {
      label: budgetOptions.find((option) => option.id === selectedBudget)?.label || 'Budget',
      onRemove: () => setSelectedBudget(''),
    },
    selectedBedrooms && {
      label: bedroomOptions.find((option) => option.id === selectedBedrooms)?.label || 'Bedrooms',
      onRemove: () => setSelectedBedrooms(''),
    },
    selectedFloors && {
      label: floorOptions.find((option) => option.id === selectedFloors)?.label || 'Floors',
      onRemove: () => setSelectedFloors(''),
    },
    activePreset === 'top-selling' && {
      label: 'Top selling',
      onRemove: () => setActivePreset('shop'),
    },
  ].filter(Boolean) as { label: string; onRemove: () => void }[];

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-teal-50/30 relative">
      {/* Header with browse label and controls */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4" ref={filterBarRef}>
          <div className="flex flex-wrap items-center gap-2 py-4 md:flex-nowrap">
            <button
              onClick={() => setShowSearch((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-sm font-semibold tracking-wide transition border ${
                showSearch
                  ? 'bg-[#0f4c45] text-white border-[#0f4c45]'
                  : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
              }`}
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search plans</span>
            </button>
            <button
              onClick={() => {
                clearFilters();
                setActivePreset('shop');
              }}
              className={presetButtonClass(
                activePreset === 'shop' && 
                !selectedStyle && 
                !selectedSize && 
                !selectedBudget && 
                !selectedBedrooms && 
                !selectedFloors
              )}
            >
              Show All
            </button>
            <button
              onClick={() => {
                setActivePreset(activePreset === 'top-selling' ? 'shop' : 'top-selling');
              }}
              className={presetButtonClass(activePreset === 'top-selling')}
            >
              Top Selling
            </button>

            <div className="relative">
              <button
                onClick={() => toggleDropdown('size')}
                className={dropdownButtonClass(!!selectedSize || openDropdown === 'size')}
              >
                By Size <ChevronDown className="w-4 h-4" />
              </button>
              {openDropdown === 'size' && (
                <div className="absolute left-0 md:left-auto right-0 mt-2 w-56 bg-white text-gray-800 rounded-md shadow-lg z-50">
                  <div className="grid grid-cols-1 gap-1 p-1">
                    {sizeOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedSize(option.id === selectedSize ? '' : option.id);
                          setOpenDropdown(null);
                          setActivePreset('shop');
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded ${
                          selectedSize === option.id ? 'bg-gray-100 font-medium' : ''
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => toggleDropdown('style')}
                className={dropdownButtonClass(!!selectedStyle || openDropdown === 'style')}
              >
                By Style <ChevronDown className="w-4 h-4" />
              </button>
              {openDropdown === 'style' && (
                <div className="absolute left-0 md:left-auto right-0 mt-2 w-64 bg-white text-gray-800 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-1 p-1">
                    {planCategories.map((entry) => (
                      <button
                        key={entry}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedStyle(selectedStyle === entry ? '' : entry);
                          setOpenDropdown(null);
                          setActivePreset('shop');
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded ${
                          selectedStyle === entry ? 'bg-gray-100 font-medium' : ''
                        }`}
                      >
                        {entry}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => toggleDropdown('budget')}
                className={dropdownButtonClass(!!selectedBudget || openDropdown === 'budget')}
              >
                By Budget <ChevronDown className="w-4 h-4" />
              </button>
              {openDropdown === 'budget' && (
                <div className="absolute left-0 md:left-auto right-0 mt-2 w-56 bg-white text-gray-800 rounded-md shadow-lg z-50">
                  <div className="grid grid-cols-1 gap-1 p-1">
                    {budgetOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedBudget(selectedBudget === option.id ? '' : option.id);
                          setOpenDropdown(null);
                          setActivePreset('shop');
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded ${
                          selectedBudget === option.id ? 'bg-gray-100 font-medium' : ''
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => toggleDropdown('bedrooms')}
                className={dropdownButtonClass(!!selectedBedrooms || openDropdown === 'bedrooms')}
              >
                By Bedrooms <ChevronDown className="w-4 h-4" />
              </button>
              {openDropdown === 'bedrooms' && (
                <div className="absolute left-0 md:left-auto right-0 mt-2 w-48 bg-white text-gray-800 rounded-md shadow-lg z-50">
                  <div className="grid grid-cols-1 gap-1 p-1">
                    {bedroomOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBedrooms(option.id === selectedBedrooms ? '' : option.id);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded ${
                          selectedBedrooms === option.id ? 'bg-gray-100 font-medium' : ''
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => toggleDropdown('floors')}
                className={dropdownButtonClass(!!selectedFloors || openDropdown === 'floors')}
              >
                By Floors <ChevronDown className="w-4 h-4" />
              </button>
              {openDropdown === 'floors' && (
                <div className="absolute left-0 md:left-auto right-0 mt-2 w-48 bg-white text-gray-800 rounded-md shadow-lg z-50">
                  <div className="grid grid-cols-1 gap-1 p-1">
                    {floorOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFloors(option.id === selectedFloors ? '' : option.id);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded ${
                          selectedFloors === option.id ? 'bg-gray-100 font-medium' : ''
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search + active filters */}
      {(showSearch || activeChips.length > 0 || search) && (
        <div className="bg-white/90 border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-4 space-y-3">
            {showSearch && (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search plan names, descriptions, or keywords"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-full py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            )}
            {(activeChips.length > 0 || search) && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {activeChips.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100"
                  >
                    {chip.label}
                    <button onClick={chip.onRemove} className="text-xs text-teal-600 hover:text-teal-900">
                      ×
                    </button>
                  </span>
                ))}
                {search && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                    “{search}”
                    <button onClick={() => setSearch('')} className="text-xs text-gray-500 hover:text-gray-800">
                      ×
                    </button>
                  </span>
                )}
                <button onClick={clearFilters} className="text-xs uppercase tracking-wide text-gray-500 hover:text-gray-800">
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {plans.map((plan) => (
                <Link
                  key={plan.id}
                  to={`/plans/${plan.id}`}
                  className="card hover:shadow-lg transition-all duration-300 border border-gray-100 rounded-lg overflow-hidden"
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                    <img
                      src={(plan.image_url ? `${apiBaseUrl}${plan.image_url}` : '/placeholder.jpg')}
                      alt={plan.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
