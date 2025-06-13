"use client";
import { useState, useEffect } from 'react';
import { 
  Home, 
  Download, 
  Heart, 
  ShoppingBag, 
  Search, 
  Bell, 
  User, 
  Grid3X3, 
  List,
  Star,
  Eye,
  Calendar,
  TrendingUp,
  Building,
  Zap,
  Award,
  Menu,
  X
} from 'lucide-react';

// Mock Data
const mockDashboardData = {
  user: {
    name: "Cycus",
    email: "cycus@gmail.com",
    avatar: ""
  },
  stats: {
    totalPurchases: 24,
    activePlans: 18,
    favorites: 12,
    monthlySpending: 2450
  },
  purchasedDrawings: [
    {
      id: 1,
      title: "Modern Villa Blueprint",
      category: "Residential",
      price: 299,
      purchaseDate: "2024-05-15",
      image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=300&fit=crop",
      status: "completed",
      downloads: 3,
      rating: 5
    },
    {
      id: 2,
      title: "Urban Apartment Complex",
      category: "Commercial",
      price: 485,
      purchaseDate: "2024-06-01",
      image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=300&fit=crop",
      status: "in-progress",
      downloads: 1,
      rating: 4
    },
    {
      id: 3,
      title: "Sustainable Office Building",
      category: "Commercial",
      price: 650,
      purchaseDate: "2024-06-08",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop",
      status: "completed",
      downloads: 5,
      rating: 5
    }
  ],
  recommendedDrawings: [
    {
      id: 4,
      title: "Luxury Penthouse Design",
      category: "Residential",
      price: 399,
      image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400&h=300&fit=crop",
      rating: 4.8,
      architect: "Patrick",
      isNew: true
    },
    {
      id: 5,
      title: "Eco-Friendly Community Center",
      category: "Public",
      price: 525,
      image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop",
      rating: 4.9,
      architect: "Onduko",
      isPopular: true
    },
    {
      id: 6,
      title: "Contemporary Restaurant Layout",
      category: "Commercial",
      price: 275,
      image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop",
      rating: 4.7,
      architect: "Manase",
      isTrending: true
    }
  ]
};

function CustomerDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [activeTab, setActiveTab] = useState('purchased');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      setDashboardData(mockDashboardData);
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const StatCard = ({ icon: Icon, title, value, change, color }) => (
    <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
          {change && (
            <div className="flex items-center mt-2">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600 font-medium">+{change}%</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  );

  const DrawingCard = ({ drawing, isPurchased = false, onPurchase }) => (
    <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group">
      <div className="relative overflow-hidden">
        <img 
          src={drawing.image} 
          alt={drawing.title}
          className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Status badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {drawing.isNew && (
            <span className="px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded-full animate-pulse">
              NEW
            </span>
          )}
          {drawing.isPopular && (
            <span className="px-2 py-1 bg-orange-500 text-white text-xs font-semibold rounded-full">
              POPULAR
            </span>
          )}
          {drawing.isTrending && (
            <span className="px-2 py-1 bg-purple-500 text-white text-xs font-semibold rounded-full">
              TRENDING
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors">
            <Heart className="w-4 h-4 text-gray-700" />
          </button>
          <button className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors">
            <Eye className="w-4 h-4 text-gray-700" />
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
              {drawing.title}
            </h3>
            <p className="text-sm text-gray-600">{drawing.category}</p>
          </div>
          {drawing.rating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium text-gray-700">{drawing.rating}</span>
            </div>
          )}
        </div>

        {drawing.architect && (
          <p className="text-sm text-gray-600 mb-3">by {drawing.architect}</p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-blue-600">${drawing.price}</span>
          
          {isPurchased ? (
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200 transition-colors flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          ) : (
            <button 
              onClick={() => onPurchase?.(drawing.id)}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Purchase
            </button>
          )}
        </div>

        {isPurchased && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
            <span>Downloads: {drawing.downloads}</span>
            <span>Purchased: {new Date(drawing.purchaseDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 lg:hidden transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="h-12 w-48 flex items-center">
        <img 
          src="/Logo2.svg" 
          alt="Logo" 
          className="h-10"
        />
      </div>
            </div>

            <div className="flex items-center gap-4">
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              </button>
              <div className="flex items-center gap-3">
                <img
                  src={dashboardData.user.avatar}
                  alt={dashboardData.user.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{dashboardData.user.name}</p>
                  <p className="text-xs text-gray-600">Customer</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white/90 backdrop-blur-xl border-r border-gray-200 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="p-6">
            <nav className="space-y-2">
              <button 
                onClick={() => setActiveSection('dashboard')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  activeSection === 'dashboard' 
                    ? 'text-blue-600 bg-blue-50' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Home className="w-5 h-5" />
                Dashboard
              </button>
              <button 
                onClick={() => setActiveSection('purchases')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  activeSection === 'purchases' 
                    ? 'text-blue-600 bg-blue-50' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ShoppingBag className="w-5 h-5" />
                My Purchases
              </button>
              <button 
                onClick={() => setActiveSection('favorites')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  activeSection === 'favorites' 
                    ? 'text-blue-600 bg-blue-50' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Heart className="w-5 h-5" />
                Favorites
              </button>
              <button 
                onClick={() => setActiveSection('downloads')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  activeSection === 'downloads' 
                    ? 'text-blue-600 bg-blue-50' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Download className="w-5 h-5" />
                Downloads
              </button>
              <button 
                onClick={() => setActiveSection('profile')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  activeSection === 'profile' 
                    ? 'text-blue-600 bg-blue-50' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <User className="w-5 h-5" />
                Profile
              </button>
            </nav>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8">
          {activeSection === 'dashboard' && (
            <>
              {/* Welcome Section */}
              <div className="mb-8">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-8 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
                  <div className="relative">
                    <h2 className="text-3xl font-bold mb-2">Welcome back, {dashboardData.user.name}!</h2>
                    <p className="text-blue-100 mb-6">Discover and purchase premium architectural drawings from top architects worldwide.</p>
                    <button className="px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors inline-flex items-center gap-2">
                      <Search className="w-5 h-5" />
                      Browse New Drawings
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  icon={ShoppingBag}
                  title="Total Purchases"
                  value={dashboardData.stats.totalPurchases}
                  change="12"
                  color="text-blue-600"
                />
                <StatCard
                  icon={Zap}
                  title="Active Plans"
                  value={dashboardData.stats.activePlans}
                  change="8"
                  color="text-green-600"
                />
                <StatCard
                  icon={Heart}
                  title="Favorites"
                  value={dashboardData.stats.favorites}
                  change="25"
                  color="text-purple-600"
                />
                <StatCard
                  icon={Award}
                  title="This Month"
                  value={`${dashboardData.stats.monthlySpending.toLocaleString()}`}
                  change="15"
                  color="text-orange-600"
                />
              </div>

              {/* Content Tabs */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="border-b border-gray-200">
                  <div className="flex items-center justify-between p-6">
                    <nav className="flex space-x-8">
                      <button
                        onClick={() => setActiveTab('purchased')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                          activeTab === 'purchased'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        My Drawings ({dashboardData.purchasedDrawings.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('recommended')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                          activeTab === 'recommended'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Recommended
                      </button>
                    </nav>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg transition-colors ${
                          viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        <Grid3X3 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg transition-colors ${
                          viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        <List className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {activeTab === 'purchased' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {dashboardData.purchasedDrawings.map(drawing => (
                        <DrawingCard
                          key={drawing.id}
                          drawing={drawing}
                          isPurchased={true}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {dashboardData.recommendedDrawings.map(drawing => (
                        <DrawingCard
                          key={drawing.id}
                          drawing={drawing}
                          isPurchased={false}
                          onPurchase={(id) => console.log('Purchase drawing:', id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeSection === 'purchases' && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">My Purchases</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashboardData.purchasedDrawings.map(drawing => (
                  <DrawingCard
                    key={drawing.id}
                    drawing={drawing}
                    isPurchased={true}
                  />
                ))}
              </div>
            </div>
          )}

          {activeSection === 'favorites' && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">My Favorites</h2>
              <div className="text-center py-12">
                <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No favorites yet</p>
                <p className="text-sm text-gray-400">Start adding drawings to your favorites to see them here</p>
              </div>
            </div>
          )}

          {activeSection === 'downloads' && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Download History</h2>
              <div className="space-y-4">
                {dashboardData.purchasedDrawings.map(drawing => (
                  <div key={drawing.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-4">
                      <img src={drawing.image} alt={drawing.title} className="w-16 h-16 rounded-lg object-cover" />
                      <div>
                        <h3 className="font-semibold text-gray-900">{drawing.title}</h3>
                        <p className="text-sm text-gray-600">Downloaded {drawing.downloads} times</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'profile' && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Profile Settings</h2>
              <div className="max-w-md">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                    <input 
                      type="text" 
                      value={dashboardData.user.name}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input 
                      type="email" 
                      value={dashboardData.user.email}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      readOnly
                    />
                  </div>
                  <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Update Profile
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default CustomerDashboard;