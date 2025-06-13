"use client";
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { 
  HomeIcon, 
  CubeIcon, 
  ChartBarIcon, 
  CurrencyDollarIcon, 
  CogIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function ArchitectSidebar({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen }) {
  const { data: session } = useSession();
  
  // Role-based access control
  const isArchitect = session?.user?.role === 'architect';
  const isAdmin = session?.user?.role === 'admin';
  const hasAccess = isArchitect || isAdmin;

  const navigationItems = [
    {
      id: 'overview',
      name: 'Overview',
      icon: HomeIcon,
      description: 'Dashboard overview'
    },
    {
      id: 'products',
      name: 'Product Management',
      icon: CubeIcon,
      description: 'Add and manage products',
      requiresAccess: true
    },
    {
      id: 'analysis',
      name: 'Analysis',
      icon: ChartBarIcon,
      description: 'Track product performance',
      requiresAccess: true
    },
    {
      id: 'earnings',
      name: 'My Earnings',
      icon: CurrencyDollarIcon,
      description: 'View earnings and payouts'
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: CogIcon,
      description: 'Account settings'
    }
  ];

  const handleTabClick = (tabId, requiresAccess) => {
    if (requiresAccess && !hasAccess) {
      alert('Access denied. Only architects and admins can access this feature.');
      return;
    }
    setActiveTab(tabId);
    setIsMobileMenuOpen(false); // Close mobile menu when tab is selected
  };

  return (
    <>
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0 lg:z-auto
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile Close Button */}
        <div className="flex items-center justify-between p-4 border-b lg:hidden">
          <h2 className="text-lg font-semibold text-gray-800">Menu</h2>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* User Info Section */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {session?.user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session?.user?.name || 'Architect'}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {session?.user?.role || 'architect'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isDisabled = item.requiresAccess && !hasAccess;
            
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id, item.requiresAccess)}
                disabled={isDisabled}
                className={`
                  w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200
                  ${isActive 
                    ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700' 
                    : isDisabled
                      ? 'text-gray-400 cursor-not-allowed hover:bg-gray-50'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
                title={isDisabled ? 'Access restricted to architects and admins' : item.description}
              >
                <Icon className={`
                  h-5 w-5 mr-3 flex-shrink-0
                  ${isActive ? 'text-blue-700' : isDisabled ? 'text-gray-400' : 'text-gray-500'}
                `} />
                <span className="truncate">{item.name}</span>
                {isDisabled && (
                  <div className="ml-auto">
                    <div className="h-2 w-2 bg-red-400 rounded-full"></div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Role Badge */}
        <div className="p-4 border-t border-gray-200">
          <div className={`
            px-3 py-2 rounded-lg text-center text-xs font-medium
            ${hasAccess 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-600'
            }
          `}>
            {hasAccess ? '✓ Full Access' : 'Limited Access'}
          </div>
        </div>
      </div>
    </>
  );
}