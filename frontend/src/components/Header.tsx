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
    <header className="bg-gradient-to-r from-[#284d4d] via-[#1b3a3a] to-[#102222] border-b border-teal-500/30 sticky top-0 z-50 backdrop-blur-xl shadow-[0_20px_45px_-25px_rgba(0,0,0,0.75)]">
      <div className="absolute inset-0 bg-gradient-to-r from-teal-500/15 via-transparent to-cyan-500/15 backdrop-blur-[2px]"></div>
      <div className="max-w-7xl mx-auto px-4 relative">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="group text-white hover:text-teal-200 transition-all">
            <div className="flex flex-col items-start leading-tight">
              <span className="mt-1 text-[1.45rem] font-serif tracking-[0.42em] drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]">RAMANICAVE</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            <Link
              to="/plans"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-white/20 text-white/90 tracking-[0.2em] uppercase text-xs hover:bg-white/10 hover:text-white hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-200"
            >
              Browse More Plans
            </Link>

            {isAuthenticated ? (
              <Link
                to="/custom-plan"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 text-white tracking-[0.18em] uppercase text-xs font-semibold hover:from-teal-700 hover:to-cyan-700 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-200 shadow-lg shadow-cyan-900/20 hover:shadow-cyan-900/35"
              >
                Custom Plan
              </Link>
            ) : null}

            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 text-white/80">
                  <button
                    type="button"
                    className="p-2 rounded-lg border border-white/15 bg-white/5 text-teal-200 hover:bg-white/10 hover:border-teal-200/70 hover:text-teal-100 hover:-translate-y-0.5 hover:scale-[1.03] active:translate-y-0 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-teal-500/20"
                    onClick={() => navigate('/plans')}
                    aria-label="Search plans"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg border border-white/15 bg-white/5 text-rose-200 hover:bg-white/10 hover:border-rose-200/70 hover:text-rose-100 hover:-translate-y-0.5 hover:scale-[1.03] active:translate-y-0 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-rose-500/20"
                    onClick={() => navigate('/favorites')}
                    aria-label="Saved plans"
                  >
                    <Heart className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg border border-white/15 bg-white/5 text-amber-200 hover:bg-white/10 hover:border-amber-200/70 hover:text-amber-100 hover:-translate-y-0.5 hover:scale-[1.03] active:translate-y-0 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-amber-500/20"
                    onClick={() => navigate('/cart')}
                    aria-label="Cart"
                  >
                    <ShoppingBag className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-1 ml-4">
                  <Link
                    to="/dashboard"
                    className="px-3 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 hover:-translate-y-0.5 active:translate-y-0 rounded-lg transition-all duration-200 flex items-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>

                  {canSeePurchases ? (
                    <Link
                      to="/purchases"
                      className="px-3 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 hover:-translate-y-0.5 active:translate-y-0 rounded-lg transition-all duration-200"
                    >
                      <span>Purchases</span>
                    </Link>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-teal-300/60 bg-white/5 hover:bg-white/15 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-900/30 active:translate-y-0 transition-all duration-200 ml-auto overflow-hidden"
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
              <div className="flex items-center gap-2 text-white/80">
                <button
                  type="button"
                  className="p-2 rounded-lg border border-white/15 bg-white/5 text-teal-200 hover:bg-white/10 hover:border-teal-200/70 hover:text-teal-100 hover:-translate-y-0.5 hover:scale-[1.03] active:translate-y-0 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-teal-500/20"
                  onClick={() => navigate('/plans')}
                  aria-label="Search plans"
                >
                  <Search className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-lg border border-white/15 bg-white/5 text-rose-200 hover:bg-white/10 hover:border-rose-200/70 hover:text-rose-100 hover:-translate-y-0.5 hover:scale-[1.03] active:translate-y-0 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-rose-500/20"
                  onClick={() => navigate('/favorites')}
                  aria-label="Saved plans"
                >
                  <Heart className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-lg border border-white/15 bg-white/5 text-amber-200 hover:bg-white/10 hover:border-amber-200/70 hover:text-amber-100 hover:-translate-y-0.5 hover:scale-[1.03] active:translate-y-0 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-amber-500/20"
                  onClick={() => navigate('/cart')}
                  aria-label="Cart"
                >
                  <ShoppingBag className="w-5 h-5" />
                </button>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 hover:-translate-y-0.5 active:translate-y-0 rounded-lg transition-all duration-200 border border-white/20 hover:border-teal-200/50"
                >
                  Sign In
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white"
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
          <div className="md:hidden py-4 border-t border-teal-500/20">
            <nav className="flex flex-col gap-4">
              <Link
                to="/plans"
                className="text-gray-300 hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                Explore Plans
              </Link>
              {isAuthenticated ? (
                <Link
                  to="/custom-plan"
                  className="text-gray-300 hover:text-white"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Custom Plan
                </Link>
              ) : null}
              <div className="flex items-center gap-3 text-white/80">
                <button
                  type="button"
                  className="p-2 rounded-full border border-white/15 bg-white/5 text-rose-200 hover:bg-white/10 hover:border-rose-200/70 hover:text-rose-100 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
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
                  className="p-2 rounded-full border border-white/15 bg-white/5 text-teal-200 hover:bg-white/10 hover:border-teal-200/70 hover:text-teal-100 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
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
                  className="p-2 rounded-full border border-white/15 bg-white/5 text-cyan-200 hover:bg-white/10 hover:border-cyan-200/70 hover:text-cyan-100 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
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
                  className="p-2 rounded-full border border-white/15 bg-white/5 text-amber-200 hover:bg-white/10 hover:border-amber-200/70 hover:text-amber-100 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
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
                    className="text-gray-300 hover:text-white"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>

                  {canSeePurchases ? (
                    <Link
                      to="/purchases"
                      className="text-gray-300 hover:text-white"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Purchases
                    </Link>
                  ) : null}
                  <div className="pt-4 border-t border-teal-500/20">
                    <button
                      onClick={() => {
                        navigate('/profile');
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-2 text-sm text-gray-200"
                    >
                      <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-semibold overflow-hidden ring-2 ring-teal-300/60">
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
                        <span className="font-medium line-clamp-1 max-w-[160px]">{user?.email}</span>
                        <span className="text-xs text-teal-300">{user?.role}</span>
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded-lg transition-all border border-white/20 text-center"
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
