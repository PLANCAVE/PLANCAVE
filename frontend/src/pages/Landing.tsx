import { Link, useNavigate } from 'react-router-dom';
import { Building2, TrendingUp, CheckCircle, ArrowLeft, ArrowRight, Mail, Phone, MapPin, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { browsePlans } from '../api';

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

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [featuredPlans, setFeaturedPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0);

  useEffect(() => {
    const loadFeaturedPlans = async () => {
      try {
        const response = await browsePlans();
        const results: Plan[] = response.data.results || [];
        // Get first 6 plans as featured
        setFeaturedPlans(results.slice(0, 6));
        setCurrentPlanIndex(0);
      } catch (error) {
        console.error('Failed to load featured plans:', error);
      } finally {
        setLoadingPlans(false);
      }
    };

    loadFeaturedPlans();
  }, []);

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
  const currentPlan = featuredPlans[currentPlanIndex];

  const handlePrevPlan = () => {
    if (!featuredPlans.length) return;
    setCurrentPlanIndex((prev) => (prev - 1 + featuredPlans.length) % featuredPlans.length);
  };

  const handleNextPlan = () => {
    if (!featuredPlans.length) return;
    setCurrentPlanIndex((prev) => (prev + 1) % featuredPlans.length);
  };

  const handlePlanOpen = () => {
    if (!currentPlan) return;
    if (isAuthenticated) {
      navigate(`/plans/${currentPlan.id}`);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a]">
      {/* Header Logo Strip */}
      <header className="relative z-10 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-3 text-white/70 text-[0.55rem] tracking-[0.7em]">
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-white/30 to-white/80"></div>
            <span>THE</span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent via-white/30 to-white/80"></div>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif tracking-[0.45em] text-white">PLANCAVE</h1>
          <div className="flex items-center justify-center gap-5 opacity-60">
            <div className="h-px w-14 bg-white"></div>
            <div className="h-px w-10 bg-white"></div>
            <div className="h-px w-14 bg-white"></div>
          </div>
        </div>
      </header>

      {/* Hero Section with 3D Elements */}
      <div className="relative overflow-hidden">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        
        {/* Floating 3D Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute top-40 right-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-float-delayed"></div>
          <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-teal-600/20 rounded-full blur-3xl animate-float-slow"></div>
        </div>
        {/* Full-bleed hero carousel */}
        <div className="relative w-screen left-1/2 -translate-x-1/2 px-0 pb-20">
          <div
            className="relative h-[34rem] w-full overflow-hidden cursor-pointer"
            onClick={handlePlanOpen}
          >
            <div className="absolute -inset-10 opacity-40 bg-gradient-to-br from-teal-300/20 via-white/10 to-transparent blur-3xl pointer-events-none"></div>
            {loadingPlans ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
              </div>
            ) : featuredPlans.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/80">
                <Building2 className="w-12 h-12 mb-4" />
                <p>No featured plans yet</p>
              </div>
            ) : (
              <>
                <div className="absolute inset-0">
                  <img
                    src={currentPlan?.image_url ? `${apiBaseUrl}${currentPlan.image_url}` : '/placeholder.jpg'}
                    alt={currentPlan?.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"></div>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 text-white">
                  <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between">
                    <div className="w-full max-w-3xl bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 px-5 py-4">
                      <div className="flex items-center gap-3 text-[0.55rem] uppercase tracking-[0.45em] text-white/70">
                        <span>{currentPlan?.project_type}</span>
                        {currentPlan?.category && <span className="text-white/50">• {currentPlan.category}</span>}
                      </div>
                      <h3 className="mt-3 text-2xl md:text-3xl font-semibold tracking-[0.3em] text-white">
                        {currentPlan?.name}
                      </h3>
                      <p className="mt-2 text-sm text-white/85 line-clamp-2">
                        {currentPlan?.description}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-[0.55rem] uppercase tracking-[0.4em] text-white/70">
                        <span className="px-3 py-1 rounded-full bg-white/15 border border-white/25">
                          KSH {currentPlan ? Number(currentPlan.price).toLocaleString() : ''}
                        </span>
                        <span className={`px-3 py-1 rounded-full border border-white/25 ${currentPlan ? getPackageBadgeColor(currentPlan.package_level) : ''}`}>
                          {currentPlan?.package_level?.toUpperCase()}
                        </span>
                        {currentPlan?.area && (
                          <span className="px-3 py-1 rounded-full bg-white/15 border border-white/25">
                            {currentPlan.area} m²
                          </span>
                        )}
                        {typeof currentPlan?.bedrooms === 'number' && (
                          <span className="px-3 py-1 rounded-full bg-white/15 border border-white/25">
                            {currentPlan.bedrooms} Beds
                          </span>
                        )}
                        {typeof currentPlan?.floors === 'number' && (
                          <span className="px-3 py-1 rounded-full bg-white/15 border border-white/25">
                            {currentPlan.floors} Floors
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full lg:w-auto">
                      <div className="flex flex-wrap gap-3 bg-black/35 backdrop-blur-md rounded-2xl border border-white/10 px-5 py-3 text-center text-[0.55rem] uppercase tracking-[0.35em] text-white/70">
                        <div className="flex-1 min-w-[90px]">
                          <p className="text-xs text-white/60">AREA</p>
                          <p className="text-2xl font-light text-white">{currentPlan?.area ?? '—'}</p>
                        </div>
                        <div className="flex-1 min-w-[90px]">
                          <p className="text-xs text-white/60">BEDS</p>
                          <p className="text-2xl font-light text-white">{currentPlan?.bedrooms ?? '—'}</p>
                        </div>
                        <div className="flex-1 min-w-[90px]">
                          <p className="text-xs text-white/60">FLOORS</p>
                          <p className="text-2xl font-light text-white">{currentPlan?.floors ?? '—'}</p>
                        </div>
                      </div>
                      <button
                        className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-white text-[#0b1a1a] font-semibold text-[0.6rem] uppercase tracking-[0.45em]"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlanOpen();
                        }}
                      >
                        View Details
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevPlan();
                  }}
                  className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition"
                  aria-label="Previous plan"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextPlan();
                  }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition"
                  aria-label="Next plan"
                >
                  <ArrowRight className="w-6 h-6" />
                </button>

                <div className="absolute bottom-5 inset-x-0 flex justify-center gap-2">
                  {featuredPlans.map((plan, idx) => (
                    <button
                      key={plan.id}
                      aria-label={`Go to plan ${plan.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPlanIndex(idx);
                      }}
                      className={`h-1 w-10 rounded-full transition-all ${idx === currentPlanIndex ? 'bg-white' : 'bg-white/30'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3D Architectural Cards Section */}
      <div className="relative py-24 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Why Choose The Plancave?
            </h2>
            <p className="text-xl text-gray-400">
              The ultimate marketplace for architects and designers to showcase and sell their ready-to-build plans
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature Card 1 */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 rounded-2xl blur-2xl opacity-30 group-hover:opacity-60 transition-opacity duration-500"></div>
              <div className="relative bg-white/10 backdrop-blur-2xl border border-white/30 rounded-2xl p-8 hover:bg-white/15 transition-all duration-500 transform hover:-translate-y-4 hover:scale-105 cursor-pointer">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 group-hover:scale-110 transition-all duration-500 shadow-2xl">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Discover Top Designers</h3>
                <p className="text-gray-200">
                  Browse curated portfolios and ready plans from vetted African architects and building designers
                </p>
              </div>
            </div>

            {/* Feature Card 2 */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 rounded-2xl blur-2xl opacity-30 group-hover:opacity-60 transition-opacity duration-500"></div>
              <div className="relative bg-white/10 backdrop-blur-2xl border border-white/30 rounded-2xl p-8 hover:bg-white/15 transition-all duration-500 transform hover:-translate-y-4 hover:scale-105 cursor-pointer">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 group-hover:scale-110 transition-all duration-500 shadow-2xl">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Flexible Opportunities</h3>
                <p className="text-gray-200">
                  Designers publish plans independently, set their pricing, and connect with homeowners, developers, and contractors
                </p>
              </div>
            </div>

            {/* Feature Card 3 */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-green-600 to-lime-600 rounded-2xl blur-2xl opacity-30 group-hover:opacity-60 transition-opacity duration-500"></div>
              <div className="relative bg-white/10 backdrop-blur-2xl border border-white/30 rounded-2xl p-8 hover:bg-white/15 transition-all duration-500 transform hover:-translate-y-4 hover:scale-105 cursor-pointer">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 via-green-500 to-lime-500 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 group-hover:scale-110 transition-all duration-500 shadow-2xl">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Built Like Upwork</h3>
                <p className="text-gray-200">
                  A vertical marketplace for architectural talent – clients discover plans while designers build reputation and recurring income
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="relative py-24 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center group cursor-pointer">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity animate-pulse"></div>
                <div className="relative text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent drop-shadow-2xl">
                  1000+
                </div>
              </div>
              <div className="text-gray-300 text-lg font-medium">Design Plans</div>
            </div>
            <div className="text-center group cursor-pointer">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity animate-pulse"></div>
                <div className="relative text-6xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent drop-shadow-2xl">
                  500+
                </div>
              </div>
              <div className="text-gray-300 text-lg font-medium">Designers</div>
            </div>
            <div className="text-center group cursor-pointer">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity animate-pulse"></div>
                <div className="relative text-6xl font-bold bg-gradient-to-r from-emerald-400 via-green-400 to-lime-400 bg-clip-text text-transparent drop-shadow-2xl">
                  5000+
                </div>
              </div>
              <div className="text-gray-300 text-lg font-medium">Happy Customers</div>
            </div>
            <div className="text-center group cursor-pointer">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity animate-pulse"></div>
                <div className="relative text-6xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent drop-shadow-2xl">
                  24/7
                </div>
              </div>
              <div className="text-gray-300 text-lg font-medium">Support</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 via-red-600 via-orange-600 to-yellow-600 rounded-3xl blur-3xl opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-pulse"></div>
            <div className="relative bg-white/10 backdrop-blur-2xl border-2 border-white/30 rounded-3xl p-12 transform group-hover:scale-105 transition-all duration-500">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
              </div>
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 mt-8 drop-shadow-2xl">
                Ready to Start Building?
              </h2>
              <p className="text-xl md:text-2xl text-gray-100 mb-10 font-light">
                Join thousands of architects, designers, and builders using The Plancave
              </p>
              {!isAuthenticated && (
                <Link
                  to="/register"
                  className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white rounded-2xl font-bold text-xl hover:shadow-2xl hover:shadow-pink-500/50 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1"
                >
                  Get Started Now
                  <ArrowRight className="w-6 h-6" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div id="contact" className="relative py-20 border-t border-teal-500/20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30"></div>
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-2xl">
              Get In Touch
            </h2>
            <p className="text-xl text-gray-200 max-w-2xl mx-auto">
              Have questions? We're here to help you find the perfect construction plans
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Email */}
            <div className="group">
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 hover:bg-white/20 transition-all duration-300 hover:shadow-2xl hover:shadow-teal-500/30 transform hover:-translate-y-2">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                  <Mail className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Email Us</h3>
                <a 
                  href="mailto:admin@plancave.com"
                  className="text-teal-300 hover:text-teal-200 transition-colors text-lg break-words"
                >
                  admin@plancave.com
                </a>
              </div>
            </div>

            {/* Phone */}
            <div className="group">
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 hover:bg-white/20 transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/30 transform hover:-translate-y-2">
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                  <Phone className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Call Us</h3>
                <a 
                  href="tel:+254741076621"
                  className="text-cyan-300 hover:text-cyan-200 transition-colors text-lg"
                >
                  +254 741 076 621
                </a>
              </div>
            </div>

            {/* Address */}
            <div className="group">
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 hover:bg-white/20 transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/30 transform hover:-translate-y-2">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                  <MapPin className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Visit Us</h3>
                <p className="text-green-300 text-lg">
                  Karen Watermark<br />
                  Business Center
                </p>
              </div>
            </div>
          </div>

          {/* Business Hours */}
          <div className="text-center mt-12">
            <p className="text-gray-300 text-lg mb-2">
              We're here to help Monday - Friday, 8AM - 6PM EAT
            </p>
            <p className="text-teal-400 text-sm">
              Reach out anytime - we typically respond within 24 hours
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
