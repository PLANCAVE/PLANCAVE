import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  BarChart2, Users, Package, DollarSign, 
  Settings, LogOut, X, User 
} from 'lucide-react';

interface DashboardSidebarProps {
  isMobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
}

interface SidebarLinkProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  active: boolean;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ icon, label, href, active }) => (
  <Link 
    href={href}
    className={`flex items-center py-3 px-4 w-full ${
      active ? 'bg-indigo-800 text-white' : 'text-indigo-300 hover:bg-indigo-800 hover:text-white'
    }`}
  >
    <span className="mr-3">{icon}</span>
    <span>{label}</span>
  </Link>
);

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ 
  isMobileMenuOpen, 
  onCloseMobileMenu 
}) => {
  const router = useRouter();
  const currentPath = router.pathname;

  return (
    <div className={`bg-indigo-900 text-white w-64 min-h-screen fixed transition-all ${
      isMobileMenuOpen ? 'left-0' : '-left-64 lg:left-0'
    } lg:translate-x-0 z-40`}>
      <div className="flex items-center justify-between p-4 border-b border-indigo-800">
        <div className="logo">
          <Link href="/">
            <img src="/Logo2.svg" alt="Logo" />
          </Link>
        </div>
        <button 
          className="lg:hidden text-white" 
          onClick={onCloseMobileMenu}
        >
          <X size={24} />
        </button>
      </div>
      
      <div className="py-4">
        <div className="px-4 mb-6">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center mr-3">
              <User size={20} />
            </div>
            <div>
              <div className="font-medium">Admin User</div>
              <div className="text-sm text-indigo-300">admin@example.com</div>
            </div>
          </div>
        </div>
        
        <nav>
          <SidebarLink 
            icon={<BarChart2 size={18} />} 
            label="Overview" 
            href="/admin/dashboard"
            active={currentPath === '/admin/dashboard'} 
          />
          <SidebarLink 
            icon={<Users size={18} />} 
            label="Users" 
            href="/admin/users"
            active={currentPath === '/admin/users'} 
          />
          <SidebarLink 
            icon={<Package size={18} />} 
            label="Products" 
            href="/admin/products"
            active={currentPath === '/admin/products'} 
          />
          <SidebarLink 
            icon={<DollarSign size={18} />} 
            label="Revenue" 
            href="/admin/revenue"
            active={currentPath === '/admin/revenue'} 
          />
          <SidebarLink 
            icon={<BarChart2 size={18} />} 
            label="Analytics" 
            href="/admin/analytics"
            active={currentPath === '/admin/analytics'} 
          />
          <SidebarLink 
            icon={<Settings size={18} />} 
            label="Settings" 
            href="/admin/settings"
            active={currentPath === '/admin/settings'} 
          />
        </nav>
        
        <div className="px-4 mt-8 pt-4 border-t border-indigo-800">
          <button className="flex items-center text-indigo-300 hover:text-white">
            <LogOut size={18} className="mr-2" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardSidebar; 