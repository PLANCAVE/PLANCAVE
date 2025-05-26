import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import {
  BarChart, Bar, XAxis, YAxis, LineChart, Line, Legend, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  Users, ShoppingBag, DollarSign, BarChart2,
  PlusCircle, Search, Settings, Bell, ChevronDown,
  Calendar, TrendingUp, Package, User, LogOut, Menu, X,
  UserPlus as UserPlusIcon, ShoppingCart as ShoppingCartIcon, Bell as BellIcon,
  Edit, Trash2, Eye
} from 'lucide-react';
import { flaskApi } from '../../axios';

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
const CHART_COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c'];

const Dashboard = ({ initialUsers = [], initialProducts = [] }) => {
  const [activeTab, setActiveTab] = useState('overview');
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
  const [revenueData, setRevenueData] = useState([]);
  const [usageData, setUsageData] = useState([]);
  const [productData, setProductData] = useState([]);
  const [users, setUsers] = useState(initialUsers);
  const [products, setProducts] = useState(initialProducts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ username: '', password: '', role: 'customer' });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const router = useRouter();
  const { data: session, status } = useSession();

  const getAccessToken = () => {
    if (session?.accessToken) return session.accessToken;
    if (session?.user?.accessToken) return session.user.accessToken;
    if (session?.token) return session.token;
    return null;
  };

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
      
      const token = getAccessToken();
      if (!token) {
        setError('Authentication required. Please log in.');
        toast.error('Authentication required. Please log in.');
        return;
      }

      setLoading(true);
      const config = { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      };

      try {
        // Verify token first
        const authCheck = await flaskApi.get('/verify-token', config);
        if (!authCheck.data.valid) {
          throw new Error('Invalid authentication token');
        }

        // Fetch all data in parallel
        const [usersRes, productsRes, revenueRes, usageRes, notificationsRes] = await Promise.allSettled([
          flaskApi.get('/admin/users', config),
          flaskApi.get('/admin/products', config),
          flaskApi.get('/admin/revenue', config),
          flaskApi.get('/admin/analytics/usage', config),
          flaskApi.get('/admin/notifications', config)
        ]);

        // Handle users data
        if (usersRes.status === 'fulfilled') {
          const userData = usersRes.value.data.users || usersRes.value.data || [];
          setUsers(userData);
        }

        // Handle products data
        if (productsRes.status === 'fulfilled') {
          const productData = productsRes.value.data.products || productsRes.value.data || [];
          setProducts(productData);
        }

        // Handle revenue data
        if (revenueRes.status === 'fulfilled') {
          const revenue = revenueRes.value.data;
          setRevenueData(revenue.monthly || []);
          setStats(prevStats => ({
            ...prevStats,
            totalRevenue: revenue.total || 0,
            revenueGrowth: revenue.growth || 0
          }));
        }

        // Handle usage analytics
        if (usageRes.status === 'fulfilled') {
          const usage = usageRes.value.data;
          setUsageData(usage.usage || usage.daily || []);
          setProductData(usage.userTypes || usage.distribution || []);
          setStats(prevStats => ({
            ...prevStats,
            dailyActiveUsers: usage.dailyActive || 0
          }));
        }

        // Handle notifications
        if (notificationsRes.status === 'fulfilled') {
          setNotifications(notificationsRes.value.data.notifications || []);
        }

        // Recalculate stats with fresh data
        const finalUsers = usersRes.status === 'fulfilled' ? 
          (usersRes.value.data.users || usersRes.value.data || []) : users;
        const finalProducts = productsRes.status === 'fulfilled' ? 
          (productsRes.value.data.products || productsRes.value.data || []) : products;
        
        calculateStats(finalUsers, finalProducts);
        setError('');

      } catch (err) {
        console.error('Dashboard error:', err);
        if (err.response?.status === 401) {
          setError('Your session has expired. Please log in again.');
          toast.error('Your session has expired. Please log in again.');
          await signOut({ redirect: false });
          router.push('/login');
        } else {
          setError(`Failed to fetch dashboard data: ${err.response?.data?.message || err.message}`);
          toast.error(`Failed to fetch dashboard data: ${err.response?.data?.message || err.message}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session, status, router]);

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

  // Delete user handler
  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    const token = getAccessToken();
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      const config = { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      };

      await flaskApi.delete(`/admin/users/${userId}`, config);
      setUsers(users.filter(user => user.id !== userId));
      toast.success('User deleted successfully');
    } catch (err) {
      console.error('Delete user error:', err);
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

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
          Authorization: `Bearer ${token}`,
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

  // Add User Handler
  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddUserLoading(true);
    
    try {
      const token = getAccessToken();
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        router.push('/login');
        return;
      }

      const config = { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      };

      const payload = {
        username: addUserForm.username,
        password: addUserForm.password,
        role: addUserForm.role
      };

      await flaskApi.post('/admin/create_user', payload, config);
      toast.success('User created successfully!');
      setShowAddUserModal(false);
      setAddUserForm({ username: '', password: '', role: 'customer' });

      // Refresh users list
      const usersRes = await flaskApi.get('/admin/users', config);
      const userData = usersRes.data.users || usersRes.data;
      setUsers(userData);
      calculateStats(userData, products);
      
    } catch (err) {
      console.error('Add user error:', err);
      if (err.response?.status === 401) {
        toast.error('Authentication failed. Please log in again.');
        await signOut({ redirect: false });
        router.push('/login');
      } else {
        toast.error(err.response?.data?.message || 'Failed to create user');
      }
    } finally {
      setAddUserLoading(false);
    }
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

  if (error && error.includes('Authentication required')) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // UI Components
  const OverviewCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white rounded-lg shadow-sm p-6 flex items-center">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
          <Users size={28} className="text-blue-600" />
        </div>
        <div>
          <div className="text-gray-500 text-sm">Total Users</div>
          <div className="text-2xl font-bold">{stats.totalUsers}</div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-6 flex items-center">
        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mr-4">
          <ShoppingBag size={28} className="text-indigo-600" />
        </div>
        <div>
          <div className="text-gray-500 text-sm">Total Products</div>
          <div className="text-2xl font-bold">{stats.totalProducts}</div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-6 flex items-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mr-4">
          <DollarSign size={28} className="text-green-600" />
        </div>
        <div>
          <div className="text-gray-500 text-sm">Total Revenue</div>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-6 flex items-center">
        <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mr-4">
          <TrendingUp size={28} className="text-yellow-600" />
        </div>
        <div>
          <div className="text-gray-500 text-sm">Revenue Growth</div>
          <div className="text-2xl font-bold">{stats.revenueGrowth}%</div>
        </div>
      </div>
    </div>
  );

  const NotificationDropdown = () => (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Notifications</h3>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {notifications.length > 0 ? (
          notifications.slice(0, 5).map((notification, idx) => (
            <div key={idx} className="p-3 border-b border-gray-100 hover:bg-gray-50">
              <div className="text-sm text-gray-900">{notification.title}</div>
              <div className="text-xs text-gray-500 mt-1">{notification.message}</div>
              <div className="text-xs text-gray-400 mt-1">{notification.timestamp}</div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500">
            No new notifications
          </div>
        )}
      </div>
      <div className="p-2 border-t border-gray-200">
        <button className="w-full text-center text-sm text-indigo-600 hover:text-indigo-800">
          View all notifications
        </button>
      </div>
    </div>
  );

  const Sidebar = () => (
    <div className={`bg-indigo-900 text-white w-64 min-h-screen fixed transition-all ${isMobileMenuOpen ? 'left-0' : '-left-64 lg:left-0'} lg:translate-x-0 z-40`}>
      <div className="flex items-center justify-between p-4 border-b border-indigo-800">
        <div className="logo">
          <Link href="/">
            <img src="/Logo2.svg" alt="Logo" className="h-8" />
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
              <div className="font-medium">{session?.user?.username || 'Admin User'}</div>
              <div className="text-xs text-indigo-300">{session?.user?.role || 'admin'}</div>
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
            badge={stats.totalUsers}
          />
          <SidebarLink
            icon={<Package size={18} />}
            label="Products"
            active={activeTab === 'products'}
            onClick={() => setActiveTab('products')}
            badge={stats.totalProducts}
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
          <button 
            className="flex items-center text-indigo-300 hover:text-white w-full"
            onClick={handleLogout}
          >
            <LogOut size={18} className="mr-2" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );

  const SidebarLink = ({ icon, label, active, onClick, badge }) => (
    <button
      className={`flex items-center justify-between py-3 px-4 w-full ${active ? 'bg-indigo-800 text-white' : 'text-indigo-300 hover:bg-indigo-800 hover:text-white'}`}
      onClick={onClick}
    >
      <div className="flex items-center">
        <span className="mr-3">{icon}</span>
        <span>{label}</span>
      </div>
      {badge && (
        <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-full">
          {badge}
        </span>
      )}
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
        <div className="relative">
          <button 
            className="relative p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <BellIcon size={20} />
            {notifications.length > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
          {showNotifications && <NotificationDropdown />}
        </div>
        <div className="relative">
          <button className="flex items-center text-gray-700">
            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center mr-2">
              {(session?.user?.username || 'A').charAt(0).toUpperCase()}
            </div>
            <span className="hidden md:block">{session?.user?.username || 'Admin'}</span>
            <ChevronDown size={16} className="ml-1" />
          </button>
        </div>
      </div>
    </header>
  );

  // Add User Modal
  const AddUserModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center mb-4">
          <UserPlusIcon size={24} className="text-indigo-600 mr-2" />
          <h2 className="text-xl font-bold">Add New User</h2>
        </div>
        <form onSubmit={handleAddUser}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">Username</label>
            <input
              type="text"
              className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={addUserForm.username}
              onChange={e => setAddUserForm({ ...addUserForm, username: e.target.value })}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={addUserForm.password}
              onChange={e => setAddUserForm({ ...addUserForm, password: e.target.value })}
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 mb-1">Role</label>
            <select
              className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={addUserForm.role}
              onChange={e => setAddUserForm({ ...addUserForm, role: e.target.value })}
            >
              <option value="customer">Customer</option>
              <option value="designer">Designer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              onClick={() => setShowAddUserModal(false)}
              disabled={addUserLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              disabled={addUserLoading}
            >
              {addUserLoading ? 'Adding...' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Tab rendering
  const renderTab = () => {
    switch (activeTab) {
      case 'users':
        return (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center">
                <Users size={20} className="text-gray-600 mr-2" />
                <h3 className="text-lg font-medium">User Management</h3>
                <span className="ml-2 bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-sm">
                  {filteredUsers.length} users
                </span>
              </div>
              <button
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center"
                onClick={() => setShowAddUserModal(true)}
              >
                <UserPlusIcon size={16} className="mr-1" />
                <span>Add User</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user, idx) => (
                      <tr key={user.id || idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-500 flex items-center justify-center mr-3">
                              {(user.username || user.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>{user.username || user.name || `User ${idx + 1}`}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                          {user.email || `user${idx + 1}@example.com`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                            user.role === 'designer' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role || "user"}
                          </span>
                        </td>
                       <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            (user.isActive || user.status === 'active') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {(user.isActive || user.status === 'active') ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 
                           user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button className="text-indigo-600 hover:text-indigo-900" title="View">
                              <Eye size={16} />
                            </button>
                            <button className="text-blue-600 hover:text-blue-900" title="Edit">
                              <Edit size={16} />
                            </button>
                            <button 
                              className="text-red-600 hover:text-red-900" 
                              title="Delete"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'products':
        return (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center">
                <Package size={20} className="text-gray-600 mr-2" />
                <h3 className="text-lg font-medium">Product Management</h3>
                <span className="ml-2 bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-sm">
                  {filteredProducts.length} products
                </span>
              </div>
              <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center">
                <PlusCircle size={16} className="mr-1" />
                <span>Add Product</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product, idx) => (
                      <tr key={product.id || idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center mr-3">
                              <Package size={20} className="text-gray-500" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {product.name || `Product ${idx + 1}`}
                              </div>
                              <div className="text-sm text-gray-500">
                                {product.description?.substring(0, 50) || 'No description'}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                          {product.category || 'Uncategorized'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                          {formatCurrency(product.price || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                          <span className={`${product.stock < 10 ? 'text-red-600' : 'text-green-600'}`}>
                            {product.stock || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            product.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {product.status || 'active'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button className="text-indigo-600 hover:text-indigo-900" title="View">
                              <Eye size={16} />
                            </button>
                            <button className="text-blue-600 hover:text-blue-900" title="Edit">
                              <Edit size={16} />
                            </button>
                            <button 
                              className="text-red-600 hover:text-red-900" 
                              title="Delete"
                              onClick={() => handleDeleteProduct(product.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                        No products found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'revenue':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(stats.totalRevenue)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <DollarSign size={24} className="text-green-600" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className={`text-sm ${stats.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.revenueGrowth >= 0 ? '+' : ''}{stats.revenueGrowth}% from last month
                  </span>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Average Order Value</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(stats.totalRevenue / Math.max(stats.totalUsers, 1))}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <ShoppingCartIcon size={24} className="text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Conversion Rate</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {((stats.activeUsers / Math.max(stats.totalUsers, 1)) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <TrendingUp size={24} className="text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium mb-4">Revenue Trend</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [formatCurrency(value), 'Revenue']} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#4f46e5" 
                      strokeWidth={2}
                      name="Monthly Revenue"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

      case 'analytics':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium mb-4">Daily Active Users</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usageData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="users" fill="#4f46e5" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium mb-4">User Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={productData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {productData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium mb-4">Usage Analytics Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">
                    {stats.dailyActiveUsers}
                  </div>
                  <div className="text-sm text-gray-600">Daily Active Users</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.activeUsers}
                  </div>
                  <div className="text-sm text-gray-600">Total Active Users</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.newUsersThisMonth}
                  </div>
                  <div className="text-sm text-gray-600">New Users This Month</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {((stats.activeUsers / Math.max(stats.totalUsers, 1)) * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Engagement Rate</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium mb-4">Dashboard Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Email Notifications</h4>
                    <p className="text-sm text-gray-600">Receive email notifications for important updates</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Auto Refresh</h4>
                    <p className="text-sm text-gray-600">Automatically refresh dashboard data</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Dark Mode</h4>
                    <p className="text-sm text-gray-600">Switch to dark mode interface</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium mb-4">Account Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    defaultValue={session?.user?.username || 'Admin User'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    defaultValue={session?.user?.email || 'admin@example.com'}
                  />
                </div>
                <div className="pt-4">
                  <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

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