import React from 'react';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import { useRouter } from 'next/router';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex">
      <DashboardSidebar 
        isMobileMenuOpen={isMobileMenuOpen} 
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)} 
      />
      <div className="flex-1 lg:ml-64">
        <DashboardHeader 
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)} 
        />
        <main className="p-6 bg-gray-50 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout; 