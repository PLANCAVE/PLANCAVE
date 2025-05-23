
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession, getSession } from 'next-auth/react';
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
  UserPlus as UserPlusIcon, ShoppingCart as ShoppingCartIcon, Bell as BellIcon
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

const Dashboard = () => {
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
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ username: '', password: '', role: 'customer' });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();

   const getAccessToken = () => {
    // Try to get the token from session.user or session directly
    if (session?.accessToken) return session.accessToken;
    if (session?.user?.accessToken) return session.user.accessToken;
    if (session?.token) return session.token;
    // Optionally, check localStorage fallback (not recommended)
    return null;
  };


  // Fetch dashboard data from Flask backend
  useEffect(() => {
console.log('Session:', session);
const fetchData = async () => {
  try {
    setLoading(true);

    // Wait for session to be loaded
    if (status === 'loading') return;

    // Get NextAuth JWT token
    const token = session?.accessToken;
    console.log('Access Token:', token);

    if (!token) {
      setError('Authentication required. Please log in.');
      toast.error('Authentication required. Please log in.');
      //router.push('/login');
      return;
    }

    const config = { 
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      } 
    };

        try {
          // First verify the token is valid
          const authCheck = await flaskApi.get(`/verify-token`, config);
          if (!authCheck.data.valid) {
            throw new Error('Invalid authentication token');
          }
        } catch (authError) {
          console.error('Authentication error:', authError);
          setError('Your session has expired. Please log in again.');
          toast.error('Your session has expired. Please log in again.');
          //router.push('/login');
          return;
        }

        // If token is valid, proceed with data fetching
        try {
          // Users
          const usersRes = await flaskApi.get(`/admin/users`, config);
          setUsers(usersRes.data.users || usersRes.data);

          // Products
          const productsRes = await flaskApi.get(`/admin/products`, config);
          setProducts(productsRes.data.products || productsRes.data);

          // Revenue
          const revenueRes = await flaskApi.get(`/admin/revenue`, config);
          setRevenueData(revenueRes.data.monthly || []);
          const totalRevenue = revenueRes.data.total || 0;
          const revenueGrowth = revenueRes.data.growth || 0;

          // Usage analytics
          const usageRes = await flaskApi.get(`/admin/analytics/usage`, config);
          setUsageData(usageRes.data.usage || []);
          setProductData(usageRes.data.userTypes || []);
          const dailyActiveUsers = usageRes.data.dailyActive || 0;

          // Calculate stats
          const userList = usersRes.data.users || usersRes.data || [];
          const productList = productsRes.data.products || productsRes.data || [];
          const activeUsers = userList.filter(user => user.isActive).length;
          const adminUsers = userList.filter(user => user.role === 'admin').length;
          const now = new Date();
          const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const newUsersThisMonth = userList.filter(user => {
            const createdAt = user.createdAt || user.created_at;
            return createdAt && new Date(createdAt) >= thisMonth;
          }).length;

          setStats({
            totalUsers: userList.length,
            activeUsers,
            adminUsers,
            newUsersThisMonth,
            totalProducts: productList.length,
            totalRevenue,
            revenueGrowth,
            dailyActiveUsers
          });

          setError('');
        } catch (dataError) {
          console.error('Data fetching error:', dataError);
          if (dataError.response && dataError.response.status === 422) {
            setError('Server could not process the request. Please check your permissions.');
            toast.error('Server could not process the request. Please check your permissions.');
          } else {
            setError(`Failed to fetch dashboard data: ${dataError.response?.data?.message || dataError.message}`);
            toast.error(`Failed to fetch dashboard data: ${dataError.response?.data?.message || dataError.message}`);
          }
        }
      } catch (err) {
        console.error('Dashboard error:', err);
        setError(`An unexpected error occurred: ${err.message}`);
        toast.error(`An unexpected error occurred: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Only re-run when session or status changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, session, status]);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    toast.info('You have been logged out');
    router.push('/login');
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
    }).format(value);
  };

  // Add User Handler (calls Flask /admin/create_user endpoint)
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

      // Use flaskApi for Flask backend requests
      await flaskApi.post('/admin/create_user', payload, config);
      toast.success('User created successfully!');
      setShowAddUserModal(false);
      setAddUserForm({ username: '', password: '', role: 'customer' });

      // Refresh users list
      const usersRes = await flaskApi.get('/admin/users', config);
      setUsers(usersRes.data.users || usersRes.data);
    } catch (err) {
      console.error('Add user error:', err);
      if (err.response && err.response.status === 401) {
        toast.error('Authentication failed. Please log in again.');
        router.push('/login');
      } else {
        toast.error(err.response?.data?.message || 'Failed to create user');
      }
    } finally {
      setAddUserLoading(false);
    }
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
          <Calendar size={28} className="text-green-600" />
        </div>
        <div>
          <div className="text-gray-500 text-sm">New Users This Month</div>
          <div className="text-2xl font-bold">{stats.newUsersThisMonth || 0}</div>
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
          <button 
            className="flex items-center text-indigo-300 hover:text-white"
            onClick={handleLogout}
          >
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

  // Add User Modal
  const AddUserModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add New User</h2>
        <form onSubmit={handleAddUser}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">Username</label>
            <input
              type="text"
              className="w-full border px-3 py-2 rounded"
              value={addUserForm.username}
              onChange={e => setAddUserForm({ ...addUserForm, username: e.target.value })}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full border px-3 py-2 rounded"
              value={addUserForm.password}
              onChange={e => setAddUserForm({ ...addUserForm, password: e.target.value })}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">Role</label>
            <select
              className="w-full border px-3 py-2 rounded"
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
              className="px-4 py-2 bg-gray-200 rounded"
              onClick={() => setShowAddUserModal(false)}
              disabled={addUserLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded"
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
              <h3 className="text-lg font-medium">User Management</h3>
              <button
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center"
                onClick={() => setShowAddUserModal(true)}
              >
                <PlusCircle size={16} className="mr-1" />
                <span>Add User</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.slice(0, 10).map((user, idx) => (
                      <tr key={user.id || idx}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-500 flex items-center justify-center mr-3">
                              {(user.username || user.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>{user.username || user.name || `User ${idx + 1}`}</div>
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {showAddUserModal && <AddUserModal />}
          </div>
        );
      case 'products':
        return (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">Product Management</h3>
              <Link href="/admin/products/new">
                <button
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center"
                >
                  <PlusCircle size={16} className="mr-1" />
                  <span>Add Product</span>
                </button>
              </Link>
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
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product, idx) => (
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
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
                      {stats.totalUsers > 0 ? formatCurrency(stats.totalRevenue / stats.totalUsers) : '$0.00'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-80">
                {revenueData.length > 0 ? (
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
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">No revenue data available</p>
                  </div>
                )}
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
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-blue-500 text-sm font-medium mb-1">Total Users</div>
                    <div className="text-2xl font-bold">{stats.totalUsers}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-green-500 text-sm font-medium mb-1">Admin Users</div>
                    <div className="text-2xl font-bold">{stats.adminUsers}</div>
                  </div>
                </div>
              </div>
              <div className="h-72">
                {usageData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={usageData}
                      margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e1e8f0" />
                      <XAxis dataKey="day" stroke="#4a6f8a" />
                      <YAxis stroke="#4a6f8a" />
                      <Tooltip />
                      <Bar dataKey="visits" fill={COLORS.secondary} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">No usage data available</p>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border border-blue-100">
              <h3 className="text-lg font-medium mb-4 text-blue-900">User Distribution</h3>
              <div className="h-64">
                {productData.length > 0 ? (
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
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">No user distribution data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium mb-6">Dashboard Settings</h3>
            <div className="space-y-6">
              <div>
                <h4 className="text-md font-medium mb-2">Account Settings</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-600 mb-4">Manage your account settings and preferences</p>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                    Edit Profile
                  </button>
                </div>
              </div>
              <div>
                <h4 className="text-md font-medium mb-2">Notification Preferences</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-600 mb-4">Configure how you receive notifications</p>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                    Manage Notifications
                  </button>
                </div>
              </div>
              <div>
                <h4 className="text-md font-medium mb-2">Security Settings</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-600 mb-4">Update your password and security preferences</p>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <OverviewCards />;
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 lg:ml-64">
        <Header />
        <main className="p-6 bg-blue-50 min-h-screen">
          {renderTab()}
          {/* Always render the modal but conditionally show it */}
          {showAddUserModal && <AddUserModal />}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
                