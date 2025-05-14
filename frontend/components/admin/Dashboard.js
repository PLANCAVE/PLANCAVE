import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { UserPlusIcon, ShoppingCartIcon, BellIcon } from 'lucide-react'; // or your preferred icon library
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, LineChart, Line, Legend, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Users, ShoppingBag, DollarSign, BarChart2, 
  PlusCircle, Search, Settings, Bell, ChevronDown,
  Calendar, TrendingUp, Package, User, LogOut, Menu, X 
} from 'lucide-react';
import Link from 'next/link';
// Define color constants for consistency
const COLORS = {
  primary: '#4f46e5',
  secondary: '#6366f1',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  light: '#f3f4f6',
  dark: '#1f2937',
};

// Color array for charts
// Sample data definitions for your dashboard
// Add these before your component's return statement

// Colors for charts
const CHART_COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c'];


// User engagement data for line chart
const engagementData = [
  { date: 'Jan', newUsers: 400, returningUsers: 240 },
  { date: 'Feb', newUsers: 300, returningUsers: 320 },
  { date: 'Mar', newUsers: 520, returningUsers: 480 },
  { date: 'Apr', newUsers: 450, returningUsers: 520 },
  { date: 'May', newUsers: 600, returningUsers: 550 },
  { date: 'Jun', newUsers: 580, returningUsers: 620 }
];

// Features usage data for horizontal bar chart
const featuresData = [
  { feature: 'Dashboard', usage: 120 },
  { feature: 'Reports', usage: 98 },
  { feature: 'Analytics', usage: 86 },
  { feature: 'Settings', usage: 65 },
  { feature: 'Profile', usage: 43 }
];

// Geographic distribution data for pie chart
const geoData = [
  { name: 'Kenya', value: 520 },
  { name: 'Uganda', value: 380 },
  { name: 'Tanzania', value: 450 },
  { name: 'South Africa', value: 180 },
  { name: 'Nigeria', value: 120 }
];

// Product distribution data for pie chart (already referenced in your code)
const productData = [
  { name: 'Free Tier', value: 2400 },
  { name: 'Basic', value: 1398 },
  { name: 'Premium', value: 950 },
  { name: 'Enterprise', value: 250 }
];

// Sample usage data for bar chart (already referenced in your code)
const usageData = [
  { day: 'Mon', visits: 1000 },
  { day: 'Tue', visits: 1200 },
  { day: 'Wed', visits: 1500 },
  { day: 'Thu', visits: 1300 },
  { day: 'Fri', visits: 1400 },
  { day: 'Sat', visits: 800 },
  { day: 'Sun', visits: 750 }
];

// Activity timeline data
const activityData = [
  { type: 'signup', message: 'New user registered from South Africa', time: '2 minutes ago' },
  { type: 'purchase', message: 'Premium plan purchased by existing user', time: '1 hour ago' },
  { type: 'notification', message: 'System maintenance scheduled for tonight', time: '3 hours ago' },
  { type: 'signup', message: 'New enterprise registration from Nigeria', time: '5 hours ago' },
  { type: 'purchase', message: 'Enterprise plan upgraded with add-ons', time: '1 day ago' }
];

// Sample stats object (already referenced in your code)
const stats = {
  dailyActiveUsers: '12,452',
  // You might have other stats here
};

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalProducts: 0,
    totalRevenue: 0,
    revenueGrowth: 0,
    dailyActiveUsers: 0
  });
  const [revenueData, setRevenueData] = useState([]);
  const [usageData, setUsageData] = useState([]);
  const [productData, setProductData] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  // Mock data fetch - in real implementation, these would be separate API calls
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // API Base URL
        const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        
        // Fetch users
        const usersRes = await axios.get(`${baseURL}/api/admin/users`);
        const users = usersRes.data;
        setUsers(users);
        
        // Mock products data - replace with actual API call
        const productsRes = await axios.get(`${baseURL}/api/admin/products`).catch(() => ({
          data: [
            { id: 1, name: 'Basic Plan', price: 9.99, active: true, subscribers: 245 },
            { id: 2, name: 'Premium Plan', price: 19.99, active: true, subscribers: 132 },
            { id: 3, name: 'Enterprise Plan', price: 49.99, active: true, subscribers: 57 }
          ]
        }));
        setProducts(productsRes.data);
        
        // Mock revenue data - replace with actual API call
        const revenueRes = await axios.get(`${baseURL}/api/admin/revenue`).catch(() => ({
          data: {
            total: 45928.40,
            growth: 12.5,
            monthly: [
              { month: 'Jan', revenue: 3200 },
              { month: 'Feb', revenue: 3800 },
              { month: 'Mar', revenue: 4200 },
              { month: 'Apr', revenue: 4100 },
              { month: 'May', revenue: 4900 },
              { month: 'Jun', revenue: 5100 }
            ]
          }
        }));
        
        // Mock usage data - replace with actual API call
        const usageRes = await axios.get(`${baseURL}/api/admin/analytics/usage`).catch(() => ({
          data: {
            dailyActive: 348,
            weeklyActive: 1245,
            usage: [
              { day: 'Mon', visits: 420 },
              { day: 'Tue', visits: 380 },
              { day: 'Wed', visits: 450 },
              { day: 'Thu', visits: 520 },
              { day: 'Fri', visits: 480 },
              { day: 'Sat', visits: 220 },
              { day: 'Sun', visits: 200 }
            ],
            userTypes: [
              { name: 'Free', value: 650 },
              { name: 'Basic', value: 245 },
              { name: 'Premium', value: 132 },
              { name: 'Enterprise', value: 57 }
            ]
          }
        }));
        
        // Calculate various stats
        const activeUsers = users.filter(user => user.isActive).length;
        const adminUsers = users.filter(user => user.role === 'admin').length;
        
        // Calculate new users this month
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const newUsersThisMonth = users.filter(user => {
          const createdAt = user.createdAt || user.created_at;
          return new Date(createdAt) >= thisMonth;
        }).length;
        
        // Set all the stats
        setStats({
          totalUsers: users.length,
          activeUsers,
          adminUsers,
          newUsersThisMonth,
          totalProducts: productsRes.data.length,
          totalRevenue: revenueRes.data.total,
          revenueGrowth: revenueRes.data.growth,
          dailyActiveUsers: usageRes.data.dailyActive
        });
        
        setRevenueData(revenueRes.data.monthly);
        setUsageData(usageRes.data.usage);
        setProductData(usageRes.data.userTypes);
        
        setError('');
      } catch (err) {
        setError(`Failed to fetch dashboard data: ${err.response?.data?.message || err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter users based on search query
  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter products based on search query
  const filteredProducts = products.filter(product => 
    product.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const handleAddProduct = () => {
    // In real implementation, this would open a modal or navigate to a product creation page
    router.push('/admin/products/new');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-indigo-600 border-gray-200 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const Sidebar = () => (
    <div className={`bg-indigo-900 text-white w-64 min-h-screen fixed transition-all ${isMobileMenuOpen ? 'left-0' : '-left-64 lg:left-0'} lg:translate-x-0 z-40`}>
      <div className="flex items-center justify-between p-4 border-b border-indigo-800">
             <div className="logo">
        <Link href="/">
          <img src="/Logo2.svg" alt="Logo" />
        </Link>
      </div>
        <button 
          className="lg:hidden text-white" 
          onClick={() => setIsMobileMenuOpen(false)}
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
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')} 
          />
          <SidebarLink 
            icon={<Users size={18} />} 
            label="Users" 
            active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')}
          />
          <SidebarLink 
            icon={<Package size={18} />} 
            label="Products" 
            active={activeTab === 'products'} 
            onClick={() => setActiveTab('products')} 
          />
          <SidebarLink 
            icon={<DollarSign size={18} />} 
            label="Revenue" 
            active={activeTab === 'revenue'} 
            onClick={() => setActiveTab('revenue')} 
          />
          <SidebarLink 
            icon={<BarChart2 size={18} />} 
            label="Analytics" 
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')} 
          />
          <SidebarLink 
            icon={<Settings size={18} />} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
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

  const SidebarLink = ({ icon, label, active, onClick }) => (
    <button 
      className={`flex items-center py-3 px-4 w-full ${active ? 'bg-indigo-800 text-white' : 'text-indigo-300 hover:bg-indigo-800 hover:text-white'}`}
      onClick={onClick}
    >
      <span className="mr-3">{icon}</span>
      <span>{label}</span>
    </button>
  );

  const Header = () => (
    <header className="bg-white shadow-sm py-4 px-6 flex items-center justify-between">
      <div className="flex items-center">
        <button 
          className="mr-4 text-gray-700 lg:hidden" 
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-semibold text-gray-800">
          {activeTab === 'overview' && 'Dashboard Overview'}
          {activeTab === 'users' && 'User Management'}
          {activeTab === 'products' && 'Product Management'}
          {activeTab === 'revenue' && 'Revenue Analytics'}
          {activeTab === 'analytics' && 'Usage Analytics'}
          {activeTab === 'settings' && 'Dashboard Settings'}
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
              A
            </div>
            <span className="hidden md:block">Admin</span>
            <ChevronDown size={16} className="ml-1" />
          </button>
        </div>
      </div>
    </header>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'users':
        return (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">User Management</h3>
              <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center">
                <PlusCircle size={16} className="mr-1" />
                <span>Add User</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.slice(0, 5).map((user, idx) => (
                    <tr key={user.id || idx}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-500 flex items-center justify-center mr-3">
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>{user.name || `User ${idx + 1}`}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{user.email || `user${idx + 1}@example.com`}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{user.role || "user"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                        <button className="text-red-600 hover:text-red-900">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-500">Showing 5 of {filteredUsers.length} users</div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50">Previous</button>
                <button className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Next</button>
              </div>
            </div>
          </div>
        );
      
      case 'products':
        return (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">Product Management</h3>
              <button 
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center"
                onClick={handleAddProduct}
              >
                <PlusCircle size={16} className="mr-1" />
                <span>Add Product</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscribers</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product, idx) => (
                    <tr key={product.id || idx}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center mr-3">
                            <Package size={16} />
                          </div>
                          <div>{product.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(product.price)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {product.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{product.subscribers}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                        <button className="text-red-600 hover:text-red-900">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 'revenue':
        return (
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium mb-4">Revenue Overview</h3>
              <div className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <div className="text-indigo-500 text-sm font-medium mb-1">Total Revenue</div>
                    <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-green-500 text-sm font-medium mb-1">Monthly Growth</div>
                    <div className="text-2xl font-bold">{stats.revenueGrowth}%</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-blue-500 text-sm font-medium mb-1">Average Revenue/User</div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(stats.totalRevenue / stats.totalUsers)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={revenueData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={value => formatCurrency(value)} />
                    <Bar dataKey="revenue" fill={COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium mb-4">Revenue by Product</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={products.map(p => ({
                          name: p.name,
                          value: p.price * p.subscribers
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {products.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={value => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Share</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {products.map((product, idx) => {
                        const revenue = product.price * product.subscribers;
                        const totalRev = products.reduce((sum, p) => sum + (p.price * p.subscribers), 0);
                        const percentage = (revenue / totalRev * 100).toFixed(1);
                        
                        return (
                          <tr key={product.id || idx}>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="flex items-center">
                                <div 
                                  className="w-3 h-3 rounded-full mr-2" 
                                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                                ></div>
                                <div>{product.name}</div>
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right">
                              {formatCurrency(revenue)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right">
                              {percentage}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'analytics':
        return (
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium mb-4">App Usage Analytics</h3>
              <div className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <div className="text-indigo-500 text-sm font-medium mb-1">Daily Active Users</div>
                    <div className="text-2xl font-bold">{stats.dailyActiveUsers}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-green-500 text-sm font-medium mb-1">Avg. Session Time</div>
                    <div className="text-2xl font-bold">8m 24s</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-blue-500 text-sm font-medium mb-1">Weekly Retention</div>
                    <div className="text-2xl font-bold">84%</div>
                  </div>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={usageData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="visits" fill={COLORS.info} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium mb-4">User Distribution</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={productData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {productData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Type</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {productData.map((type, idx) => {
                        const total = productData.reduce((sum, t) => sum + t.value, 0);
                        const percentage = (type.value / total * 100).toFixed(1);
                        
                        return (
                          <tr key={idx}>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="flex items-center">
                                // Continuing from where your code left off
                                <div 
                                  className="w-3 h-3 rounded-full mr-2"
                                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                                ></div>
                                <span>{type.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right">
                              {type.value.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right">
                              {percentage}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium mb-4">User Engagement Over Time</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={engagementData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="newUsers" stroke={COLORS.primary} name="New Users" />
                    <Line type="monotone" dataKey="returningUsers" stroke={COLORS.success} name="Returning Users" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium mb-4">Top Features Used</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={featuresData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 90, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="feature" type="category" width={80} />
                      <Tooltip />
                      <Bar dataKey="usage" fill={COLORS.secondary} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium mb-4">Geographic Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={geoData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {geoData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium mb-4">Activity Timeline</h3>
              <div className="space-y-4">
                {activityData.map((activity, idx) => (
                  <div key={idx} className="flex items-start">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                      activity.type === 'signup' ? 'bg-green-100 text-green-600' : 
                      activity.type === 'purchase' ? 'bg-blue-100 text-blue-600' : 
                      'bg-purple-100 text-purple-600'
                    }`}>
                      {activity.type === 'signup' ? <UserPlusIcon className="w-4 h-4" /> : 
                       activity.type === 'purchase' ? <ShoppingCartIcon className="w-4 h-4" /> : 
                       <BellIcon className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
            }
          };
    
          return (
            <div className="flex">
              <Sidebar />
              <div className="flex-1 lg:ml-64">
                <Header />
                <main className="p-6 bg-gray-50 min-h-screen">
                  {renderTab()}
                </main>
              </div>
            </div>
          );
        };
    
        export default Dashboard;
        