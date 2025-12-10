import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building2, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-gradient-to-r from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a] border-b border-teal-500/30 sticky top-0 z-50 backdrop-blur-xl shadow-2xl shadow-black/30">
      <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 backdrop-blur-sm"></div>
      <div className="max-w-7xl mx-auto px-4 relative">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 font-serif font-light text-xl tracking-wider text-white group hover:text-teal-300 transition-all">
            <div className="w-11 h-11 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center group-hover:shadow-2xl group-hover:shadow-teal-400/80 group-hover:scale-110 transition-all duration-300 ring-2 ring-white/20">
              <Building2 className="w-6 h-6 text-white drop-shadow-lg" />
            </div>
            <span className="drop-shadow-lg text-2xl font-medium">The Plancave</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/plans" className="text-gray-200 hover:text-white transition-all font-medium hover:scale-105 px-3 py-2 rounded-lg hover:bg-white/10">
              Browse Plans
            </Link>
            
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="text-gray-200 hover:text-white transition-all font-medium hover:scale-105 px-4 py-2.5 rounded-xl hover:bg-white/10 backdrop-blur-sm flex items-center gap-2 group">
                  <LayoutDashboard className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  Dashboard
                </Link>
                
                <div className="flex items-center gap-4 ml-4 pl-4 border-l border-teal-400/40">
                  <button
                    type="button"
                    onClick={() => navigate('/profile')}
                    className="hidden lg:flex items-center gap-3 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <div className="relative w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-semibold overflow-hidden ring-2 ring-white/30">
                      {user?.profile_picture_url ? (
                        <img
                          src={user.profile_picture_url}
                          alt={user.email}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{getInitials()}</span>
                      )}
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400 ring-1 ring-white" />
                    </div>
                    <div className="flex flex-col items-start text-left">
                      <span className="text-sm font-medium text-gray-200 line-clamp-1 max-w-[160px]">
                        {user?.email}
                      </span>
                      <span className="px-2 py-0.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
                        {user?.role}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="group relative bg-gradient-to-r from-red-500/20 to-orange-500/20 hover:from-red-500 hover:to-orange-500 text-white py-2.5 px-5 rounded-xl transition-all border border-red-500/30 hover:border-red-400 flex items-center gap-2 hover:shadow-xl hover:shadow-red-500/30 hover:scale-105 font-medium"
                  >
                    <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="relative group bg-white/5 hover:bg-white/10 backdrop-blur-sm text-white py-2.5 px-6 rounded-xl transition-all border border-white/20 hover:border-white/40 font-medium hover:scale-105 hover:shadow-xl hover:shadow-white/10">
                  <span className="relative z-10">Sign In</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-500/0 to-cyan-500/0 group-hover:from-teal-500/10 group-hover:to-cyan-500/10 rounded-xl transition-all"></div>
                </Link>
                <Link to="/register" className="relative group bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white py-2.5 px-6 rounded-xl font-bold hover:shadow-2xl hover:shadow-teal-500/60 transition-all hover:scale-110 ring-2 ring-teal-400/50 hover:ring-teal-300">
                  <span className="relative z-10">Sign Up</span>
                  <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl"></div>
                </Link>
              </>
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
                Browse Plans
              </Link>
              
              {isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className="text-gray-300 hover:text-white"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <div className="pt-4 border-t border-teal-500/20">
                    <button
                      onClick={() => {
                        navigate('/profile');
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-2 mb-3 text-sm text-gray-200"
                    >
                      <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-semibold overflow-hidden ring-2 ring-teal-300/60">
                        {user?.profile_picture_url ? (
                          <img
                            src={user.profile_picture_url}
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
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded-lg transition-all border border-white/20 w-full"
                    >
                      Logout
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
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white py-2 px-4 rounded-lg hover:shadow-lg hover:shadow-teal-500/50 transition-all text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign Up
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
