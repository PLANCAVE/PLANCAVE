import { useState } from 'react';
import { Heart, ArrowRight, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCustomerData } from '../contexts/CustomerDataContext';
import { useAuth } from '../contexts/AuthContext';

export default function Favorites() {
  const { isAuthenticated } = useAuth();
  const { favorites, loadingFavorites, removeFavorite } = useCustomerData();
  const [busyId, setBusyId] = useState<string | null>(null);

  const resolveMediaUrl = (path?: string) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) {
      try {
        const url = new URL(path);
        return url.pathname.replace(/^\/api(?=\/)/, '');
      } catch {
        return path;
      }
    }
    if (path.startsWith('/api/')) return path.replace(/^\/api/, '');
    return path.startsWith('/') ? path : `/${path}`;
  };

  const handleRemove = async (planId: string) => {
    setBusyId(planId);
    try {
      await removeFavorite(planId);
    } finally {
      setBusyId(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f2a2a] via-[#1e4a4a] to-[#2C5F5F] flex items-center justify-center px-6 py-16 text-white text-center">
        <div className="max-w-xl space-y-6">
          <Heart className="w-12 h-12 mx-auto text-white/70" />
          <h1 className="text-3xl font-serif tracking-[0.3em]">Sign in to view favorites</h1>
          <p className="text-white/70">
            Create an account or sign in to save plans across devices and access them from your shortlist.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login" className="btn-primary text-sm tracking-wide">
              Sign In
            </Link>
            <Link to="/register" className="btn-secondary text-sm tracking-wide border-white/40 text-white">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadingFavorites) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f2a2a] via-[#1e4a4a] to-[#2C5F5F]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f2a2a] via-[#1e4a4a] to-[#2C5F5F] flex flex-col items-center justify-center px-6 py-16 text-white text-center">
        <div className="max-w-2xl space-y-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border border-white/30 bg-white/5 mx-auto">
            <Heart className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-3">
            <p className="tracking-[0.5em] text-xs text-white/60">FAVORITES</p>
            <h1 className="text-3xl md:text-4xl font-serif tracking-[0.3em]">Nothing saved yet</h1>
            <p className="text-white/70 leading-relaxed">
              Save the plans you love to access them quickly across all your devices. Browse our curated catalog and tap
              the heart icon to build your personal shortlist.
            </p>
          </div>
          <Link
            to="/plans"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/30 text-white/90 tracking-[0.2em] uppercase text-xs hover:bg-white/10 transition"
          >
            Browse Plans <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2a2a] via-[#1e4a4a] to-[#2C5F5F] px-6 py-16 text-white">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="flex flex-col gap-4">
          <p className="tracking-[0.6em] text-xs text-white/60">FAVORITES</p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <h1 className="text-3xl md:text-4xl font-serif tracking-[0.2em]">Your saved plans</h1>
            <Link
              to="/plans"
              className="inline-flex items-center gap-2 text-xs tracking-[0.3em] uppercase border border-white/30 px-4 py-2 rounded-full hover:bg-white/10"
            >
              Browse more plans <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <p className="text-white/70 text-sm">{favorites.length} plan{favorites.length === 1 ? '' : 's'} saved</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {favorites.map((plan) => (
            <div key={plan.id} className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-4 md:p-6 flex gap-4">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden flex-shrink-0 bg-white/10 border border-white/10">
                <img
                  src={plan.image_url ? resolveMediaUrl(plan.image_url) : '/vite.svg'}
                  alt={plan.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col flex-1 gap-3">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/50">{plan.category || plan.project_type}</p>
                    <h2 className="text-xl font-semibold text-white mt-1">{plan.name}</h2>
                  </div>
                  <button
                    onClick={() => handleRemove(plan.id)}
                    disabled={busyId === plan.id}
                    className="p-2 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/60 transition"
                    aria-label="Remove from favorites"
                  >
                    {busyId === plan.id ? (
                      <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-sm text-white/70 line-clamp-2">{plan.description}</p>
                <div className="flex flex-wrap gap-2 text-xs text-white/80">
                  {plan.area && <span>{plan.area} m²</span>}
                  {plan.bedrooms && <span>{plan.bedrooms} Bedrooms</span>}
                  {plan.bathrooms && <span>{plan.bathrooms} Baths</span>}
                  {plan.package_level && <span className="uppercase tracking-wide">{plan.package_level}</span>}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div>
                    <p className="text-xs text-white/60">Price</p>
                    <p className="text-lg font-semibold">$ {Number(plan.price || 0).toLocaleString()}</p>
                  </div>
                  <Link
                    to={`/plans/${plan.id}`}
                    className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] border border-white/30 px-4 py-2 rounded-full hover:bg-white/10"
                  >
                    View details <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
