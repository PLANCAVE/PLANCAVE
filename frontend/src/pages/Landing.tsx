import { Link, useNavigate } from 'react-router-dom';
import { Building2, TrendingUp, CheckCircle, ArrowLeft, ArrowRight, Mail, Phone, MapPin, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
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
  const [isHoveringCarousel, setIsHoveringCarousel] = useState(false);
  const [isManualPause, setIsManualPause] = useState(false);
  const manualPauseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadFeaturedPlans = async () => {
      try {
        const response = await browsePlans();
        const results: Plan[] = response.data.results || [];
        // Get first 6 plans as featured
        const curated = results.slice(0, 6);
        setFeaturedPlans(curated);
        setCurrentPlanIndex(curated.length ? Math.floor(Math.random() * curated.length) : 0);
      } catch (error) {
        console.error('Failed to load featured plans:', error);
      } finally {
        setLoadingPlans(false);
      }
    };

    loadFeaturedPlans();
  }, []);

  useEffect(() => {
    return () => {
      if (manualPauseTimeout.current) {
        clearTimeout(manualPauseTimeout.current);
      }
    };
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

  const triggerManualPause = () => {
    setIsManualPause(true);
    if (manualPauseTimeout.current) {
      clearTimeout(manualPauseTimeout.current);
    }
    manualPauseTimeout.current = setTimeout(() => setIsManualPause(false), 6000);
  };

  const handlePrevPlan = () => {
    if (!featuredPlans.length) return;
    triggerManualPause();
    setCurrentPlanIndex((prev) => (prev - 1 + featuredPlans.length) % featuredPlans.length);
  };

  const handleNextPlan = () => {
    if (!featuredPlans.length) return;
    triggerManualPause();
    setCurrentPlanIndex((prev) => (prev + 1) % featuredPlans.length);
  };

  useEffect(() => {
    if (!featuredPlans.length || isHoveringCarousel || isManualPause) return;
    const autoplay = setInterval(() => {
      setCurrentPlanIndex((prev) => (prev + 1) % featuredPlans.length);
    }, 7000);
    return () => clearInterval(autoplay);
  }, [featuredPlans, isHoveringCarousel, isManualPause]);

  const handlePlanOpen = () => {
    if (!currentPlan) return;
    navigate(`/plans/${currentPlan.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a]">
      {/* Hero Section with 3D Elements */}
      <div className="relative overflow-hidden min-h-[100vh]">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        {/* Floating 3D Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute top-40 right-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-float-delayed"></div>
          <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-teal-600/20 rounded-full blur-3xl animate-float-slow"></div>
        </div>
        {/* Full-bleed hero carousel */}
        <div className="relative w-screen left-1/2 -translate-x-1/2 px-0 pb-0">
          <div
            className="relative w-full min-h-[420px] max-h-[900px] h-[min(90vh,900px)] sm:h-[min(95vh,950px)] lg:h-[calc(100vh-5rem)] overflow-hidden cursor-pointer"
            onClick={handlePlanOpen}
            onMouseEnter={() => setIsHoveringCarousel(true)}
            onMouseLeave={() => setIsHoveringCarousel(false)}
            onTouchStart={() => setIsHoveringCarousel(true)}
            onTouchEnd={() => setIsHoveringCarousel(false)}
            onTouchCancel={() => setIsHoveringCarousel(false)}
          >
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center text-white/80 space-y-3 pointer-events-none z-20">
              <div className="flex items-center gap-3 justify-center text-[0.6rem] tracking-[0.8em] text-white/70">
                <div className="h-px w-20 bg-gradient-to-r from-transparent via-white/30 to-white/70"></div>
                <span>THE</span>
                <div className="h-px w-20 bg-gradient-to-l from-transparent via-white/30 to-white/70"></div>
              </div>
              <h1 className="text-3xl md:text-4xl font-serif tracking-[0.55em] text-white drop-shadow-2xl">
                PLANCAVE
              </h1>
              <div className="flex items-center justify-center gap-6 text-[0.5rem] tracking-[0.45em] text-white/60">
                <div className="h-px w-12 bg-white/60"></div>
                <div className="h-px w-12 bg-white/60"></div>
              </div>
            </div>
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
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={currentPlan?.image_url ? `${apiBaseUrl}${currentPlan.image_url}` : '/placeholder.jpg'}
                    className="absolute inset-0 w-full h-full object-cover object-top sm:object-center"
                    alt="Featured plan"
                  />
                  <div className="absolute inset-0 bg-black/25" />
                </div>

                <div className="absolute inset-x-0 bottom-0 px-4 pb-6 text-white z-10">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between max-w-6xl mx-auto">
                    <div className="flex flex-col gap-2 bg-black/5 backdrop-blur-[1px] rounded-2xl border border-white/5 px-3 py-2 max-w-2xl">
                      <div className="flex items-center gap-2 text-[0.55rem] uppercase tracking-[0.4em] text-white/70">
                        <span>{currentPlan?.project_type}</span>
                        {currentPlan?.category && <span className="text-white/60">• {currentPlan.category}</span>}
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="text-xl md:text-2xl font-semibold tracking-[0.25em] text-white drop-shadow-lg">
                          {currentPlan?.name}
                        </h3>
                        <p className="text-sm md:text-base text-white/90 line-clamp-2 drop-shadow">
                          {currentPlan?.description}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[0.5rem] uppercase tracking-[0.35em] text-white/90">
                        <span className="px-3 py-1.5 rounded-full bg-white/20 border border-white/30 backdrop-blur-sm">
                          KSH {currentPlan ? Number(currentPlan.price).toLocaleString() : ''}
                        </span>
                        <span className={`px-3 py-1.5 rounded-full border border-white/30 backdrop-blur-sm ${currentPlan ? getPackageBadgeColor(currentPlan.package_level) : ''}`}>
                          {currentPlan?.package_level?.toUpperCase()}
                        </span>
                        {currentPlan?.area && (
                          <span className="px-3 py-1.5 rounded-full bg-white/20 border border-white/30 backdrop-blur-sm">
                            {currentPlan.area} m²
                          </span>
                        )}
                        {typeof currentPlan?.bedrooms === 'number' && (
                          <span className="px-3 py-1.5 rounded-full bg-white/20 border border-white/30 backdrop-blur-sm">
                            {currentPlan.bedrooms} Beds
                          </span>
                        )}
                        {typeof currentPlan?.floors === 'number' && (
                          <span className="px-3 py-1.5 rounded-full bg-white/20 border border-white/30 backdrop-blur-sm">
                            {currentPlan.floors} Floors
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-4 bg-black/5 backdrop-blur-[1px] rounded-full border border-white/5 px-4 py-2 text-[0.6rem] uppercase tracking-[0.35em] text-white/90">
                        <span className="text-white text-lg font-light drop-shadow">{currentPlan?.area ?? '—'} m²</span>
                        <span className="text-white text-lg font-light drop-shadow">{currentPlan?.bedrooms ?? '—'} beds</span>
                        <span className="text-white text-lg font-light drop-shadow">{currentPlan?.floors ?? '—'} floors</span>
                      </div>
                      <button
                        className="inline-flex items-center justify-center gap-3 px-5 py-3 rounded-full border border-white/30 bg-white/20 backdrop-blur-md text-[0.6rem] uppercase tracking-[0.4em] text-white hover:bg-white/30 shadow-xl transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlanOpen();
                        }}
                      >
                        View Details
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevPlan();
                  }}
                  className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition z-10"
                  aria-label="Previous plan"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextPlan();
                  }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition z-10"
                  aria-label="Next plan"
                >
                  <ArrowRight className="w-6 h-6" />
                </button>

                <div className="absolute bottom-5 inset-x-0 flex justify-center gap-2 z-10">
                  {featuredPlans.map((plan, idx) => (
                    <button
                      key={plan.id}
                      type="button"
                      aria-label={`Go to plan ${plan.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerManualPause();
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
