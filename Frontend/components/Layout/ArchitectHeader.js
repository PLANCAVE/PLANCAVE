"use client";
import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { 
  Bars3Icon, 
  BellIcon, 
  ChevronDownIcon,
  UserCircleIcon,
  CogIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

export default function ArchitectHeader({ title, isMobileMenuOpen, setIsMobileMenuOpen }) {
  const { data: session } = useSession();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [notifications] = useState(3); // Mock notification count
  const profileMenuRef = useRef(null);

  // Close profile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 lg:hidden"
            aria-label="Toggle sidebar"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          {/* Title */}
          <div>
            <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
              {title || 'Architect Dashboard'}
            </h1>
            <p className="text-sm text-gray-500 hidden sm:block">
              Welcome back, {session?.user?.name?.split(' ')[0] || 'Architect'}
            </p>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Notifications */}
          <div className="relative">
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full">
              <BellIcon className="h-6 w-6" />
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {notifications}
                </span>
              )}
            </button>
          </div>

          {/* Profile dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center space-x-2 p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {/* Profile image or initials */}
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {session?.user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </span>
              </div>
              
              {/* Name and role (hidden on mobile) */}
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-900">
                  {session?.user?.name || 'Architect'}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {session?.user?.role || 'architect'}
                </p>
              </div>
              
              <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${
                isProfileMenuOpen ? 'rotate-180' : ''
              }`} />
            </button>

            {/* Dropdown menu */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <div className="px-4 py-2 border-b border-gray-100 sm:hidden">
                  <p className="text-sm font-medium text-gray-900">
                    {session?.user?.name || 'Architect'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {session?.user?.email}
                  </p>
                </div>
                
                <button className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <UserCircleIcon className="h-4 w-4 mr-3" />
                  View Profile
                </button>
                
                <button className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <CogIcon className="h-4 w-4 mr-3" />
                  Settings
                </button>
                
                <hr className="my-1" />
                
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Breadcrumb or additional info bar (optional) */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 hidden lg:block">
        <div className="flex items-center text-sm text-gray-600">
          <span>Dashboard</span>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">{title || 'Overview'}</span>
        </div>
      </div>
    </header>
  );
}