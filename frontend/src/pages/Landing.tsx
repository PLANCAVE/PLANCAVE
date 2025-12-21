import { Link, useNavigate } from 'react-router-dom';
import { Building2, TrendingUp, CheckCircle, ArrowLeft, ArrowRight, Mail, Phone, MapPin, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useRef, useMemo } from 'react';
import { browsePlans, getTrendingPlans } from '../api';

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
  total_views?: number;
  certifications?: string[];
  created_at: string;
}

const PlanShowcase = ({ title, subtitle, plans, cta, ctaLink, badge, metric }: PlanShowcaseProps) => {
  if (!plans.length) return null;

  const resolveMediaUrl = (path?: string) => {
    if (!path) return '';
    // If it's a full URL (like from Cloudinary), use it directly.
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    // For local paths, ensure it's a root-relative path.
    const cleanedPath = path.replace(/^\/api(?=\/)/, '');
    return cleanedPath.startsWith('/') ? cleanedPath : `/${cleanedPath}`;
  };

  return (
    <section className="relative py-16 border-t border-white/5 bg-gradient-to-b from-slate-900/20 to-transparent">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-3">{title}</h3>
            <p className="text-lg text-gray-300 max-w-2xl">{subtitle}</p>
          </div>
          {cta && (
            <Link
              to={ctaLink || '/plans'}
              className="flex items-center gap-2 text-sm uppercase tracking-[0.3em] text-white/70 hover:text-white transition"
            >
              {cta}
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.id} className="group relative rounded-2xl overflow-hidden bg-gradient-to-b from-slate-800/50 to-slate-900/80 border border-white/5 hover:border-white/20 transition-all hover:shadow-xl hover:shadow-purple-500/10">
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={plan.image_url ? resolveMediaUrl(plan.image_url) : '/vite.svg'}
                  alt={plan.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                
                <div className="absolute top-4 left-4 flex gap-2">
                  {badge && (Number((plan as any).sales_count || 0) > 0) && (
                    <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md">
                      {badge}
                    </span>
                  )}
                  <span className="text-xs px-3 py-1 rounded-full bg-black/50 backdrop-blur text-white border border-white/10">
                    {plan.package_level}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-xl font-bold text-white line-clamp-1">{plan.name}</h4>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400">
                    {(() => {
                      const kind = metric?.kind || 'sales';
                      const value =
                        kind === 'views'
                          ? Number((plan as any).total_views || (plan as any).views_count || 0)
                          : Number((plan as any).sales_count || 0);
                      const label = metric?.label || (kind === 'views' ? 'views' : 'sold');
                      return `${value} ${label}`;
                    })()}
                  </span>
                </div>
                
                <p className="text-sm text-gray-300 line-clamp-2 mb-4">{plan.description}</p>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-400">From</p>
                    <p className="text-2xl font-bold text-white">$ {Number(plan.price).toLocaleString()}</p>
                  </div>
                  <Link 
                    to={`/plans/${plan.id}`}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition border border-white/10"
                  >
                    <ArrowRight className="w-4 h-4 text-white" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

interface PlanShowcaseProps {
  title: string;
  subtitle: string;
  plans: Plan[];
  cta: string;
  ctaLink?: string;
  badge?: string;
  metric?: {
    kind: 'sales' | 'views';
    label: string;
  };
}


export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [featuredPlans, setFeaturedPlans] = useState<Plan[]>([]);
  const [topSellingPlans, setTopSellingPlans] = useState<Plan[]>([]);
  const [trendingPlans, setTrendingPlans] = useState<Plan[]>([]);
  const [isLoadingFeaturedPlans, setIsLoadingFeaturedPlans] = useState(true);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [hasCompletedInitialHeroLoad, setHasCompletedInitialHeroLoad] = useState(false);
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
  const [isHoveringCarousel, setIsHoveringCarousel] = useState(false);
  const [isManualPause, setIsManualPause] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const manualPauseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadFeaturedPlans = async () => {
      try {
        const response = await browsePlans();
        const results: Plan[] = response.data.results || [];
        const curated = results.slice(0, 24);
        setFeaturedPlans(curated);
        setCurrentPlanIndex(curated.length ? Math.floor(Math.random() * curated.length) : 0);
      } catch (error) {
        console.error('Failed to load featured plans:', error);
      } finally {
        setIsLoadingFeaturedPlans(false);
      }
    };

    loadFeaturedPlans();
  }, []);

  useEffect(() => {
    const loadTopSellingPlans = async () => {
      try {
        const response = await browsePlans({ sort_by: 'sales_count', order: 'desc', limit: 4, offset: 0 });
        const results: Plan[] = response.data.results || [];
        setTopSellingPlans(results);
      } catch (error) {
        console.error('Failed to load top selling plans:', error);
      }
    };

    loadTopSellingPlans();
  }, []);

  useEffect(() => {
    const loadTrendingPlans = async () => {
      try {
        const resp = await getTrendingPlans(4);
        const plans: Plan[] = resp.data?.plans || [];
        setTrendingPlans(plans);
      } catch (error) {
        // Fallback: keep empty so we use local heuristic in useMemo below.
        setTrendingPlans([]);
      }
    };

    loadTrendingPlans();
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

  const resolveMediaUrl = (path?: string) => {
    if (!path) return '';
    // If it's a full URL (like from Cloudinary), use it directly.
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    // For local paths, ensure it's a root-relative path.
    const cleanedPath = path.replace(/^\/api(?=\/)/, '');
    return cleanedPath.startsWith('/') ? cleanedPath : `/${cleanedPath}`;
  };
  const currentPlan = featuredPlans[currentPlanIndex];

  useEffect(() => {
    setHeroImageLoaded(false);
  }, [currentPlanIndex]);

  const { budgetPlans, newPlans, popularCategoryPlans } = useMemo(() => {
    const shuffle = (plans: Plan[]) => {
      const copy = [...plans];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const randomized = shuffle(featuredPlans);
    const chunk = (start: number, end: number) => randomized.slice(start, end);

    // Build popular categories based on existing data
    const groupByType = randomized.reduce((acc: Record<string, Plan[]>, p) => {
      const key = (p.project_type || '').trim();
      if (!key) return acc;
      acc[key] = acc[key] || [];
      acc[key].push(p);
      return acc;
    }, {});

    // Sort categories by availability (desc) then name
    const sortedTypes = Object.keys(groupByType).sort((a, b) => {
      const diff = (groupByType[b]?.length || 0) - (groupByType[a]?.length || 0);
      return diff !== 0 ? diff : a.localeCompare(b);
    });

    // Prefer server-computed trending plans (based on 30d views) when available.
    const popular = trendingPlans.length ? trendingPlans.slice(0, 4) : (() => {
      const topType = sortedTypes[0];
      return topType ? (groupByType[topType] || []).slice(0, 4) : randomized.slice(12, 16);
    })();

    const cheapestPlans = [...featuredPlans]
      .filter((p) => p && p.price != null)
      .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
      .slice(0, 4);

    return {
      budgetPlans: cheapestPlans,
      newPlans: chunk(8, 12),
      popularCategoryPlans: popular,
    };
  }, [featuredPlans, trendingPlans]);

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

  useEffect(() => {
    if (!featuredPlans.length) return;
    setHeroImageLoaded(false);
  }, [currentPlanIndex, featuredPlans.length]);

  // Loader should only appear on the initial hero load.
  useEffect(() => {
    if (hasCompletedInitialHeroLoad) return;
    if (isLoadingFeaturedPlans || !featuredPlans.length) return;

    setShowLoader(true);
    const timer = setTimeout(() => {
      setShowLoader(false);
      setHasCompletedInitialHeroLoad(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [hasCompletedInitialHeroLoad, isLoadingFeaturedPlans, featuredPlans.length]);

  const shouldGateHero = !hasCompletedInitialHeroLoad;
  const isHeroReady =
    !isLoadingFeaturedPlans &&
    Boolean(currentPlan) &&
    (!shouldGateHero || heroImageLoaded || !showLoader);

  // Simplified: if we have data and aren't on first load, show immediately
  const shouldShowHero = !isLoadingFeaturedPlans && Boolean(currentPlan) && (hasCompletedInitialHeroLoad || heroImageLoaded || !showLoader);

  const heroImageSrc = currentPlan?.image_url ? resolveMediaUrl(currentPlan.image_url) : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a] overflow-x-hidden">
      {/* Hero Section with 3D Elements */}
      <div className="relative overflow-hidden h-[92vh]">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        {/* Floating 3D Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute top-40 right-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-float-delayed"></div>
          <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-teal-600/20 rounded-full blur-3xl animate-float-slow"></div>
        </div>
        <div className="relative w-full h-full px-0 pb-0">
          {shouldGateHero && !isHeroReady && showLoader ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f2a2a]">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
            </div>
          ) : null}

          {/* Mobile hero (image fits, details below) */}
          <div
            className={`md:hidden px-4 pb-4 transition-opacity ${shouldShowHero ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <div className="max-w-6xl mx-auto">
              <div
                className="relative w-full aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-black cursor-pointer"
                onClick={handlePlanOpen}
              >
                {heroImageSrc ? (
                  <img
                    src={heroImageSrc}
                    className="w-full h-full object-contain"
                    alt="Featured plan"
                    onLoad={() => {
                      setHeroImageLoaded(true);
                      if (!hasCompletedInitialHeroLoad) {
                        setShowLoader(false);
                        setHasCompletedInitialHeroLoad(true);
                      }
                    }}
                  />
                ) : null}
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-white/80 pointer-events-none z-20">
                  <h1 className="text-3xl font-serif tracking-[0.55em] text-white drop-shadow-2xl">RAMANICAVE</h1>
                </div>
              </div>

              <div className="mt-4 bg-black/60 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 text-white">
                <div className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.4em] text-white/70">
                  <span>{currentPlan?.project_type}</span>
                  {currentPlan?.category && <span className="text-white/60">• {currentPlan.category}</span>}
                </div>
                <h3 className="mt-2 text-xl font-semibold tracking-[0.2em] text-white">{currentPlan?.name}</h3>
                <p className="mt-2 text-sm text-white/90 line-clamp-3">{currentPlan?.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[0.55rem] uppercase tracking-[0.35em] text-white/90">
                  <span className="px-3 py-1.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
                    $ {currentPlan ? Number(currentPlan.price).toLocaleString() : ''}
                  </span>
                  <span className={`px-3 py-1.5 rounded-full border border-white/30 backdrop-blur-sm ${currentPlan ? getPackageBadgeColor(currentPlan.package_level) : ''}`}>
                    {currentPlan?.package_level?.toUpperCase()}
                  </span>
                </div>
                <button
                  className="mt-4 w-full inline-flex items-center justify-center gap-3 px-5 py-3 rounded-full border border-white/30 bg-white/20 backdrop-blur-md text-[0.6rem] uppercase tracking-[0.4em] text-white hover:bg-white/30 shadow-xl transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlanOpen();
                  }}
                >
                  View Details
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevPlan();
                  }}
                  className="text-white/70 hover:text-white transition"
                  aria-label="Previous plan"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextPlan();
                  }}
                  className="text-white/70 hover:text-white transition"
                  aria-label="Next plan"
                >
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Desktop hero (overlay) */}
          <div
            className={`hidden md:block relative w-screen h-full overflow-hidden cursor-pointer transition-opacity ${shouldShowHero ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={handlePlanOpen}
            onMouseEnter={() => setIsHoveringCarousel(true)}
            onMouseLeave={() => setIsHoveringCarousel(false)}
            onTouchStart={() => setIsHoveringCarousel(true)}
            onTouchEnd={() => setIsHoveringCarousel(false)}
            onTouchCancel={() => setIsHoveringCarousel(false)}
          >
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center text-white/80 pointer-events-none z-20">
              <h1 className="text-3xl md:text-4xl font-serif tracking-[0.55em] text-white drop-shadow-2xl">
                RAMANICAVE
              </h1>
            </div>

            <div className="absolute inset-0 w-full h-full">
              {heroImageSrc ? (
                <img
                  src={heroImageSrc}
                  className="w-full h-full object-cover object-center"
                  alt="Featured plan"
                  onLoad={() => {
                    setHeroImageLoaded(true);
                    if (!hasCompletedInitialHeroLoad) {
                      setShowLoader(false);
                      setHasCompletedInitialHeroLoad(true);
                    }
                  }}
                />
              ) : null}
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
                    <span className="px-3 py-1.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
                      $ {currentPlan ? Number(currentPlan.price).toLocaleString() : ''}
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
                  <div className="flex items-center gap-4 bg-black/5 backdrop-blur-[1px] rounded-full border border-white/30 px-4 py-2 text-[0.6rem] uppercase tracking-[0.35em] text-white/90">
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

          </div>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="relative py-16 border-t border-white/10 bg-gradient-to-b from-transparent to-slate-900/30">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '1000+', label: 'Design Plans', gradient: 'from-purple-400 via-pink-400 to-rose-400' },
            { value: '500+', label: 'Designers', gradient: 'from-blue-400 via-cyan-400 to-teal-400' },
            { value: '5000+', label: 'Happy Customers', gradient: 'from-emerald-400 via-green-400 to-lime-400' },
            { value: '24/7', label: 'Support', gradient: 'from-amber-400 via-orange-400 to-yellow-400' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className={`text-5xl md:text-6xl font-black bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent drop-shadow-2xl`}>{stat.value}</div>
              <p className="mt-3 text-gray-300 tracking-[0.3em] text-xs uppercase">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Collections - redesigned order and logic */}
      <PlanShowcase title="This month’s new releases" subtitle="Fresh arrivals published this month by our designers." plans={newPlans} cta="See new arrivals" ctaLink="/plans?quick=new" />
      <PlanShowcase
        title="Top-selling plans"
        subtitle="Proven choices customers keep choosing."
        plans={topSellingPlans}
        cta="Shop bestsellers"
        ctaLink="/plans?quick=top"
        badge="Best Seller"
        metric={{ kind: 'sales', label: 'sold' }}
      />
      <PlanShowcase title="Best value plans" subtitle="Quality designs at accessible prices." plans={budgetPlans} cta="Browse best value" ctaLink="/plans?quick=budget" />
      <PlanShowcase
        title="Trending categories"
        subtitle="Explore the plan types customers are viewing right now."
        plans={popularCategoryPlans}
        cta="Browse all categories"
        ctaLink="/plans"
        metric={{ kind: 'views', label: 'views' }}
      />

      {/* Replace 'Browse by Size' with intent-based quick picks */}
      <section className="py-16 bg-gradient-to-b from-slate-900/20 to-transparent">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-white mb-8">Quick picks</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Starter homes', filter: 'area<120', gradient: 'from-blue-500 to-cyan-500' },
              { label: '3+ bedrooms', filter: 'bedrooms>=3', gradient: 'from-teal-500 to-emerald-500' },
              { label: 'Modern villas', filter: 'category=villa', gradient: 'from-purple-500 to-pink-500' },
              { label: 'Duplex & Townhouses', filter: 'project_type=duplex', gradient: 'from-amber-500 to-orange-500' },
            ].map((q) => (
              <Link
                key={q.label}
                to={`/plans?quick=${encodeURIComponent(q.filter)}`}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
              >
                <div className={`h-1 bg-gradient-to-r ${q.gradient}`}></div>
                <div className="p-6 flex items-center justify-between">
                  <span className="text-white font-semibold">{q.label}</span>
                  <ArrowRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose - moved below showcases */}
      <div className="relative py-24 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px w-20 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
              <span className="text-sm uppercase tracking-[0.3em] text-purple-400">Our Advantages</span>
              <div className="h-px w-20 bg-gradient-to-l from-transparent via-purple-500/50 to-transparent"></div>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Why Choose Ramanicave?
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              The premier architectural marketplace connecting visionary designers with dream home builders
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
                <h3 className="text-2xl font-bold text-white mb-3">Expert Designers</h3>
                <p className="text-gray-200">
                  Connect with vetted architects and designers who understand local climate, culture, and construction standards
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
                <h3 className="text-2xl font-bold text-white mb-3">Complete Design Freedom</h3>
                <p className="text-gray-200">
                  Designers maintain creative control, set competitive pricing, and build direct relationships with clients
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
                <h3 className="text-2xl font-bold text-white mb-3">Trusted Platform</h3>
                <p className="text-gray-200">
                  Secure transactions, verified reviews, and professional reputation building for long-term success
                </p>
              </div>
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
                Join thousands of architects, designers, and builders using Ramanicave
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
                  href="mailto:admin@ramanicave.com"
                  className="text-teal-300 hover:text-teal-200 transition-colors text-lg break-words"
                >
                  admin@ramanicave.com
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
