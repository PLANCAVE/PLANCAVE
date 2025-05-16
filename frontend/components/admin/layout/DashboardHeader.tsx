import React from 'react';
import { Menu, Search, Bell, ChevronDown, User } from 'lucide-react';

interface DashboardHeaderProps {
  onOpenMobileMenu: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ onOpenMobileMenu }) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  return (
    <header className="bg-white shadow-sm py-4 px-6 flex items-center justify-between">
      <div className="flex items-center">
        <button 
          className="mr-4 text-gray-700 lg:hidden" 
          onClick={onOpenMobileMenu}
        >
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-semibold text-gray-800">
          Dashboard
        </h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search..." 
            className="px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
        </div>
        
        <button className="relative p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-full">
          <Bell size={20} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        
        <div className="relative">
          <button className="flex items-center text-gray-700">
            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center mr-2">
              <User size={16} />
            </div>
            <span className="hidden md:block">Admin</span>
            <ChevronDown size={16} className="ml-1" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader; 