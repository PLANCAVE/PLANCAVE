import React from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  DollarSign,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';

const DashboardSidebar = ({
  isCollapsed = false,
  setIsCollapsed = () => {},
  isMobileMenuOpen = false,
  setIsMobileMenuOpen = () => {},
  activeTab = 'overview',
  setActiveTab = () => {},
  handleLogout = () => console.log('Logout clicked'),
}) => {
  const menuItems = [
    {
      icon: LayoutDashboard,
      label: 'Overview',
      key: 'overview',
    },
    {
      icon: Users,
      label: 'User Management',
      key: 'users',
    },
    {
      icon: Package,
      label: 'All Projects',
      key: 'plans',
    },
    {
      icon: DollarSign,
      label: 'Revenue',
      key: 'revenue',
    },
    {
      icon: BarChart3,
      label: 'Analytics',
      key: 'analytics',
    },
    {
      icon: Settings,
      label: 'Settings',
      key: 'settings',
    },
  ];

  return (
    <>
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <div className={`
        fixed top-0 left-0 h-full bg-gradient-to-b from-blue-950 to-slate-900 text-white shadow-2xl z-50
        transition-all duration-300 ease-in-out border-r border-blue-900
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        ${isCollapsed ? 'lg:w-20' : 'lg:w-64'} 
        lg:translate-x-0 w-64
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-blue-800">
          {!isCollapsed && <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>}
          <button
            className="text-blue-300 hover:text-white"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-4 space-y-1 px-2">
          {menuItems.map(({ icon: Icon, label, key }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`group flex items-center w-full px-4 py-3 text-sm font-medium rounded-md transition-all
                ${activeTab === key
                  ? 'bg-blue-800 text-white'
                  : 'text-blue-200 hover:bg-blue-800 hover:text-white'}
              `}
            >
              <Icon className="w-5 h-5 mr-3" />
              {!isCollapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 w-full px-4 py-4 border-t border-blue-800">
          <button
            onClick={handleLogout}
            className="flex items-center w-full text-sm text-red-400 hover:text-red-600"
          >
            <LogOut className="w-5 h-5 mr-3" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>
    </>
  );
};

export default DashboardSidebar;
