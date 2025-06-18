import React, { useState, useEffect, useMemo,  } from 'react';
import {
  BarChart3,
  Users,
  Package,
  DollarSign,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  LayoutDashboard,

  Crown,
  UserCheck,
  Zap,
  Search,
  Plus,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Activity,
  ShoppingBag,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import ProductManagement from '../Dashboards/productManagement';
import NewProductForm from '../Dashboards/NewProductForm';
import useProfile from '../../hooks/useProfile';



const api = {

  fetchProfile: async (token) => {
    const res = await fetch('http://localhost:5001/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  },
  get: async (url, token) => {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  post: async (url, body, token) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  delete: async (url, token) => {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

const mockUser = { 
  username: 'Admin User', 
  role: 'admin' 
};

// Sidebar Component (updated with session prop)
const AdminSidebar = ({ isCollapsed, setIsCollapsed, activeTab, setActiveTab, session, handleLogout }) => {
  const [hoveredItem, setHoveredItem] = useState(null);

  const menuItems = [
    { icon: LayoutDashboard, label: "Overview", key: "overview", description: "Dashboard home" },
    { icon: Users, label: "User Management", key: "users", description: "Manage all users" },
    { icon: Package, label: "Product Management", key: "products", description: "Manage products" },
    { icon: DollarSign, label: "Revenue Analytics", key: "revenue", description: "Financial insights" },
    { icon: BarChart3, label: "System Analytics", key: "analytics", description: "Platform metrics" },
    { icon: Settings, label: "Settings", key: "settings", description: "System preferences" }
  ];

  return (
    <div className={`
      bg-white/95 backdrop-blur-xl text-slate-800 fixed left-0 top-0 h-full z-50 
      transition-all duration-500 ease-out shadow-2xl border-r border-slate-200/50
      ${isCollapsed ? 'w-20' : 'w-72'}
    `}>
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-purple-600/5" />
      
      {/* Header */}
      <div className={`relative flex items-center justify-between p-6 border-b border-slate-200/50 ${isCollapsed ? 'justify-center p-4' : ''}`}>
        <div className={`transition-all duration-500 ${isCollapsed ? 'hidden' : 'flex items-center'}`}>
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 via-pink-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
            <Crown size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Admin Portal
            </h1>
            <p className="text-xs text-slate-500 font-medium">System Administrator</p>
          </div>
        </div>
        
        <button
          className="flex items-center justify-center w-8 h-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all duration-200"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* User Profile */}
      <div className={`relative p-6 border-b border-slate-200/50 ${isCollapsed ? 'p-4' : ''}`}>
        <div className={`flex items-center transition-all duration-500 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-lg">
              <User size={20} className="text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm" />
          </div>
          <div className={`ml-4 transition-all duration-500 ${isCollapsed ? 'hidden' : 'block'}`}>
            <div className="font-semibold text-slate-800 text-sm">{session?.user?.username}</div>
            <div className="text-xs font-medium text-red-500 capitalize">Admin Account</div>
            <div className="flex items-center mt-1">
              <Zap size={10} className="text-green-500 mr-1" />
              <span className="text-xs text-slate-500">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="space-y-2 px-4">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.key;
            const isHovered = hoveredItem === item.key;
            
            return (
              <div
                key={item.key}
                className="relative"
                onMouseEnter={() => setHoveredItem(item.key)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <button
                  className={`
                    w-full flex items-center px-4 py-3.5 rounded-2xl text-left 
                    transition-all duration-300 group relative overflow-hidden
                    ${isActive 
                      ? 'bg-gradient-to-r from-red-500 via-pink-500 to-purple-600 text-white shadow-lg transform scale-[1.02]' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}
                  `}
                  onClick={() => setActiveTab(item.key)}
                >
                  {isActive && <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl" />}
                  
                  <div className="flex items-center min-w-0 flex-1 relative z-10">
                    <IconComponent size={20} className={`flex-shrink-0 transition-all duration-300 ${isActive ? 'scale-110 drop-shadow-sm' : isHovered ? 'scale-105' : ''}`} />
                    <div className={`ml-4 transition-all duration-500 ${isCollapsed ? 'hidden' : 'block'}`}>
                      <span className="font-semibold text-sm block">{item.label}</span>
                      <span className={`text-xs mt-0.5 block ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                        {item.description}
                      </span>
                    </div>
                  </div>
                </button>

                {isCollapsed && isHovered && (
                  <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap shadow-xl z-50">
                    {item.label}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Logout */}
      <div className={`p-4 border-t border-slate-200/50`}>
        <button 
          className={`flex items-center w-full px-4 py-3.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all duration-300 group font-medium ${isCollapsed ? 'justify-center' : ''}`}
          onClick={handleLogout}
        >
          <LogOut size={20} className="flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
          <span className={`ml-4 transition-all duration-500 ${isCollapsed ? 'hidden' : 'block'}`}>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

// Overview Cards Component (unchanged)
const OverviewCards = ({ stats, formatCurrency }) => {
  const cards = [
    {
      title: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      change: "+12.5%",
      trend: "up",
      icon: Users,
      color: "from-blue-500 to-blue-600",
      bgColor: "from-blue-50 to-blue-100"
    },
    {
      title: "Active Users",
      value: stats.activeUsers.toLocaleString(),
      change: "+8.2%",
      trend: "up",
      icon: Activity,
      color: "from-green-500 to-green-600",
      bgColor: "from-green-50 to-green-100"
    },
    {
      title: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      change: `+${stats.revenueGrowth}%`,
      trend: "up",
      icon: DollarSign,
      color: "from-purple-500 to-purple-600",
      bgColor: "from-purple-50 to-purple-100"
    },
    {
      title: "Total Products",
      value: stats.totalProducts.toLocaleString(),
      change: "+15.3%",
      trend: "up",
      icon: ShoppingBag,
      color: "from-orange-500 to-orange-600",
      bgColor: "from-orange-50 to-orange-100"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const IconComponent = card.icon;
        const TrendIcon = card.trend === 'up' ? ArrowUpRight : ArrowDownRight;
        
        return (
          <div key={index} className={`bg-gradient-to-br ${card.bgColor} p-6 rounded-2xl shadow-sm border border-white/50 hover:shadow-lg transition-all duration-300`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center shadow-lg`}>
                <IconComponent size={24} className="text-white" />
              </div>
              <div className={`flex items-center text-sm font-semibold ${card.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                <TrendIcon size={16} className="mr-1" />
                {card.change}
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-1">{card.value}</div>
            <div className="text-sm text-slate-600">{card.title}</div>
          </div>
        );
      })}
    </div>
  );
};

// User Management Component (updated with API integration)
const UserManagement = ({ users, onDeleteUser, searchQuery, setSearchQuery, onAddUser }) => {
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    username: '',

    role: 'customer',
    password: ''
  });

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddUserSubmit = (e) => {
    e.preventDefault();
    onAddUser(newUserData);
    setShowAddUserModal(false);
    setNewUserData({
      username: '',
      role: 'customer',
      password: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
        <button 
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex items-center"
          onClick={() => setShowAddUserModal(true)}
        >
          <Plus size={20} className="mr-2" />
          Add User
        </button>
      </div>

      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Add New User</h3>
            <form onSubmit={handleAddUserSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={newUserData.username}
                    onChange={(e) => setNewUserData({...newUserData, username: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={newUserData.role}
                    onChange={(e) => setNewUserData({...newUserData, role: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="customer">Customer</option>
                    <option value="designer">Designer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({...newUserData, password: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden">
        <div className="p-6 border-b border-slate-200/50">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Joined</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors duration-200">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                        <User size={16} className="text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{user.name}</div>
                        <div className="text-sm text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'admin' ? 'bg-red-100 text-red-700' :
                      user.role === 'architect' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200">
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => onDeleteUser(user)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Main Admin Dashboard Component (updated with API integration)
const AdminDashboard = ({ role }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  
 const { profile } = useProfile();
 
  
 const token = localStorage.getItem('token'); // Get token directly

 const formatCurrency = (amount, options = {}) => {
  const {
    currency = 'USD',
    locale = 'en-US',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2
  } = options;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount || 0);
};




  useEffect(() => {
    if(!token || !profile) return;
  const fetchDashboardData = async () => {
    const token = localStorage.getItem('token'); // Use 'token' not 'accessToken'
    
    if (!token) {
      console.log('No token found');
      setLoading(false); // Important: stop loading even if no token
      return;
    }

    try {
      console.log('Fetching dashboard data...'); // Debug log
      const data = await api.get('http://localhost:5001/dashboard/admin', token);
      console.log('Dashboard data received:', data); // Debug log
      
      setStats({
        totalUsers: data.stats?.user_count || 0,
        activeUsers: data.stats?.active_user_count || 0,
        adminUsers: data.stats?.admin_count || 0,
        newUsersThisMonth: data.stats?.new_users_this_month || 0,
        totalProducts: data.stats?.product_count || 0,
        totalRevenue: data.stats?.total_sales || 0,
        revenueGrowth: data.stats?.revenue_growth || 0,
        dailyActiveUsers: data.stats?.daily_active_users || 0
      });
      setUsers(data.users || []);
      setProducts(data.products || []);
    } catch (err) {
      console.error('Dashboard error:', err);
      // Set default empty data instead of failing
      setStats({
        totalUsers: 0,
        activeUsers: 0,
        adminUsers: 0,
        newUsersThisMonth: 0,
        totalProducts: 0,
        totalRevenue: 0,
        revenueGrowth: 0,
        dailyActiveUsers: 0
      });
      setUsers([]);
      setProducts([]);
    } finally {
      setLoading(false); // Always stop loading
    }
  };

  fetchDashboardData();
}, [token, profile]); // Remove token dependency


  const fetchUsers = () => {
    api.get('http://localhost:5001/admin/users', token)
      .then(setUsers)
      .catch(err => console.error('Fetch users error', err));
  };

  const handleAddUser = (newUserData) => {
    api.post('http://localhost:5001/admin/create_user', newUserData, token)
      .then(() => {
        fetchUsers();
      })
      .catch(err => console.error('Add user error', err));
  };

  const handleDeleteUser = (user) => {
    if (window.confirm(`Delete user "${user.username}"?`)) {
      api.delete(`/admin/users/${user.id}`, token)
        .then(() => fetchUsers())
        .catch(err => console.error('Delete user error', err));
    }
  };

  const handleDeleteProduct = (productId) => {
    if (window.confirm('Confirm product deletion?')) {
      api.delete(`/products/${productId}`, token)
        .then(() => setProducts(prev => prev.filter(p => p.id !== productId)))
        .catch(err => console.error('Delete product error', err));
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    window.location.reload();
  };

  const renderTabContent = () => {
    if (!users || !token) return null;

    switch (activeTab) {
      case 'overview':
        return stats ? (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">Dashboard Overview</h1>
              <p className="text-slate-600">Welcome back! Here's what's happening with your platform.</p>
            </div>
            <OverviewCards stats={stats} formatCurrency={formatCurrency} />
          </div>
        ) : (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        );
      case 'users':
        return (
          <UserManagement 
            users={users} 
            onDeleteUser={handleDeleteUser}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onAddUser={handleAddUser}
          />
        );
      case 'products':
        return (

          
         <ProductManagement
  role={mockUser.role}
  products={products}
  filteredProducts={filteredProducts}
  formatCurrency={formatCurrency}
  handleDeleteProduct={handleDeleteProduct}
  onAddDrawing={() => setShowForm(true)}
/>
        );
      case 'revenue':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Revenue Analytics</h2>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200/50">
              {stats ? (
                <div className="space-y-4">
                  <div className="text-3xl font-bold text-slate-800">
                    {formatCurrency(stats.totalRevenue)}
                  </div>
                  <div className={`flex items-center text-lg font-semibold ${
                    stats.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stats.revenueGrowth >= 0 ? (
                      <ArrowUpRight size={20} className="mr-1" />
                    ) : (
                      <ArrowDownRight size={20} className="mr-1" />
                    )}
                    {Math.abs(stats.revenueGrowth)}% {stats.revenueGrowth >= 0 ? 'increase' : 'decrease'} from last month
                  </div>
                </div>
              ) : (
                <p className="text-slate-600">Loading revenue data...</p>
              )}
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">System Analytics</h2>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200/50">
              <p className="text-slate-600">Advanced analytics dashboard coming soon...</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200/50">
              <p className="text-slate-600">System settings panel coming soon...</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

 
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
<AdminSidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={profile}  // Pass the full profile
        handleLogout={() => {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }}
      />
                
             
      
      <main className={`transition-all duration-500 ${isCollapsed ? 'ml-20' : 'ml-72'} p-8`}>


        {showForm && (
          <NewProductForm
            onClose={() => setShowForm(false)}
            onProductCreated={(newProduct) => {
              setProducts(prev => [...prev, newProduct]);
              setShowForm(false);
            }}
          />
        )}
        {renderTabContent()}
      </main>
    </div>
  );
};

export default AdminDashboard;