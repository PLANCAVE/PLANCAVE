"use client";
import { useEffect, useState } from 'react';
import useProfile from '../../hooks/useProfile';
import NewProductForm from '../Dashboards/NewProductForm';
import ProductManagement from '../Dashboards/productManagement';

import { 
  BarChart3, 
  DollarSign, 
  FileText, 
  Settings, 
  TrendingUp, 
  Users, 
  Bell,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Download,
  Calendar,
  CreditCard,
  User,
  Mail,
  Building2,
  PieChart,
  Activity,
  Zap,
  AlertCircle,
  Loader2
} from 'lucide-react';

// API service functions


// Header Component
const ModernHeader = ({ title, isMobileMenuOpen, setIsMobileMenuOpen, userProfile, isLoading }) => (
  <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
    <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex items-center">
        <button
          className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <div className="w-6 h-6 flex flex-col justify-center">
            <span className={`block h-0.5 w-6 bg-current transform transition ${isMobileMenuOpen ? 'rotate-45 translate-y-1' : ''}`} />
            <span className={`block h-0.5 w-6 bg-current transform transition mt-1 ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-6 bg-current transform transition mt-1 ${isMobileMenuOpen ? '-rotate-45 -translate-y-1' : ''}`} />
          </div>
        </button>
        <h1 className="ml-4 text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          {title}
        </h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="hidden md:flex relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button className="relative p-2 text-gray-400 hover:text-gray-500">
          <Bell className="h-6 w-6" />
          <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="flex items-center space-x-3">
          {isLoading ? (
            <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
          ) : (
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
              {userProfile?.username?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="hidden sm:block">
            {isLoading ? (
              <div className="space-y-1">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-900">{userProfile?.username || 'User'}</p>
                <p className="text-xs text-gray-500 capitalize">{userProfile?.role || 'Designer'}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  </header>
);

// Sidebar Component
const ModernSidebar = ({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'products', label: 'Products', icon: FileText },
    { id: 'analysis', label: 'Analytics', icon: TrendingUp },
    { id: 'earnings', label: 'Earnings', icon: DollarSign },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}
      
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
            <Building2 className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">Designer</span>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
          
          <div className="p-4 border-t border-gray-200">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white text-center">
              <Zap className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm font-medium">Upgrade to Pro</p>
              <p className="text-xs opacity-90">Unlock premium features</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Enhanced StatCard Component
const StatCard = ({ title, value, change, icon: Icon, color = 'blue', trend, isLoading }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    red: 'bg-red-50 text-red-600 border-red-200'
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mt-2"></div>
          </div>
          <div className="p-3 bg-gray-100 rounded-xl">
            <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {change && (
            <div className="flex items-center mt-2">
              {trend === 'up' ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ml-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {change}
              </span>
              <span className="text-sm text-gray-500 ml-1">vs last month</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl border ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

// Error Component
const ErrorMessage = ({ message, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
    <div className="flex-1">
      <p className="text-red-800">{message}</p>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="text-red-600 hover:text-red-700 font-medium text-sm"
      >
        Retry
      </button>
    )}
  </div>
);

// Loading Component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    <span className="ml-2 text-gray-600">Loading...</span>
  </div>
);

// Overview Tab Component
const OverviewTab = ({ dashboardData, userProfile, isLoading, error, onRetry }) => {
  if (error) {
    return <ErrorMessage message={error} onRetry={onRetry} />;
  }

  const recentPlans = dashboardData?.dashboard?.recent_plans || [];
  
  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2">
            Welcome back, {userProfile?.username || 'Designer'}! 👋
          </h2>
          <p className="text-blue-100 text-lg">
            Ready to manage your architectural projects as a {userProfile?.role || 'professional'}?
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <button className="bg-white bg-opacity-20 backdrop-blur-sm text-white px-6 py-2 rounded-lg hover:bg-opacity-30 transition-all">
              View Projects
            </button>
            <button className="border border-white border-opacity-20 text-white px-6 py-2 rounded-lg hover:bg-white hover:bg-opacity-10 transition-all">
              Upload New Plan
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Plans" 
          value={dashboardData?.dashboard?.total_plans_uploaded || 0} 
          change="+12%"
          trend="up"
          icon={FileText}
          color="blue"
          isLoading={isLoading}
        />
        <StatCard 
          title="Total Earnings" 
          value={dashboardData?.dashboard?.total_earnings || '$0.00'} 
          change="+8.2%"
          trend="up"
          icon={DollarSign}
          color="green"
          isLoading={isLoading}
        />
        <StatCard 
          title="Active Projects" 
          value={recentPlans.filter(plan => plan.status === 'active').length || 0} 
          change="+3"
          trend="up"
          icon={Activity}
          color="purple"
          isLoading={isLoading}
        />
        <StatCard 
          title="Client Rating" 
          value="4.8/5" 
          change="+0.2"
          trend="up"
          icon={Users}
          color="orange"
          isLoading={isLoading}
        />
      </div>
      
      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Plans</h3>
          {isLoading ? (
            <LoadingSpinner />
          ) : recentPlans.length > 0 ? (
            <div className="space-y-4">
              {recentPlans.map((plan, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{plan.name}</p>
                    <p className="text-xs text-gray-500">
                      Status: <span className="capitalize">{plan.status}</span> | 
                      Sales: {plan.sales_count} | 
                      Price: ${plan.price}
                    </p>
                  </div>
                  <div className={`h-3 w-3 rounded-full ${
                    plan.status === 'active' ? 'bg-green-500' : 
                    plan.status === 'pending' ? 'bg-yellow-500' : 'bg-gray-500'
                  }`}></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No plans uploaded yet</p>
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Upload Plan", icon: Plus, color: "bg-blue-500" },
              { label: "View Analytics", icon: BarChart3, color: "bg-purple-500" },
              { label: "Manage Clients", icon: Users, color: "bg-green-500" },
              { label: "Settings", icon: Settings, color: "bg-gray-500" }
            ].map((action, index) => (
              <button key={index} className={`${action.color} text-white p-4 rounded-lg hover:opacity-90 transition-opacity`}>
                <action.icon className="h-6 w-6 mx-auto mb-2" />
                <span className="text-sm font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Product Management Tab
const ProductManagementTab = ({ userProfile }) => {
  const [showNewForm, setShowNewForm] = useState(false);
  const handleCloseModal = () => {
    setShowNewForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
          <p className="text-gray-600">Manage your architectural products and plans</p>
        </div>
        <button 
          onClick={() => setShowNewForm(!showNewForm)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Add New Product</span>
        </button>
      </div>
      
      {showNewForm ? <NewProductForm onClose={handleCloseModal} /> : <ProductManagement />}
    </div>
  );
};

// Analytics Tab
const AnalysisTab = ({ dashboardData, isLoading }) => {
  const recentPlans = dashboardData?.dashboard?.recent_plans || [];
  const totalSales = recentPlans.reduce((sum, plan) => sum + (plan.sales_count || 0), 0);
  
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">Analytics & Insights</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Downloads" 
          value={totalSales.toLocaleString()} 
          change="+15.3%"
          trend="up"
          icon={Download}
          color="blue"
          isLoading={isLoading}
        />
        <StatCard 
          title="Profile Views" 
          value="8,934" 
          change="+7.8%"
          trend="up"
          icon={Eye}
          color="green"
          isLoading={isLoading}
        />
        <StatCard 
          title="Conversion Rate" 
          value="14.2%" 
          change="+2.1%"
          trend="up"
          icon={TrendingUp}
          color="purple"
          isLoading={isLoading}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Performance Overview</h3>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Monthly Downloads</span>
              <span className="font-semibold text-2xl">{Math.floor(totalSales / 12)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{width: '75%'}}></div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Client Engagement</span>
              <span className="font-semibold text-2xl">89%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-600 h-2 rounded-full" style={{width: '89%'}}></div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Insights</h3>
          <div className="text-center py-8">
            <PieChart className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Detailed analytics coming soon</p>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              View Full Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Earnings Tab
const EarningsTab = ({ dashboardData, userProfile, isLoading }) => {
  const totalEarnings = dashboardData?.dashboard?.total_earnings || '$0.00';
  const monthlyEarnings = Math.floor(parseFloat(totalEarnings.replace('$', '').replace(',', '')) / 12);
  
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Earnings Dashboard</h2>
        <p className="text-gray-600">Track your financial performance and payments</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Earnings" 
          value={totalEarnings} 
          change="+12.5%"
          trend="up"
          icon={DollarSign}
          color="green"
          isLoading={isLoading}
        />
        <StatCard 
          title="This Month" 
          value={`$${monthlyEarnings.toLocaleString()}`} 
          change="+8.2%"
          trend="up"
          icon={Calendar}
          color="blue"
          isLoading={isLoading}
        />
        <StatCard 
          title="Pending" 
          value="$2,340" 
          change="-5.1%"
          trend="down"
          icon={CreditCard}
          color="orange"
          isLoading={isLoading}
        />
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">View All</button>
        </div>
        
        <div className="space-y-4">
          {[
            { amount: "$2,340", date: "Mar 15, 2024", status: "Completed", method: "PayPal" },
            { amount: "$1,890", date: "Mar 01, 2024", status: "Completed", method: "Bank Transfer" },
            { amount: "$3,450", date: "Feb 15, 2024", status: "Completed", method: "PayPal" },
          ].map((payment, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CreditCard className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{payment.amount}</p>
                  <p className="text-sm text-gray-500">{payment.date} via {payment.method}</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                {payment.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Complete the Settings Tab notifications section and add the main Dashboard component
const SettingsTab = ({ userProfile, isLoading }) => (
  <div className="space-y-8">
    <h2 className="text-2xl font-bold text-gray-900">Account Settings</h2>
    
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h3>
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xl">
              {userProfile?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Change Photo
            </button>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input 
              type="text" 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              defaultValue={userProfile?.username || ''}
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <input 
              type="text" 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
              value={userProfile?.role || ''}
              readOnly
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Member Since
            </label>
            <input 
              type="text" 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
              value={userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString() : ''}
              readOnly
            />
          </div>
          
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Payment Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option>PayPal</option>
                <option>Bank Transfer</option>
                <option>Stripe</option>
              </select>
            </div>
            <button className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors">
              Update Payment Method
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Notifications</h3>
          <div className="space-y-4">
            {[
              { id: 'email', label: 'Email Notifications', icon: Mail, enabled: true },
              { id: 'push', label: 'Push Notifications', icon: Bell, enabled: false },
              { id: 'sales', label: 'Sales Updates', icon: DollarSign, enabled: true },
              { id: 'messages', label: 'New Messages', icon: MessageSquare, enabled: true }
            ].map((notification) => (
              <div key={notification.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <notification.icon className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{notification.label}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    defaultChecked={notification.enabled}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Security</h3>
          <div className="space-y-4">
            <button className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Change Password</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
            
            <button className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <Download className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Download Data</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
            
            <button className="w-full flex items-center justify-between p-3 border border-red-300 rounded-lg hover:bg-red-50 transition-colors text-red-600">
              <div className="flex items-center space-x-3">
                <Trash2 className="h-5 w-5 text-red-500" />
                <span className="text-sm font-medium">Delete Account</span>
              </div>
              <span className="text-red-400">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Main DesignerDashboard Component
const DesignerDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { profile, loading } = useProfile();


// API service functions (simplified for demo)
const apiService = {
  async fetchWithAuth(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  },
  async getDashboardData() {
    return this.fetchWithAuth('http://localhost:5001/dashboard/architect');
  },
  async getUserProfile() {
    return this.fetchWithAuth('http://localhost:5001/dashboard/me');
  }
};

// Fetch data on component mount
useEffect(() => {
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [dashboardResponse, profileResponse] = await Promise.all([
        apiService.getDashboardData(),
        apiService.getUserProfile()
      ]);

      setDashboardData(dashboardResponse);
      setUserProfile(profileResponse);
    } catch (err) {
      setError('Failed to load dashboard data. Please try again.');
      console.error('Dashboard error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  fetchData();
}, []);

  // Retry function for error handling
  const handleRetry = () => {
    window.location.reload();
  };

  // Render tab content based on active tab
  const renderTabContent = () => {
    const commonProps = { dashboardData, userProfile, isLoading, error, onRetry: handleRetry };
    
    switch (activeTab) {
      case 'overview':
        return <OverviewTab {...commonProps} />;
      case 'products':
        return <ProductManagementTab userProfile={userProfile} />;
      case 'analysis':
        return <AnalysisTab dashboardData={dashboardData} isLoading={isLoading} />;
      case 'earnings':
        return <EarningsTab {...commonProps} />;
      case 'settings':
        return <SettingsTab userProfile={userProfile} isLoading={isLoading} />;
      default:
        return <OverviewTab {...commonProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Sidebar */}
        <ModernSidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
          {/* Header */}
          <ModernHeader 
            title="Designer Dashboard"
            isMobileMenuOpen={isMobileMenuOpen}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
            userProfile={userProfile}
            isLoading={isLoading}
          />
          
          {/* Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {renderTabContent()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default DesignerDashboard;