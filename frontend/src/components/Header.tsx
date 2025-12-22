import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Heart, LayoutDashboard, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import api, { getMyProfile } from '../api';
import { useEffect, useState } from 'react';

const resolveAvatarUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = (api.defaults.baseURL || '').replace(/\/+$/, '');
  return `${base}${url}`;
};

export default function Header() {
  const { isAuthenticated, user, refreshUserProfile, token } = useAuth() as any;
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const canSeePurchases = isAuthenticated && (user?.role === 'designer' || user?.role === 'customer');

  const getInitials = () => {
    if (!user) return '';
    const nameParts: string[] = [];
    if (user.first_name) nameParts.push(user.first_name);
    if (user.last_name) nameParts.push(user.last_name);

    let base = nameParts.join(' ').trim();
    if (!base && user.email) {
      base = user.email.split('@')[0] || user.email;
    }

    const parts = base.split(' ').filter(Boolean);
    const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
    return initials || (user.email ? user.email[0].toUpperCase() : '');
  };

  useEffect(() => {
    const loadProfileForHeader = async () => {
      if (!isAuthenticated || !token || profileLoaded) return;
      try {
        const res = await getMyProfile();
        const data = res.data || {};
        const resolvedAvatar = resolveAvatarUrl(data.profile_picture_url);
        const nextProfile = {
          first_name: data.first_name,
          middle_name: data.middle_name,
          last_name: data.last_name,
          profile_picture_url: resolvedAvatar,
        } as const;

        const hasChanges =
          !user ||
          user.first_name !== nextProfile.first_name ||
          user.middle_name !== nextProfile.middle_name ||
          user.last_name !== nextProfile.last_name ||
          user.profile_picture_url !== nextProfile.profile_picture_url;

        if (hasChanges) {
          refreshUserProfile(nextProfile);
        }
        setProfileLoaded(true);
      } catch {
        // Keep header resilient: if /me fails, fall back to whatever is in JWT.
        setProfileLoaded(true);
      }
    };

    loadProfileForHeader();
  }, [isAuthenticated, token, refreshUserProfile, profileLoaded, user]);

  useEffect(() => {
    if (!isAuthenticated) {
      setProfileLoaded(false);
      setAvatarError(false);
    }
  }, [isAuthenticated]);

  const avatarSrc = user?.profile_picture_url ? resolveAvatarUrl(user.profile_picture_url) : '';

  useEffect(() => {
    setAvatarError(false);
  }, [avatarSrc]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="group flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 shadow-sm" />
            <div className="leading-tight">
              <div className="text-[13px] sm:text-sm font-semibold tracking-[0.22em] text-slate-900">RAMANICAVE</div>
              <div className="text-[11px] text-slate-600 hidden sm:block">House Plans & Custom Designs</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-3">
            <Link
              to="/plans"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-900 text-xs font-semibold tracking-wider hover:bg-slate-50 transition-all"
            >
              Browse More Plans
            </Link>

            <Link
              to="/custom-plan"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-xs font-semibold tracking-wider hover:from-teal-700 hover:to-cyan-700 transition-all"
            >
              Request Custom Plan
            </Link>

            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 text-slate-700">
                  <button
                    type="button"
                    className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all"
                    onClick={() => navigate('/plans')}
                    aria-label="Search plans"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all"
                    onClick={() => navigate('/favorites')}
                    aria-label="Saved plans"
                  >
                    <Heart className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all"
                    onClick={() => navigate('/cart')}
                    aria-label="Cart"
                  >
                    <ShoppingBag className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-1 ml-3">
                  <Link
                    to="/dashboard"
                    className="px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>

                  {canSeePurchases ? (
                    <Link
                      to="/purchases"
                      className="px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                    >
                      <span>Purchases</span>
                    </Link>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-all ml-auto overflow-hidden"
                >
                  {avatarSrc && !avatarError ? (
                    <img
                      src={avatarSrc}
                      alt={user.email}
                      className="block h-full w-full object-cover object-center"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-teal-500/20 text-teal-100 text-sm font-semibold tracking-wide">
                      {getInitials()}
                    </span>
                  )}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-slate-700">
                <button
                  type="button"
                  className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all"
                  onClick={() => navigate('/plans')}
                  aria-label="Search plans"
                >
                  <Search className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all"
                  onClick={() => navigate('/favorites')}
                  aria-label="Saved plans"
                >
                  <Heart className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all"
                  onClick={() => navigate('/cart')}
                  aria-label="Cart"
                >
                  <ShoppingBag className="w-5 h-5" />
                </button>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all"
                >
                  Sign In
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-slate-900"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200">
            <nav className="flex flex-col gap-4">
              <Link
                to="/plans"
                className="text-slate-700 hover:text-slate-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Explore Plans
              </Link>
              <Link
                to="/custom-plan"
                className="text-slate-700 hover:text-slate-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Request a Custom Plan
              </Link>
              <div className="flex items-center gap-3 text-slate-700">
                <button
                  type="button"
                  className="p-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-all text-slate-700"
                  onClick={() => {
                    navigate('/favorites');
                    setMobileMenuOpen(false);
                  }}
                  aria-label="Saved plans"
                >
                  <Heart className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-all text-slate-700"
                  onClick={() => {
                    navigate('/plans');
                    setMobileMenuOpen(false);
                  }}
                  aria-label="Search plans"
                >
                  <Search className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-all text-slate-700"
                  onClick={() => {
                    navigate(isAuthenticated ? '/profile' : '/login');
                    setMobileMenuOpen(false);
                  }}
                  aria-label={isAuthenticated ? 'Profile' : 'Account'}
                >
                  <UserRound className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-all text-slate-700"
                  onClick={() => {
                    navigate('/cart');
                    setMobileMenuOpen(false);
                  }}
                  aria-label="Cart"
                >
                  <ShoppingBag className="w-5 h-5" />
                </button>
              </div>
              {isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className="text-slate-700 hover:text-slate-900"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>

                  {canSeePurchases ? (
                    <Link
                      to="/purchases"
                      className="text-slate-700 hover:text-slate-900"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Purchases
                    </Link>
                  ) : null}
                  <div className="pt-4 border-t border-slate-200">
                    <button
                      onClick={() => {
                        navigate('/profile');
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center text-white text-xs font-semibold overflow-hidden">
                        {user?.profile_picture_url ? (
                          <img
                            src={resolveAvatarUrl(user.profile_picture_url)}
                            alt={user.email}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{getInitials()}</span>
                        )}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="font-semibold line-clamp-1 max-w-[160px] text-slate-900">{user?.email}</span>
                        <span className="text-xs text-slate-500">{user?.role}</span>
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="bg-slate-900 hover:bg-slate-800 text-white py-2 px-4 rounded-lg transition-all text-center font-semibold"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In / Sign Up
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
