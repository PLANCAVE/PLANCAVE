import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, 
  Search, 
  X, 
  Bell as BellIcon,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Info,
  Clock,
  ArrowRight,
  User,
  Settings,
  LogOut,
  HelpCircle
} from 'lucide-react';
import { gsap } from 'gsap';
import { useSession } from 'next-auth/react';

// NotificationDropdown as a separate component
const NotificationDropdown = ({ notifications = [], onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isVisible && dropdownRef.current) {
      const tl = gsap.timeline();
      tl.from(dropdownRef.current.querySelectorAll('.notification-item'), {
        x: 20,
        opacity: 0,
        duration: 0.3,
        stagger: 0.05,
        ease: 'power2.out'
      });
    }
  }, [isVisible]);

  const getNotificationIcon = (type) => {
    const iconProps = { size: 16, className: "flex-shrink-0" };
    
    switch (type) {
      case 'success':
        return <CheckCircle {...iconProps} className="text-green-500" />;
      case 'warning':
        return <AlertCircle {...iconProps} className="text-amber-500" />;
      case 'info':
        return <Info {...iconProps} className="text-blue-500" />;
      default:
        return <BellIcon {...iconProps} className="text-gray-500" />;
    }
  };

  const getNotificationColors = (type, unread) => {
    const baseClasses = unread 
      ? "bg-gradient-to-r border-l-4" 
      : "bg-white/50 border-l-4 border-l-transparent";
      
    switch (type) {
      case 'success':
        return unread 
          ? `${baseClasses} from-green-50/80 to-white border-l-green-400`
          : baseClasses;
      case 'warning':
        return unread 
          ? `${baseClasses} from-amber-50/80 to-white border-l-amber-400`
          : baseClasses;
      case 'info':
        return unread 
          ? `${baseClasses} from-blue-50/80 to-white border-l-blue-400`
          : baseClasses;
      default:
        return baseClasses;
    }
  };

  return (
    <div 
      ref={dropdownRef}
      className={`
        absolute right-0 mt-2 w-80 sm:w-96
        bg-white/95 backdrop-blur-xl
        rounded-2xl shadow-2xl border border-gray-200/50
        z-50 overflow-hidden
        transform transition-all duration-300 ease-out
        ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-2 opacity-0 scale-95'}
      `}
    >
      {/* Header with gradient */}
      <div className="relative p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-indigo-600/20" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
              <BellIcon size={16} className="text-white" />
            </div>
            <h3 className="font-semibold text-white text-lg">Notifications</h3>
          </div>
          {notifications.filter(n => n.unread).length > 0 && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-xs text-blue-200 font-medium">
                {notifications.filter(n => n.unread).length} new
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto custom-scrollbar">
        {notifications.length > 0 ? (
          <div className="p-2">
            {notifications.slice(0, 5).map((notification, idx) => (
              <div
                key={notification.id}
                className={`
                  notification-item
                  group relative p-4 mb-2 rounded-xl
                  ${getNotificationColors(notification.type, notification.unread)}
                  hover:shadow-md hover:scale-[1.01]
                  transition-all duration-200 ease-out
                  cursor-pointer
                `}
              >
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-gray-900 text-sm group-hover:text-gray-800 transition-colors">
                        {notification.title}
                      </h4>
                      {notification.unread && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 flex-shrink-0" />
                      )}
                    </div>
                    
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center mt-2 text-xs text-gray-400">
                      <Clock size={12} className="mr-1" />
                      {notification.timestamp}
                    </div>
                  </div>
                </div>

                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <ArrowRight size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 shadow-inner">
              <BellIcon size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm font-medium">No new notifications</p>
            <p className="text-gray-400 text-xs mt-1 text-center">
              You're all caught up! Check back later for updates.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50/80 backdrop-blur-sm border-t border-gray-200/50">
        <button 
          onClick={onClose}
          className="
            group w-full py-3 px-4 
            bg-gradient-to-r from-blue-600 to-indigo-600
            hover:from-blue-700 hover:to-indigo-700
            text-white font-medium text-sm rounded-xl
            transition-all duration-200 ease-out
            hover:shadow-lg hover:scale-[1.02]
            focus:outline-none focus:ring-2 focus:ring-blue-500/50
            flex items-center justify-center space-x-2
            shadow-md
          "
        >
          <span>View all notifications</span>
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
        </button>
      </div>
    </div>
  );
};

// UserDropdown component
const UserDropdown = ({ user, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isVisible && dropdownRef.current) {
      gsap.from(dropdownRef.current.querySelectorAll('.user-menu-item'), {
        y: 10,
        opacity: 0,
        duration: 0.2,
        stagger: 0.05,
        ease: 'power2.out'
      });
    }
  }, [isVisible]);

  return (
    <div 
      ref={dropdownRef}
      className={`
        absolute right-0 mt-2 w-56
        bg-white/95 backdrop-blur-xl
        rounded-xl shadow-xl border border-gray-200/50
        z-50 overflow-hidden
        transform transition-all duration-300 ease-out
        ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-2 opacity-0 scale-95'}
      `}
    >
      {/* User info section */}
      <div className="p-4 border-b border-gray-200/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md">
            {(user?.username || 'A').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{user?.username || 'Admin'}</p>
            <p className="text-xs text-gray-500">{user?.email || 'admin@example.com'}</p>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div className="py-1">
        <a href="#" className="user-menu-item block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center">
          <User size={16} className="mr-3 text-gray-500" />
          Your Profile
        </a>
        <a href="#" className="user-menu-item block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center">
          <Settings size={16} className="mr-3 text-gray-500" />
          Settings
        </a>
        <a href="#" className="user-menu-item block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center">
          <HelpCircle size={16} className="mr-3 text-gray-500" />
          Help & Support
        </a>
      </div>

      {/* Logout section */}
      <div className="py-1 border-t border-gray-200/50">
        <a href="#" className="user-menu-item block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center">
          <LogOut size={16} className="mr-3 text-gray-500" />
          Sign out
        </a>
      </div>
    </div>
  );
};

const DashboardHeader = ({ 
  activeTab = 'overview', 
  setIsMobileMenuOpen,
  notifications = []
}) => {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const notificationsRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      gsap.to(searchContainerRef.current, {
        duration: 0.3,
        scale: 0.98,
        y: 2,
        ease: 'power2.inOut',
        repeat: 1,
        yoyo: true
      });
      console.log('Searching for:', searchQuery);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') {
      setSearchQuery('');
      searchInputRef.current?.blur();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  const tabTitles = {
    overview: 'Dashboard Overview',
    users: 'User Management',
    products: 'Product Management',
    revenue: 'Revenue Analytics',
    analytics: 'Usage Analytics',
    settings: 'Dashboard Settings'
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 shadow-xl py-4 px-6 flex items-center justify-between">
      <div className="flex items-center">
        <button
          className="mr-4 text-slate-300 hover:text-white lg:hidden transition-colors duration-200 hover:bg-slate-800 p-2 rounded-lg"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-semibold text-white flex items-center">
          <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
            {tabTitles[activeTab] || 'Dashboard'}
          </span>
        </h1>
      </div>

      <div className="flex items-center space-x-4">
        {/* Enhanced Search Bar */}
        <div className="relative" ref={searchContainerRef}>
          {/* Desktop Search */}
          <div className="hidden md:block relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search users, products, analytics..."
              className={`
                px-4 py-2.5 pr-20 pl-10 
                bg-slate-800 border border-slate-700 rounded-xl 
                text-white placeholder-slate-400
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                hover:border-slate-600
                transition-all duration-200 
                w-64 lg:w-80
                ${isSearchFocused ? 'ring-2 ring-blue-500 border-blue-500 shadow-md' : ''}
              `}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
            
            <div className="absolute left-3 top-2.5 text-slate-400">
              <Search size={18} />
            </div>

            <div className="absolute right-2 top-1.5 flex items-center space-x-1">
              {searchQuery && (
                <button 
                  onClick={clearSearch}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors duration-200 hover:bg-slate-700/50"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
              <button 
                onClick={handleSearch}
                className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors duration-200 hover:bg-slate-700/50 rounded-lg"
                aria-label="Search"
              >
                <Search size={16} />
              </button>
            </div>
          </div>

          {/* Mobile Search Toggle */}
          <button 
            className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all duration-200"
            onClick={() => setIsSearchExpanded(!isSearchExpanded)}
            aria-label="Search"
          >
            <Search size={20} />
          </button>

          {/* Mobile search field */}
          {isSearchExpanded && (
            <div className="md:hidden absolute top-full left-0 right-0 mt-2 bg-slate-900 p-2 border border-slate-800 rounded-xl shadow-lg flex items-center z-10">
              <div className="absolute left-4 text-slate-400">
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="Search..."
                className="flex-1 px-4 py-2 pl-10 bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              {searchQuery && (
                <button 
                  className="mx-2 p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors duration-200"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
              <button 
                className="p-2 text-slate-400 hover:text-white"
                onClick={() => setIsSearchExpanded(false)}
                aria-label="Close search"
              >
                <X size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button 
            className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all duration-200"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            aria-label="Notifications"
          >
            <BellIcon size={20} />
            {notifications.filter(n => n.unread).length > 0 && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-slate-900"></span>
            )}
          </button>
          {showNotifications && (
            <NotificationDropdown 
              notifications={notifications} 
              onClose={() => setShowNotifications(false)} 
            />
          )}
        </div>

        {/* User Profile */}
        <div className="relative" ref={userMenuRef}>
          <button 
            className="flex items-center text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl px-3 py-2 transition-all duration-200 group"
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            aria-label="User profile"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center mr-2 shadow-lg">
              {(session?.user?.username || 'A').charAt(0).toUpperCase()}
            </div>
            <span className="hidden md:block font-medium">{session?.user?.username || 'Admin'}</span>
            <ChevronDown 
              size={16} 
              className={`ml-2 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} 
            />
          </button>
          {showUserMenu && <UserDropdown user={session?.user} onClose={() => setShowUserMenu(false)} />}
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;