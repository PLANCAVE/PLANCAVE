

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import NewProductForm from '../pages/admin/products/new';
import { gsap } from 'gsap';
import Link from 'next/link';
import { toast } from 'react-toastify';
import {
  BarChart, Bar, XAxis, YAxis, LineChart, Line, Area, CartesianGrid,BarChart3, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Users, ShoppingBag, DollarSign,Mail,Calendar,  UserPlus, PenTool, Shield, BarChart2, Activity,Target,Zap,
  PlusCircle, Search, Settings, Bell, CheckCircle, AlertCircle, Info, Clock, ArrowRight,  ChevronDown, ChevronLeft, ChevronRight, TrendingUp, Package, User, LogOut, Menu, X,
  UserPlus as UserPlusIcon, ShoppingCart as ShoppingCartIcon, Bell as BellIcon,
  Edit, Trash2, Eye
} from 'lucide-react';
import { flaskApi } from '../axios';

import {getAccessToken} from '/home/badman/ThePlanCave/utils/auth.js';
import ModernSettings from '../components/Settings';
import ModernAnalytics from '../components/Analytics';
import Revenue from '../components/Revenue';


const Dashboard = ({ initialUsers = [], initialProducts = [] }) => {

 
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    newUsersThisMonth: 0,
    totalProducts: 0,
    totalRevenue: 0,
    revenueGrowth: 0,
    dailyActiveUsers: 0
  });
  const [activeTab, setActiveTab] = useState('Overview');
  const [revenueData, setRevenueData] = useState([]);
  const [usageData, setUsageData] = useState([]);
  const [productData, setProductData] = useState([]);
  const [users, setUsers] = useState(initialUsers);
  const [products, setProducts] = useState(initialProducts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');   
  const [searchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [notifications, setNotifications] = useState([]);  
  const router = useRouter();
  const { data: session, status } = useSession();
  const [showForm, setShowForm] = useState(false);


  // Initialize data on component mount
  useEffect(() => {
    if (initialUsers.length > 0) {
      calculateStats(initialUsers, initialProducts);
    }
  }, [initialUsers, initialProducts]);

  // Calculate statistics from user and product data
  const calculateStats = (userList, productList) => {
    const activeUsers = userList.filter(user => user.isActive || user.status === 'active').length;
    const adminUsers = userList.filter(user => user.role === 'admin').length;
    
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newUsersThisMonth = userList.filter(user => {
      const createdAt = user.createdAt || user.created_at;
      return createdAt && new Date(createdAt) >= thisMonth;
    }).length;

    setStats(prevStats => ({
      ...prevStats,
      totalUsers: userList.length,
      activeUsers,
      adminUsers,
      newUsersThisMonth,
      totalProducts: productList.length,
    }));
  };

  // Fetch dashboard data from Flask backend
  useEffect(() => {
  const fetchData = async () => {
    if (status === 'loading') return;

    if (!session || !getAccessToken(session)) {
      setError('Authentication required. Please log in.');
      toast.error('Authentication required. Please log in.');
      return;
    }

    const user = session.user;
    if (user.role !== 'admin') {
      setError('Admin access required');
      toast.error('You need admin privileges to access this page');
      router.push('/');
      return;
    }

    setLoading(true);
    const config = {
      headers: {
        Authorization: `Bearer ${getAccessToken(session)}`,
        'Content-Type': 'application/json'
      }
    };

    try {
      const authCheck = await flaskApi.get('/verify-token', config);
      if (!authCheck.data.valid) {
        throw new Error('Invalid authentication token');
      }

      const [usersRes, productsRes, revenueRes, usageRes, notificationsRes] = await Promise.allSettled([
        flaskApi.get('/admin/users', config),
        flaskApi.get('/admin/products', config),
        flaskApi.get('/admin/revenue', config),
        flaskApi.get('/admin/analytics/usage', config),
        flaskApi.get('/admin/notifications', config)
      ]);

      if (usersRes.status === 'fulfilled') {
        const userData = usersRes.value.data.users || usersRes.value.data || [];
        setUsers(userData);
      }

      if (productsRes.status === 'fulfilled') {
        const productData = productsRes.value.data.products || productsRes.value.data || [];
        setProducts(productData);
      }

      if (revenueRes.status === 'fulfilled') {
        const revenue = revenueRes.value.data;
        setRevenueData(revenue.monthly || []);
        setStats(prevStats => ({
          ...prevStats,
          totalRevenue: revenue.total || 0,
          revenueGrowth: revenue.growth || 0
        }));
      }

      if (usageRes.status === 'fulfilled') {
        const usage = usageRes.value.data;
        setUsageData(usage.usage || usage.daily || []);
        setProductData(usage.userTypes || usage.distribution || []);
        setStats(prevStats => ({
          ...prevStats,
          dailyActiveUsers: usage.dailyActive || 0
        }));
      }

      if (notificationsRes.status === 'fulfilled') {
        setNotifications(notificationsRes.value.data.notifications || []);
      }

      // Final stats recalc
      const finalUsers = usersRes.status === 'fulfilled'
        ? (usersRes.value.data.users || usersRes.value.data || [])
        : users;
      const finalProducts = productsRes.status === 'fulfilled'
        ? (productsRes.value.data.products || productsRes.value.data || [])
        : products;

      calculateStats(finalUsers, finalProducts);
      setError('');

    } catch (err) {
      console.error('Dashboard error:', err);
      if (err.response?.status === 401 || err.message.includes("token")) {
        setError('Your session has expired. Please log in again.');
        toast.error('Your session has expired. Please log in again.');
        setTimeout(() => {
          signOut({ redirect: false });
          router.push('/login');
        }, 100);
      } else {
        const msg = err.response?.data?.message || err.message;
        setError(`Failed to fetch dashboard data: ${msg}`);
        toast.error(`Failed to fetch dashboard data: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, [session, status, router]);


  // Delete product handler
  const handleDeleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const token = getAccessToken();
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      const config = { 
        headers: { 
          Authorization: `Bearer ${getAccessToken(session)}`,
          'Content-Type': 'application/json'
        } 
      };

      await flaskApi.delete(`/admin/products/${productId}`, config);
      setProducts(products.filter(product => product.id !== productId));
      toast.success('Product deleted successfully');
    } catch (err) {
      console.error('Delete product error:', err);
      toast.error(err.response?.data?.message || 'Failed to delete product');
    }
  };

  // Filter users based on search query
  const filteredUsers = users.filter(user =>
    (user.username || user.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter products based on search query
  const filteredProducts = products.filter(product =>
    (product.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0);
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-indigo-600 border-gray-200 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading dashboard...</p>
        </div>
      </div>
    );
  }

if (error && error.includes('Admin access required')) {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-md">
        <div className="text-yellow-500 text-5xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button 
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}


  // UI Components
const OverviewCards = () => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Mock stats data for demonstration
  const stats = {
    totalUsers: "12,847",
    totalProducts: "3,456", 
    totalRevenue: 284750,
    revenueGrowth: 23.5
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Trigger entrance animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const cardData = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "blue",
      gradient: "from-blue-500/20 via-blue-600/10 to-transparent",
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-400",
      hoverGlow: "hover:shadow-blue-500/25"
    },
    {
      title: "Total Products", 
      value: stats.totalProducts,
      icon: ShoppingBag,
      color: "indigo",
      gradient: "from-indigo-500/20 via-indigo-600/10 to-transparent",
      iconBg: "bg-indigo-500/20",
      iconColor: "text-indigo-400",
      hoverGlow: "hover:shadow-indigo-500/25"
    },
    {
      title: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: "green", 
      gradient: "from-green-500/20 via-green-600/10 to-transparent",
      iconBg: "bg-green-500/20",
      iconColor: "text-green-400",
      hoverGlow: "hover:shadow-green-500/25"
    },
    {
      title: "Revenue Growth",
      value: `${stats.revenueGrowth}%`,
      icon: TrendingUp,
      color: "yellow",
      gradient: "from-yellow-500/20 via-yellow-600/10 to-transparent", 
      iconBg: "bg-yellow-500/20",
      iconColor: "text-yellow-400",
      hoverGlow: "hover:shadow-yellow-500/25"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
      {cardData.map((card, index) => {
        const IconComponent = card.icon;
        
        return (
          <div
            key={index}
            className={`
              group relative overflow-hidden
              bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-600/70
              backdrop-blur-sm border border-slate-700/50
              rounded-xl shadow-lg
              transition-all duration-500 ease-out
              hover:scale-[1.02] hover:shadow-2xl
              hover:border-slate-600/80
              ${card.hoverGlow}
              transform
              ${isVisible 
                ? 'translate-y-0 opacity-100' 
                : 'translate-y-8 opacity-0'
              }
            `}
            style={{
              transitionDelay: `${index * 100}ms`
            }}
          >
            {/* Animated background gradient overlay */}
            <div className={`
              absolute inset-0 opacity-0 group-hover:opacity-100
              bg-gradient-to-br ${card.gradient}
              transition-opacity duration-500
            `} />
            
            {/* Subtle animated border glow */}
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-r ${card.gradient} blur-sm`} />
            </div>
            
            {/* Card content */}
            <div className="relative p-4 sm:p-6 flex items-center">
              {/* Icon container with enhanced animations */}
              <div className={`
                w-10 h-10 sm:w-12 sm:h-12 rounded-full
                ${card.iconBg} backdrop-blur-sm
                flex items-center justify-center mr-3 sm:mr-4
                transition-all duration-300 ease-out
                group-hover:scale-110 group-hover:rotate-3
                shadow-lg group-hover:shadow-xl
              `}>
                <IconComponent 
                  size={24} 
                  className={`
                    ${card.iconColor} 
                    transition-all duration-300
                    group-hover:scale-110
                    sm:w-7 sm:h-7
                  `} 
                />
              </div>
              
              {/* Text content with staggered animations */}
              <div className="flex-1 min-w-0">
                <div className={`
                  text-slate-300 text-xs sm:text-sm font-medium
                  transition-all duration-300
                  group-hover:text-slate-200
                  group-hover:translate-x-1
                `}>
                  {card.title}
                </div>
                
                <div className={`
                  text-lg sm:text-2xl font-bold text-white mt-1
                  transition-all duration-300 ease-out
                  group-hover:scale-105 group-hover:translate-x-1
                  truncate
                `}>
                  {card.value}
                </div>
              </div>
            </div>
            
            {/* Subtle shimmer effect on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </div>
          </div>
        );
      })}
    </div>
  );
};



  const NotificationDropdown = () => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Mock notifications data
  const notifications = [
    {
      id: 1,
      type: 'success',
      title: 'Order Completed',
      message: 'Your order #12345 has been successfully processed',
      timestamp: '2 minutes ago',
      unread: true
    },
    {
      id: 2,
      type: 'warning', 
      title: 'Low Stock Alert',
      message: 'Product "Wireless Headphones" is running low on inventory',
      timestamp: '15 minutes ago',
      unread: true
    },
    {
      id: 3,
      type: 'info',
      title: 'System Update',
      message: 'New features have been added to your dashboard',
      timestamp: '1 hour ago',
      unread: false
    },
    {
      id: 4,
      type: 'success',
      title: 'Payment Received',
      message: 'Payment of $299.99 has been confirmed',
      timestamp: '2 hours ago',
      unread: false
    }
  ];

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const getNotificationIcon = (type) => {
    const iconProps = { size: 16, className: "flex-shrink-0" };
    
    switch (type) {
      case 'success':
        return <CheckCircle {...iconProps} className="text-green-500 flex-shrink-0" />;
      case 'warning':
        return <AlertCircle {...iconProps} className="text-amber-500 flex-shrink-0" />;
      case 'info':
        return <Info {...iconProps} className="text-blue-500 flex-shrink-0" />;
      default:
        return <Bell {...iconProps} className="text-gray-500 flex-shrink-0" />;
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
    <div className={`
      absolute right-0 mt-2 w-80 sm:w-96
      bg-white/95 backdrop-blur-xl
      rounded-2xl shadow-2xl border border-gray-200/50
      z-50 overflow-hidden
      transform transition-all duration-300 ease-out
      ${isVisible 
        ? 'translate-y-0 opacity-100 scale-100' 
        : 'translate-y-2 opacity-0 scale-95'
      }
    `}>
      {/* Header with gradient */}
      <div className="relative p-5 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Bell size={16} className="text-white" />
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
                  group relative p-4 mb-2 rounded-xl
                  ${getNotificationColors(notification.type, notification.unread)}
                  hover:shadow-md hover:scale-[1.01]
                  transition-all duration-200 ease-out
                  cursor-pointer
                  transform
                  ${isVisible 
                    ? 'translate-x-0 opacity-100' 
                    : 'translate-x-4 opacity-0'
                  }
                `}
                style={{
                  transitionDelay: `${idx * 50}ms`
                }}
              >
                {/* Notification content */}
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

                {/* Hover arrow indicator */}
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <ArrowRight size={14} className="text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Bell size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm font-medium">No new notifications</p>
            <p className="text-gray-400 text-xs mt-1 text-center">
              You're all caught up! Check back later for updates.
            </p>
          </div>
        )}
      </div>

      {/* Footer with enhanced button */}
      <div className="p-4 bg-gray-50/80 backdrop-blur-sm border-t border-gray-200/50">
        <button className="
          group w-full py-3 px-4 
          bg-gradient-to-r from-blue-600 to-purple-600
          hover:from-blue-700 hover:to-purple-700
          text-white font-medium text-sm rounded-xl
          transition-all duration-200 ease-out
          hover:shadow-lg hover:scale-[1.02]
          focus:outline-none focus:ring-2 focus:ring-blue-500/50
          flex items-center justify-center space-x-2
        ">
          <span>View all notifications</span>
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
        </button>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.4);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.6);
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};


 const Sidebar = ({ session, stats }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  
  // Handle logout with NextAuth signOut
  const handleLogout = async () => {
    try {
      await signOut({ redirect: false });
      toast.info('You have been logged out');
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      router.push('/login');
    }
  };

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* Mobile menu backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 z-30 transition-opacity duration-300 lg:hidden ${
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />
      
      {/* Sidebar */}
      <div
        className={`bg-slate-900 text-white fixed h-screen transition-all duration-300 z-40 ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isMobileMenuOpen ? 'left-0' : '-left-64 lg:left-0'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700 h-16">
          {!isCollapsed && (
            <div className="logo transition-opacity duration-200">
              <Link href="/">
                <img src="/Logo2.svg" alt="Logo" className="h-8" />
              </Link>
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <button
              className="lg:hidden text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X size={24} />
            </button>
            
            <button
              className="hidden lg:flex items-center justify-center text-slate-400 hover:text-white w-8 h-8 rounded-full hover:bg-slate-800 transition-colors"
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>
        </div>
        
        <div className="py-4 h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar">
          {/* User Profile */}
          <div className={`px-4 mb-6 transition-all duration-300 ${
            isCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'
          }`}>
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center mr-3 shrink-0">
                <User size={20} />
              </div>
              <div className="overflow-hidden">
                <div className="font-medium truncate">{session?.user?.username || 'Admin User'}</div>
                <div className="text-xs text-slate-400 truncate">{session?.user?.role || 'admin'}</div>
              </div>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="space-y-1 px-2">
            <SidebarLink
              icon={<BarChart2 size={18} />}
              label="Overview"
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              isCollapsed={isCollapsed}
              isHovered={isHovered}
            />
            <SidebarLink
              icon={<Users size={18} />}
              label="Users"
              active={activeTab === 'users'}
              onClick={() => setActiveTab('users')}
              badge={stats?.totalUsers}
              isCollapsed={isCollapsed}
              isHovered={isHovered}
            />
            <SidebarLink
              icon={<Package size={18} />}
              label="Products"
              active={activeTab === 'products'}
              onClick={() => setActiveTab('products')}
              badge={stats?.totalProducts}
              isCollapsed={isCollapsed}
              isHovered={isHovered}
            />
            <SidebarLink
              icon={<DollarSign size={18} />}
              label="Revenue"
              active={activeTab === 'revenue'}
              onClick={() => setActiveTab('revenue')}
              isCollapsed={isCollapsed}
              isHovered={isHovered}
            />
            <SidebarLink
              icon={<BarChart2 size={18} />}
              label="Analytics"
              active={activeTab === 'analytics'}
              onClick={() => setActiveTab('analytics')}
              isCollapsed={isCollapsed}
              isHovered={isHovered}
            />
            <SidebarLink
              icon={<Settings size={18} />}
              label="Settings"
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              isCollapsed={isCollapsed}
              isHovered={isHovered}
            />
          </nav>
          
          {/* Logout */}
          <div className={`px-4 mt-8 pt-4 border-t border-slate-700 transition-all duration-300 ${
            isCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'
          }`}>
            <button 
              className="flex items-center text-slate-400 hover:text-white w-full transition-colors"
              onClick={handleLogout}
            >
              <LogOut size={18} className="mr-2" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const SidebarLink = ({ icon, label, active, onClick, badge, isCollapsed, isHovered }) => {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  return (
    <button
      className={`flex items-center justify-between py-3 px-3 w-full rounded-lg transition-all duration-300 ${
        active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      } ${
        isCollapsed ? 'mx-auto w-12' : 'mx-0 w-auto'
      }`}
      onClick={() => {
        onClick();
        setIsMobileMenuOpen(false);
      }}
    >
      <div className="flex items-center overflow-hidden">
        <span className={`${isCollapsed ? 'mx-auto' : 'mr-3'}`}>
          {icon}
        </span>
        <span className={`whitespace-nowrap transition-all duration-300 ${
          isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
        }`}>
          {label}
        </span>
      </div>
      
      {badge && !isCollapsed && (
        <span className="bg-slate-700 text-white text-xs px-2 py-1 rounded-full ml-2">
          {badge}
        </span>
      )}
      
      {/* Tooltip for collapsed state */}
      {isCollapsed && isHovered && isMounted && (
        <div className="absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg whitespace-nowrap z-50">
          {label}
          {badge && (
            <span className="ml-2 bg-slate-700 text-white text-xs px-2 py-1 rounded-full">
              {badge}
            </span>
          )}
        </div>
      )}
    </button>
  );
};


const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Add to Header component:
useEffect(() => {
  const handleClickOutside = (e) => {
    if (notifications.current && !notifications.current.contains(e.target)) {
      setShowNotifications(false);
    }
  };
  
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);

const handleSearch = () => {
    if (searchQuery.trim()) {
      // Add animation when searching
      gsap.to(searchContainerRef.current, {
        duration: 0.3,
        scale: 0.98,
        y: 2,
        ease: 'power2.inOut',
        repeat: 1,
        yoyo: true
      });
 
      // Perform your search logic here
      console.log('Searching for:', searchQuery);
      // You would typically call an API or filter data here
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
    if (e.key === 'Escape') {
      setSearchQuery('');
      searchInputRef.current?.blur();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };


  return (
    <header className="bg-slate-800 border-b border-slate-700 shadow-lg py-4 px-6 flex items-center justify-between">
      <div className="flex items-center">
        <button
          className="mr-4 text-slate-300 hover:text-white lg:hidden transition-colors duration-200"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-semibold text-white">
          {activeTab === 'overview' && 'Dashboard Overview'}
          {activeTab === 'users' && 'User Management'}
          {activeTab === 'products' && 'Product Management'}
          {activeTab === 'revenue' && 'Revenue Analytics'}
          {activeTab === 'analytics' && 'Usage Analytics'}
          {activeTab === 'settings' && 'Dashboard Settings'}
        </h1>
      </div>

      <div className="flex items-center space-x-4">
{/* Enhanced Search Bar */}
<div className="relative" ref={searchContainerRef}>
  {/* Desktop Search (hidden on mobile) */}
  <div className="hidden md:block relative">
    <input
      ref={searchInputRef}
      type="text"
      placeholder="Search users, products, analytics..."
      className={`
        px-4 py-2 pr-20 pl-10 
        bg-slate-700 border border-slate-600 rounded-lg 
        text-white placeholder-slate-400
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
        hover:border-slate-500
        transition-all duration-200 
        w-64 lg:w-80
        ${isSearchFocused ? 'ring-2 ring-blue-500 border-blue-500' : ''}
      `}
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsSearchFocused(true)}
      onBlur={() => setIsSearchFocused(false)}
    />
    
    {/* Search Icon */}
    <div className="absolute left-3 top-2.5 text-slate-400">
      <Search size={18} />
    </div>

    {/* Clear/Search Button */}
    <div className="absolute right-2 top-1.5 flex items-center space-x-1">
      {searchQuery && (
        <button 
          onClick={clearSearch}
          className="p-1 text-slate-400 hover:text-white rounded transition-colors duration-200"
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
      <button 
        onClick={handleSearch}
        className="p-1 text-slate-400 hover:text-blue-400 transition-colors duration-200"
        aria-label="Search"
      >
        <Search size={16} />
      </button>
    </div>
  </div>

  {/* Search Results Indicator */}
  {searchQuery && (
    <div className="absolute top-full left-0 right-0 mt-1 text-xs text-slate-400 px-2 hidden md:block">
      {searchQuery.length > 0 && `Searching for "${searchQuery}"...`}
    </div>
  )}
</div>

{/* Mobile Search Toggle */}
<button 
  className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-full transition-all duration-200"
  onClick={() => setIsSearchExpanded(!isSearchExpanded)}
>
  <Search size={20} />
</button>

{/* Mobile search field */}
{isSearchExpanded && (
  <div className="md:hidden absolute top-full left-0 right-0 bg-slate-800 p-2 border-b border-slate-700 flex items-center">
    <input
      type="text"
      placeholder="Search users, products, analytics..."
      className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      onKeyDown={handleKeyDown}
      autoFocus
    />
    <button 
      className="ml-2 p-2 text-slate-400 hover:text-white"
      onClick={() => setIsSearchExpanded(false)}
    >
      <X size={20} />
    </button>
  </div>
)}

        {/* Enhanced Notifications */}
        <div className="relative">
          <button 
            className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-full transition-all duration-200"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
          >
            <BellIcon size={20} />
            {notifications.length > 0 && (
              <>
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                <span className="absolute top-1 right-1 w-1 h-1 bg-red-300 rounded-full"></span>
              </>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
              <NotificationDropdown />
            </div>
          )}
        </div>

        {/* Enhanced User Profile */}
        <div className="relative">
          <button 
            className="flex items-center text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg px-3 py-2 transition-all duration-200"
            aria-label="User profile"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center mr-2 shadow-lg">
              {(session?.user?.username || 'A').charAt(0).toUpperCase()}
            </div>
            <span className="hidden md:block font-medium">{session?.user?.username || 'Admin'}</span>
            <ChevronDown size={16} className="ml-2 transition-transform duration-200" />
          </button>
        </div>
      </div>
    </header>
  );
};

  // Add User Modal
// Enhanced AddUserModal with dark theme and blur effect

const AddUserModal = ({  setUsers }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'customer'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();

  // Animation on mount/unmount
  useEffect(() => {
    setIsVisible(true);
    return () => setIsVisible(false);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (status === 'loading') throw new Error('Session is still loading. Please wait...');
      if (!session) throw new Error('No session found. Please login again.');

      const token = getAccessToken(session);
      if (!token) throw new Error('Authentication token missing');

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      const payload = {
        username: formData.username,
        password: formData.password,
        role: formData.role
      };

      const response = await flaskApi.post('/admin/create_user', payload, config);

      if (response.data.message === "User registered successfully") {
        toast.success('User created successfully!');
        const usersRes = await flaskApi.get('/admin/users', config);
        setUsers(usersRes.data.users || usersRes.data);
        closeModal();
      } else {
        throw new Error(response.data.message || 'User creation failed');
      }
    } catch (err) {
      console.error('User creation error:', err);
      handleError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleError = (err) => {
    if (err.message.includes("token") || err.response?.status === 401) {
      toast.error('Your session has expired. Please log in again.');
      signOut({ redirect: false });
      router.push('/login');
    } else {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create user';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const closeModal = () => {
    setIsVisible(false);
    setTimeout(() => setShowAddUserModal(false), 300);
  };

  return (
    <div className={`
      fixed inset-0 z-50 flex items-center justify-center
      transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
      ${isVisible ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 backdrop-blur-none'}
    `}>
      {/* Backdrop with blur effect */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={closeModal}
      />
      
      {/* Modal container with animation */}
      <div className={`
        relative bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
      `}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold text-white flex items-center">
            <UserPlusIcon className="mr-2" size={24} />
            Create New User
          </h2>
          <button 
            onClick={closeModal}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-700"
          >
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm animate-shake">
            <span className="font-medium">Error:</span> {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="animate-fadeIn">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Username *
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>
            
            <div className="animate-fadeIn delay-100">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter password"
                required
              />
            </div>
            
            <div className="animate-fadeIn delay-200">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Role
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="customer">Customer</option>
                <option value="designer">Designer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={closeModal}
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all duration-200 hover:shadow-md"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center disabled:opacity-70 transition-all duration-200 hover:shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <UserPlusIcon size={18} className="mr-2" />
                  Create User
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};



// Updated User Management Tab with Dark Theme
const renderTab = () => {
  switch (activeTab) {
    case 'users':
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center">
          <Users size={18} className="text-slate-300 mr-2 sm:mr-3" />
          <h3 className="text-base sm:text-lg font-semibold text-white">User Management</h3>
          <span className="ml-2 sm:ml-3 bg-slate-700 text-slate-300 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium">
            {filteredUsers.length} users
          </span>
        </div>
       
      </div>
      
<div className="overflow-x-auto rounded-xl border border-slate-700 shadow-lg">
  <table className="min-w-full divide-y divide-slate-700/50">
    <thead className="bg-slate-900/80 backdrop-blur-sm">
      <tr>
        <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
          <div className="flex items-center space-x-1">
            <Users size={16} />
            <span>User</span>
          </div>
        </th>
        <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
          <div className="flex items-center space-x-1">
            <Mail size={16} />
            <span>Email</span>
          </div>
        </th>
        <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
          <div className="flex items-center space-x-1">
            <Shield size={16} />
            <span>Role</span>
          </div>
        </th>
        <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
          <div className="flex items-center space-x-1">
            <Activity size={16} />
            <span>Status</span>
          </div>
        </th>
        <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
          <div className="flex items-center space-x-1">
            <Calendar size={16} />
            <span>Created</span>
          </div>
        </th>
        <th className="px-6 py-4 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
          Actions
        </th>
      </tr>
    </thead>
    <tbody className="bg-slate-800/50 divide-y divide-slate-700/30">
      {filteredUsers.length > 0 ? (
        filteredUsers.map((user, idx) => (
          <tr 
            key={user.id || idx} 
            className="hover:bg-slate-700/30 transition-colors duration-150 group"
          >
            {/* User Cell */}
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg group-hover:shadow-blue-500/30 transition-shadow duration-200">
                    {(user.username || user.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-800 ${
                    (user.isActive || user.status === 'active') ? 'bg-green-500' : 'bg-red-500'
                  }`}></span>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors duration-200">
                    {user.username || user.name || `User ${idx + 1}`}
                  </div>
                  <div className="text-xs text-slate-400">
                    @{user.username?.toLowerCase() || 'user' + (idx + 1)}
                  </div>
                </div>
              </div>
            </td>

            {/* Email Cell */}
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm text-slate-300 group-hover:text-white transition-colors duration-200">
                {user.email || `user${idx + 1}@example.com`}
              </div>
              <div className="text-xs text-slate-500">
                {user.emailVerified ? 'Verified' : 'Unverified'}
              </div>
            </td>

            {/* Role Cell */}
            <td className="px-6 py-4 whitespace-nowrap">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                user.role === 'designer' ? 'bg-blue-500/20 text-blue-400' :
                'bg-slate-500/20 text-slate-400'
              }`}>
                {user.role === 'admin' && <Shield size={12} className="mr-1" />}
                {user.role === 'designer' && <PenTool size={12} className="mr-1" />}
                {(!user.role || user.role === 'customer') && <User size={12} className="mr-1" />}
                {user.role || "customer"}
              </div>
            </td>

            {/* Status Cell */}
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  (user.isActive || user.status === 'active') ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}></div>
                <span className={`text-sm ${
                  (user.isActive || user.status === 'active') ? 'text-green-400' : 'text-red-400'
                }`}>
                  {(user.isActive || user.status === 'active') ? 'Active' : 'Inactive'}
                </span>
              </div>
            </td>

            {/* Created Cell */}
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm text-slate-400">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 
                 user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </div>
              <div className="text-xs text-slate-500">
                {user.lastLogin ? 'Last seen: ' + new Date(user.lastLogin).toLocaleDateString() : 'Never logged in'}
              </div>
            </td>

            {/* Actions Cell */}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div className="flex justify-end space-x-2">
                <Tooltip content="View Details">
                  <button className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-lg transition-all duration-200 hover:scale-110">
                    <Eye size={18} />
                  </button>
                </Tooltip>
                
                <Tooltip content="Edit User">
                  <button className="p-2 text-slate-400 hover:text-green-400 hover:bg-slate-700/50 rounded-lg transition-all duration-200 hover:scale-110">
                    <Edit size={18} />
                  </button>
                </Tooltip>
                
                <Tooltip content="Delete User">
                  <button 
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-all duration-200 hover:scale-110"
                    onClick={() => confirmDelete(user.id, user.username || user.name || `User ${idx + 1}`)}
                  >
                    <Trash2 size={18} />
                  </button>
                </Tooltip>
              </div>
            </td>
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan="6" className="px-6 py-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mb-4">
                <Users size={32} className="text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-1">No users found</h3>
              <p className="text-sm text-slate-400 mb-4">Add your first user to get started</p>
              <button
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:opacity-90 flex items-center transition-all duration-200 shadow-lg hover:shadow-xl"
                onClick={() => setShowAddUserModal(true)}
              >
                <UserPlus size={16} className="mr-2" />
                <span>Add User</span>
              </button>
            </div>
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>
      
      {/* Render modals */}
      {showAddUserModal && <AddUserModal />}
      
    </div>
  );

case 'products':
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center">
          <Package size={20} className="text-blue-400 mr-2 sm:mr-3" />
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">Product Management</h2>
            <p className="text-xs sm:text-sm text-slate-400">Manage your product inventory</p>
          </div>
        </div>
      </div>

      {/* Stats Summary - Stack on mobile, grid on larger screens */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 p-3 sm:p-6 bg-slate-900 border-b border-slate-700">
        <div className="bg-slate-800 border border-slate-700 p-2 sm:p-4 rounded-lg shadow-sm">
          <p className="text-xs sm:text-sm text-slate-400">Total Products</p>
          <p className="text-xl sm:text-2xl font-bold text-white mt-1">{filteredProducts.length}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-2 sm:p-4 rounded-lg shadow-sm">
          <p className="text-xs sm:text-sm text-slate-400">Active Listings</p>
          <p className="text-xl sm:text-2xl font-bold text-green-400 mt-1">
            {filteredProducts.filter(p => p.status === 'active').length}
          </p>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-2 sm:p-4 rounded-lg shadow-sm">
          <p className="text-xs sm:text-sm text-slate-400">Low Stock</p>
          <p className="text-xl sm:text-2xl font-bold text-orange-400 mt-1">
            {filteredProducts.filter(p => p.stock < 3).length}
          </p>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-2 sm:p-4 rounded-lg shadow-sm">
          <p className="text-xs sm:text-sm text-slate-400">Total Value</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-400 mt-1">
            {formatCurrency(filteredProducts.reduce((sum, p) => sum + (p.price * p.stock), 0))}
          </p>
        </div>
      </div>

     <div className="relative">
  {/* Animated background gradient */}
  <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-blue-900/20 to-purple-900/30 rounded-2xl opacity-70"></div>
  
  <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-800/90 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
    {/* Header with glow effect */}
    <div className="relative bg-gradient-to-r from-slate-800/90 to-slate-700/80 border-b border-slate-600/50 p-4 sm:p-6">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5"></div>
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg shadow-lg">
            <Package className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Product Inventory</h3>
          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span>Live inventory</span>
          </div>
        </div>
        <div className="text-sm text-slate-400">
          {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
        </div>
      </div>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-700/50">
        <thead className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 hidden sm:table-header-group">
          <tr>
            <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <span>Product</span>
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
              </div>
            </th>
            <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Category</th>
            <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Price</th>
            <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Stock</th>
            <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
            <th className="px-4 sm:px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product, idx) => (
              <tr 
                key={product.id || idx} 
                className="group relative hover:bg-gradient-to-r hover:from-slate-800/50 hover:to-slate-700/30 transition-all duration-300 hover:shadow-lg hover:shadow-slate-900/20"
              >
                {/* Hover glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                
                {/* Mobile-first cell with enhanced styling */}
                <td className="relative px-4 sm:px-6 py-6 sm:hidden block">
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center">
                      <div className="relative flex-shrink-0 h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300 group-hover:scale-105">
                        <Package size={18} className="text-white" />
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="font-semibold text-white text-base group-hover:text-blue-300 transition-colors duration-300">
                          {product.name || `Product ${idx + 1}`}
                        </div>
                        <div className="text-sm text-slate-400 line-clamp-2 mt-1">
                          {product.description?.substring(0, 40) || 'No description available'}...
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-300 rounded-full border border-blue-500/30 backdrop-blur-sm">
                        {product.category || 'Uncategorized'}
                      </span>
                      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border backdrop-blur-sm transition-all duration-300 ${
                        product.status === 'active' 
                          ? 'bg-gradient-to-r from-green-500/20 to-emerald-600/20 text-green-300 border-green-500/30' 
                          : 'bg-gradient-to-r from-slate-500/20 to-slate-600/20 text-slate-300 border-slate-500/30'
                      }`}>
                        {product.status || 'active'}
                      </span>
                      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border backdrop-blur-sm transition-all duration-300 ${
                        product.stock === 0 
                          ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-300 border-red-500/30' : 
                        product.stock < 3 
                          ? 'bg-gradient-to-r from-yellow-500/20 to-orange-600/20 text-yellow-300 border-yellow-500/30' 
                          : 'bg-gradient-to-r from-green-500/20 to-emerald-600/20 text-green-300 border-green-500/30'
                      }`}>
                        Stock: {product.stock || 0}
                      </span>
                      <span className="px-3 py-1.5 text-xs font-semibold text-blue-300 bg-gradient-to-r from-slate-700/50 to-slate-600/50 rounded-full border border-slate-500/30 backdrop-blur-sm">
                        {formatCurrency(product.price || 0)}
                      </span>
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-2">
                      <button 
                        className="relative p-2.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg group/btn"
                        title="View Product"
                      >
                        <Eye size={16} />
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                      </button>
                      <button 
                        className="relative p-2.5 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg group/btn"
                        title="Edit Product"
                      >
                        <Edit size={16} />
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                      </button>
                      <button 
                        className="relative p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg group/btn" 
                        title="Delete Product"
                        onClick={() => handleDeleteProduct(product.id, product.name || `Product ${idx + 1}`)}
                      >
                        <Trash2 size={16} />
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                      </button>
                    </div>
                  </div>
                </td>
                
                {/* Enhanced Desktop cells */}
                <td className="relative px-4 sm:px-6 py-6 whitespace-nowrap hidden sm:table-cell">
                  <div className="flex items-center">
                    <div className="relative flex-shrink-0 h-12 w-12 sm:h-14 sm:w-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300 group-hover:scale-105">
                      <Package size={20} className="text-white" />
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    <div className="ml-4">
                      <div className="font-semibold text-white text-base group-hover:text-blue-300 transition-colors duration-300">
                        {product.name || `Product ${idx + 1}`}
                      </div>
                      <div className="text-sm text-slate-400 line-clamp-1 mt-1">
                        {product.description?.substring(0, 60) || 'No description available'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="relative px-4 sm:px-6 py-6 whitespace-nowrap hidden sm:table-cell">
                  <span className="px-3 py-2 text-sm font-semibold bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-300 rounded-full border border-blue-500/30 backdrop-blur-sm transition-all duration-300 hover:scale-105">
                    {product.category || 'Uncategorized'}
                  </span>
                </td>
                <td className="relative px-4 sm:px-6 py-6 whitespace-nowrap text-slate-200 font-semibold text-base hidden sm:table-cell group-hover:text-blue-300 transition-colors duration-300">
                  {formatCurrency(product.price || 0)}
                </td>
                <td className="relative px-4 sm:px-6 py-6 whitespace-nowrap hidden sm:table-cell">
                  <span className={`px-3 py-2 inline-flex text-sm leading-5 font-semibold rounded-full border backdrop-blur-sm transition-all duration-300 hover:scale-105 ${
                    product.stock === 0 
                      ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-300 border-red-500/30' : 
                    product.stock < 3 
                      ? 'bg-gradient-to-r from-yellow-500/20 to-orange-600/20 text-yellow-300 border-yellow-500/30' 
                      : 'bg-gradient-to-r from-green-500/20 to-emerald-600/20 text-green-300 border-green-500/30'
                  }`}>
                    {product.stock || 0}
                  </span>
                </td>
                <td className="relative px-4 sm:px-6 py-6 whitespace-nowrap hidden sm:table-cell">
                  <span className={`px-3 py-2 inline-flex text-sm leading-5 font-semibold rounded-full border backdrop-blur-sm transition-all duration-300 hover:scale-105 ${
                    product.status === 'active' 
                      ? 'bg-gradient-to-r from-green-500/20 to-emerald-600/20 text-green-300 border-green-500/30' 
                      : 'bg-gradient-to-r from-slate-500/20 to-slate-600/20 text-slate-300 border-slate-500/30'
                  }`}>
                    {product.status || 'active'}
                  </span>
                </td>
                <td className="relative px-4 sm:px-6 py-6 whitespace-nowrap text-right text-sm font-medium hidden sm:table-cell">
                  <div className="flex justify-end space-x-2">
                    <button 
                      className="relative p-2.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg group/btn"
                      title="View Product"
                    >
                      <Eye size={18} />
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                    </button>
                    <button 
                      className="relative p-2.5 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg group/btn"
                      title="Edit Product"
                    >
                      <Edit size={18} />
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                    </button>
                    <button 
                      className="relative p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg group/btn" 
                      title="Delete Product"
                      onClick={() => handleDeleteProduct(product.id, product.name || `Product ${idx + 1}`)}
                    >
                      <Trash2 size={18} />
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="px-4 sm:px-6 py-16 text-center">
                <div className="flex flex-col items-center justify-center">
                  <div className="relative p-6 bg-gradient-to-br from-slate-700/30 to-slate-600/20 rounded-2xl mb-6 border border-slate-600/30">
                    <Package size={48} className="text-slate-500 mx-auto" />
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-2xl"></div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No products found</h3>
                  <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
                    Add your first product to start managing your inventory and boost your business.
                  </p>
                  <button 
                    className="relative group bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 flex items-center transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-blue-500/20 hover:scale-105"
                    onClick={() => setShowForm(true)}
                  >
                    <PlusCircle size={18} className="mr-2" />
                    <span className="font-semibold">Add Your First Product</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
</div>
      {showForm && (
        <NewProductForm 
          onClose={() => setShowForm(false)}
          
          onProductCreated={(newProduct) => {
            setProducts(prev => [...prev, newProduct]);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
case 'revenue':
  return (
    <Revenue 
      stats={stats} 
      revenueData={revenueData} 
      formatCurrency={formatCurrency} 
    />
  );

case 'analytics':
  return <ModernAnalytics />;

case 'settings':
  return <ModernSettings session={session} />;

      default:
        return (
          <div className="space-y-6">
            <OverviewCards />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium mb-4">Revenue Overview</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatCurrency(value), 'Revenue']} />
                      <Bar dataKey="revenue" fill="#4f46e5" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium mb-4">User Activity</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={usageData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="users" 
                        stroke="#22c55e" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {notifications.slice(0, 5).map((notification, idx) => (
                  <div key={idx} className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full mr-3"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {notification.title || `Activity ${idx + 1}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {notification.message || `Recent activity notification`}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {notification.timestamp || 'Just now'}
                    </div>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    No recent activity
                  </div>
                )}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:ml-64">
        <Header />
        <main className="p-6">
          {error && !error.includes('Authentication required') && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
         
          {renderTab()}

          
        </main>
      </div>
      
      {showAddUserModal && <AddUserModal />}
      
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;