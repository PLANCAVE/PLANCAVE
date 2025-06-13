"use client";
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  HomeIcon, 
  ShoppingBagIcon, 
  CreditCardIcon, 
  UserIcon, 
  Cog6ToothIcon,
  ChartBarIcon,
  HeartIcon,
  BellIcon,
  XMarkIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';

const CustomerSidebar = ({ isOpen, setIsOpen, userRole }) => {
  const router = useRouter();
  const pathname = usePathname();

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard/customer',
      icon: HomeIcon,
      access: ['customer', 'admin']
    },
    {
      name: 'My Purchases',
      href: '/dashboard/customer/purchases',
      icon: ShoppingBagIcon,
      access: ['customer', 'admin']
    },
    {
      name: 'Browse Plans',
      href: '/plans',
      icon: CreditCardIcon,
      access: ['customer', 'admin']
    },
    {
      name: 'Favorites',
      href: '/dashboard/customer/favorites',
      icon: HeartIcon,
      access: ['customer', 'admin']
    },
    {
      name: 'Usage Analytics',
      href: '/dashboard/customer/analytics',
      icon: ChartBarIcon,
      access: ['customer', 'admin']
    },
    {
      name: 'Notifications',
      href: '/dashboard/customer/notifications',
      icon: BellIcon,
      access: ['customer', 'admin']
    },
    {
      name: 'Profile',
      href: '/dashboard/customer/profile',
      icon: UserIcon,
      access: ['customer', 'admin']
    },
    {
      name: 'Settings',
      href: '/dashboard/customer/settings',
      icon: Cog6ToothIcon,
      access: ['customer', 'admin']
    }
  ];

  // Filter navigation items based on user role
  const filteredNavItems = navigationItems.filter(item => 
    item.access.includes(userRole)
  );

  const handleNavigation = (href) => {
    router.push(href);
    if (window.innerWidth < 768) {
      setIsOpen(false); // Close sidebar on mobile after navigation
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        md:block
      `}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Menu</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-2">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.name}>
                  <button
                    onClick={() => handleNavigation(item.href)}
                    className={`
                      w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200
                      ${isActive 
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                    {item.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section - User info or additional actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">Customer</p>
              <p className="text-xs text-gray-500 capitalize">{userRole} Account</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomerSidebar;