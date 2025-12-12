import { Link } from 'react-router-dom';
import { Building2, TrendingUp, CheckCircle, ArrowRight, Mail, Phone, MapPin, PenTool, Hammer, Ruler, Calculator, Zap, Heart, ShoppingCart, FileText, Award } from 'lucide-react';
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
  const [featuredPlans, setFeaturedPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    const loadFeaturedPlans = async () => {
      try {
        const response = await browsePlans();
        const results: Plan[] = response.data.results || [];
        // Get first 6 plans as featured
        setFeaturedPlans(results.slice(0, 6));
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a]">
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

        <div className="relative max-w-7xl mx-auto px-4 py-24 md:py-32">
          <div className="text-center">
            {/* Elegant Logo/Heading */}
            <div className="mb-8">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="h-px w-24 md:w-32 bg-gradient-to-r from-transparent to-white"></div>
                <span className="text-lg md:text-xl font-light tracking-widest text-white">THE</span>
                <div className="h-px w-24 md:w-32 bg-gradient-to-l from-transparent to-white"></div>
              </div>
              <h1 className="text-6xl md:text-8xl font-serif font-light tracking-[0.2em] text-white mb-4">
                PLANCAVE
              </h1>
              <div className="flex items-center justify-center gap-8">
                <div className="h-px w-16 md:w-24 bg-white"></div>
                <div className="h-px w-16 md:w-24 bg-white"></div>
              </div>
            </div>

            <p className="text-2xl md:text-3xl text-teal-100 mb-8 max-w-3xl mx-auto font-light tracking-wide drop-shadow-lg">
              Discover premium architectural plans from Africa's top designers
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/plans"
                    className="group px-8 py-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl font-semibold text-lg hover:shadow-2xl hover:shadow-teal-500/50 transition-all duration-300 flex items-center gap-2"
                  >
                    Browse Plans
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    to="/dashboard"
                    className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-xl font-semibold text-lg hover:bg-white/20 transition-all duration-300 border border-white/20"
                  >
                    Go to Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="group px-8 py-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl font-semibold text-lg hover:shadow-2xl hover:shadow-teal-500/50 transition-all duration-300 flex items-center gap-2"
                  >
                    Get Started Free
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    to="/plans"
                    className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-xl font-semibold text-lg hover:bg-white/20 transition-all duration-300 border border-white/20"
                  >
                    Browse Plans
                  </Link>
                </>
              )}
            </div>

            {/* Trust Indicators */}
            <div className="mt-16 flex flex-wrap justify-center items-center gap-8 text-gray-400">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span>1000+ Plans</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span>Expert Designers</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span>Instant Download</span>
              </div>
            </div>
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

      {/* Premium Featured Plans Section */}
      <div className="relative py-32 bg-gradient-to-b from-slate-900/50 via-[#0f2a2a] to-[#0f2a2a] overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          {/* Section Header */}
          <div className="text-center mb-20">
            <div className="inline-block mb-4">
              <span className="px-4 py-2 bg-teal-500/20 text-teal-300 rounded-full text-sm font-semibold border border-teal-500/30">
                ✨ TOP RATED PLANS
              </span>
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 drop-shadow-2xl">
              Discover Premium Plans
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto font-light">
              Handpicked architectural designs from Africa's most talented designers. Ready to build, instantly downloadable.
            </p>
          </div>

          {loadingPlans ? (
            <div className="flex justify-center items-center py-32">
              <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-teal-600"></div>
            </div>
          ) : featuredPlans.length === 0 ? (
            <div className="text-center py-32">
              <Building2 className="w-20 h-20 text-gray-400 mx-auto mb-6" />
              <h3 className="text-3xl font-bold text-gray-300 mb-3">No plans available yet</h3>
              <p className="text-gray-400 text-lg">Check back soon for amazing architectural plans</p>
            </div>
          ) : (
            <>
              {/* Featured Plans Grid - Premium Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
                {featuredPlans.map((plan, index) => (
                  <Link
                    key={plan.id}
                    to={isAuthenticated ? `/plans/${plan.id}` : '/login'}
                    className={`group relative overflow-hidden rounded-3xl transition-all duration-500 transform hover:-translate-y-4 hover:shadow-2xl ${
                      index === 0 ? 'lg:col-span-1 lg:row-span-2' : ''
                    }`}
                  >
                    {/* Premium Glow Effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 via-pink-600/20 to-red-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
                    
                    {/* Card Container */}
                    <div className="relative h-full bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-2xl border border-white/20 rounded-3xl overflow-hidden hover:border-white/40 transition-all duration-500 shadow-2xl">
                      {/* Image Section */}
                      <div className={`relative overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 ${index === 0 ? 'h-96' : 'h-64'}`}>
                        <img
                          src={(plan.image_url ? `${apiBaseUrl}${plan.image_url}` : '/placeholder.jpg')}
                          alt={plan.name}
                          className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-700"
                        />
                        
                        {/* Premium Overlay Gradient */}
                        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent ${index === 0 ? 'from-black/95' : ''}`}></div>
                        
                        {/* Top Badges */}
                        <div className="absolute top-6 left-6 right-6 flex items-start justify-between gap-3">
                          <div className="flex gap-2 flex-wrap">
                            {plan.sales_count > 50 && (
                              <span className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                                ⭐ TOP RATED
                              </span>
                            )}
                            {plan.includes_boq && (
                              <span className="px-4 py-2 bg-green-500/90 text-white rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
                                <FileText className="w-3 h-3" />
                                BOQ INCLUDED
                              </span>
                            )}
                          </div>
                          <span className={`px-4 py-2 rounded-full text-xs font-bold shadow-lg ${getPackageBadgeColor(plan.package_level)}`}>
                            {plan.package_level?.toUpperCase()}
                          </span>
                        </div>

                        {/* Bottom Content Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-6">
                          <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight drop-shadow-lg">
                            {plan.name.trim()}
                          </h3>
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-gray-300 text-sm mb-1">Starting from</p>
                              <p className="text-4xl font-bold text-teal-300 drop-shadow-lg">
                                KSH {Number(plan.price).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Content Section */}
                      <div className="p-8 space-y-6">
                        {/* Description */}
                        <p className="text-gray-300 text-base leading-relaxed line-clamp-3">
                          {plan.description}
                        </p>

                        {/* Specs Grid - Premium */}
                        <div className="grid grid-cols-3 gap-4 py-6 border-y border-white/10">
                          <div className="text-center">
                            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Area</div>
                            <div className="text-2xl font-bold text-teal-300">{plan.area}</div>
                            <div className="text-xs text-gray-400">m²</div>
                          </div>
                          {plan.bedrooms && (
                            <div className="text-center">
                              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Bedrooms</div>
                              <div className="text-2xl font-bold text-cyan-300">{plan.bedrooms}</div>
                            </div>
                          )}
                          <div className="text-center">
                            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Floors</div>
                            <div className="text-2xl font-bold text-purple-300">{plan.floors}</div>
                          </div>
                        </div>

                        {/* Meta Tags */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-medium">
                            <Building2 className="w-4 h-4" />
                            {plan.project_type}
                          </span>
                          {plan.category && (
                            <span className="px-3 py-2 rounded-full bg-gray-500/20 text-gray-300 border border-gray-500/30 text-xs font-medium">
                              {plan.category}
                            </span>
                          )}
                        </div>

                        {/* Disciplines - Premium Display */}
                        <div className="flex flex-wrap gap-2">
                          {plan.disciplines_included?.architectural && (
                            <span className="px-3 py-2 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-semibold border border-blue-500/30">📐 Architecture</span>
                          )}
                          {plan.disciplines_included?.structural && (
                            <span className="px-3 py-2 bg-green-500/20 text-green-300 rounded-lg text-xs font-semibold border border-green-500/30">🏗️ Structural</span>
                          )}
                          {(plan.disciplines_included?.mep?.electrical || plan.disciplines_included?.mep?.plumbing || plan.disciplines_included?.mep?.mechanical) && (
                            <span className="px-3 py-2 bg-amber-500/20 text-amber-300 rounded-lg text-xs font-semibold border border-amber-500/30">⚡ MEP</span>
                          )}
                        </div>

                        {/* Footer Stats */}
                        <div className="flex items-center justify-between pt-4 border-t border-white/10">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-sm text-gray-400">
                              {plan.sales_count} customers
                            </span>
                          </div>
                          {isAuthenticated && (
                            <div className="flex gap-3">
                              <button 
                                onClick={(e) => {e.preventDefault();}}
                                className="p-2 hover:bg-red-500/20 rounded-full transition-all duration-300 hover:scale-110"
                              >
                                <Heart className="w-5 h-5 text-gray-400 hover:text-red-400" />
                              </button>
                              <button 
                                onClick={(e) => {e.preventDefault();}}
                                className="p-2 hover:bg-green-500/20 rounded-full transition-all duration-300 hover:scale-110"
                              >
                                <ShoppingCart className="w-5 h-5 text-gray-400 hover:text-green-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* CTA Button */}
              <div className="text-center">
                <Link
                  to="/plans"
                  className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 text-white rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-teal-500/50 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 group"
                >
                  Explore All Plans
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </Link>
              </div>
            </>
          )}
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
